import React from 'react';
import { Building2, Search, Plus, Sparkles, X } from 'lucide-react';
import { UserProfile, TabType } from '../../types';
import { useTranslation } from '../../context/LanguageContext';

interface HeaderProps {
  profile: UserProfile;
  currentTab?: TabType;
  searchQuery?: string;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  onSearchFocus?: () => void;
  onOpenQuickAdd: () => void;
  onOpenSubscription: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  currentTab,
  searchQuery = '',
  searchPlaceholder,
  onSearchChange,
  onSearchFocus,
  onOpenQuickAdd,
  onOpenSubscription,
}) => {
  const { t } = useTranslation();

  const isPropertiesTab = currentTab === 'properties';
  const isLeadsTab = currentTab === 'leads';
  const isHomeTab = currentTab === 'home';
  const showSearchBar = isHomeTab || isLeadsTab || isPropertiesTab;
  const effectivePlaceholder =
    searchPlaceholder ||
    (isHomeTab
      ? t('dash_search_placeholder')
      : isPropertiesTab
      ? t('prop_search_placeholder')
      : t('leads_search_placeholder'));
  const addBtnLabel = isPropertiesTab ? t('prop_add_btn') : t('header_add_lead');

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-4 pb-2.5 sm:pb-3 transition-colors safe-header"
      style={{
        paddingTop: 'calc(0.75rem + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)))',
      }}
    >
      {/* Top Row: Brand Identity (Left) + Trial/Pro Badge & Quick Add (Right) */}
      <div className="flex items-center justify-between gap-2">
        {/* Brand & Agency - Always fully visible, never compressed */}
        <div id="header-brand-section" className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          <div
            id="header-brand-logo"
            className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0"
          >
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none whitespace-nowrap flex-shrink-0">
                PropLead
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                IN
              </span>
            </div>
            <p
              className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[110px] xs:max-w-[150px] sm:max-w-[220px]"
              title={profile?.agencyName || profile?.name || 'Property Agency'}
            >
              {profile?.agencyName || profile?.name || 'Property Agency'}
            </p>
          </div>
        </div>

        {/* Right Actions: Trial/Pro Status + Quick Add Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
          {/* Trial / Pro Badge: Hidden on Property and Leads tabs */}
          {!isPropertiesTab && !isLeadsTab && (
            profile?.isSubscribed ? (
              <span
                id="header-pro-badge"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex-shrink-0 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{t('header_pro')}</span>
              </span>
            ) : (
              <button
                id="header-trial-badge"
                onClick={onOpenSubscription}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex-shrink-0 whitespace-nowrap"
              >
                <span>{profile?.trialDaysRemaining ?? 30}{t('header_free_trial')}</span>
              </button>
            )
          )}

          {/* Quick Add Button: Hidden on Property tab */}
          {!isPropertiesTab && (
            <button
              id="header-add-lead-btn"
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm transition-all flex-shrink-0 whitespace-nowrap"
              aria-label={addBtnLabel}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{addBtnLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Search Input Bar - completely separate from logo, shown ONLY on Dashboard (home), Leads, and Properties */}
      {showSearchBar && (
        <div id="header-search-row" className="pt-2 sm:pt-2.5">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0" />
            <input
              id="header-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onFocus={onSearchFocus}
              placeholder={effectivePlaceholder}
              className="w-full pl-8.5 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-medium border border-slate-200/60 dark:border-slate-700/60 outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
