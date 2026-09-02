import React from 'react';
import { Building2, Search, Plus, CloudCheck, Sparkles, Bell } from 'lucide-react';
import { UserProfile } from '../../types';
import { useTranslation } from '../../context/LanguageContext';

interface HeaderProps {
  profile: UserProfile;
  onOpenQuickAdd: () => void;
  onOpenSearch?: () => void;
  onOpenSubscription: () => void;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenQuickAdd,
  onOpenSearch,
  onOpenSubscription,
}) => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 transition-colors">
      <div className="flex items-center justify-between gap-2">
        {/* Brand & Agency */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none truncate">
                PropLead
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                IN
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {profile?.agencyName || profile?.name || 'Property Agency'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Trial / Pro Badge */}
          {profile?.isSubscribed ? (
            <span className="hidden xs:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{t('header_pro')}</span>
            </span>
          ) : (
            <button
              onClick={onOpenSubscription}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
            >
              <span>{profile?.trialDaysRemaining ?? 30}{t('header_free_trial')}</span>
            </button>
          )}

          {/* Quick Search */}
          <button
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t('header_search')}
            aria-label={t('header_search')}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Top Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('header_add_lead')}</span>
            <span className="sm:hidden">+{t('header_add_lead')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
