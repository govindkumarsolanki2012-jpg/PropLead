import React from 'react';
import { Home, Users, Building, Calendar, BarChart3 } from 'lucide-react';
import { TabType } from '../../types';
import { useTranslation } from '../../context/LanguageContext';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange?: (tab: TabType) => void;
  onChangeTab?: (tab: TabType) => void;
  onOpenQuickAdd?: () => void;
  leadCount?: number;
  propertyCount?: number;
  todayFollowUpCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onChangeTab,
  onOpenQuickAdd,
  leadCount = 0,
  propertyCount = 0,
  todayFollowUpCount = 0,
}) => {
  const { t } = useTranslation();

  const handleTabSelect = (tabId: TabType) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else if (onChangeTab) {
      onChangeTab(tabId);
    }
  };

  const tabs = [
    { id: 'home' as TabType, label: t('nav_home'), icon: Home },
    { id: 'leads' as TabType, label: t('nav_leads'), icon: Users, badge: leadCount > 0 ? leadCount : undefined },
    { id: 'properties' as TabType, label: t('nav_properties'), icon: Building, badge: propertyCount > 0 ? propertyCount : undefined },
    { id: 'calendar' as TabType, label: t('nav_calendar'), icon: Calendar, dot: todayFollowUpCount > 0 },
    { id: 'analytics' as TabType, label: t('nav_analytics'), icon: BarChart3 },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="flex-shrink-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 rounded-t-2xl sm:rounded-t-3xl shadow-[0_-6px_20px_-2px_rgba(0,0,0,0.06),0_-2px_6px_-1px_rgba(0,0,0,0.03)] transition-colors safe-bottom-nav w-full opacity-100"
      style={{
        paddingBottom: 'calc(0.5rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="flex items-center justify-around px-2 sm:px-4 pt-2.5 pb-1 max-w-2xl mx-auto relative gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`bottom-nav-tab-${tab.id}`}
              onClick={() => handleTabSelect(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 sm:px-2 min-h-[54px] sm:min-h-[58px] min-w-0 rounded-2xl transition-all duration-150 relative select-none touch-manipulation active:scale-[0.97] ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-13 h-8 sm:w-14 sm:h-8.5 rounded-full flex items-center justify-center transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 shadow-xs'
                      : 'bg-transparent'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 sm:w-6.5 sm:h-6.5 transition-transform duration-150 ${
                      isActive ? 'stroke-[2.25px] text-emerald-700 dark:text-emerald-400' : 'stroke-[1.85px]'
                    }`}
                  />
                </div>

                {tab.badge !== undefined && (
                  <span
                    id={`bottom-nav-badge-${tab.id}`}
                    className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-emerald-600 dark:bg-emerald-500 text-white text-[9.5px] sm:text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center text-center leading-none shadow-xs border border-white dark:border-slate-900"
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {tab.dot && (
                  <span
                    id={`bottom-nav-dot-${tab.id}`}
                    className="absolute -top-0.5 right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"
                  />
                )}
              </div>

              <span
                className={`text-[11px] sm:text-xs tracking-tight truncate max-w-full text-center leading-tight mt-1 transition-colors ${
                  isActive
                    ? 'font-bold text-emerald-700 dark:text-emerald-400'
                    : 'font-medium text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
