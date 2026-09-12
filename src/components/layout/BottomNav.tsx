import React from 'react';
import { Home, Users, Building, Calendar, BarChart3, Settings } from 'lucide-react';
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
    { id: 'settings' as TabType, label: t('nav_settings'), icon: Settings },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors safe-bottom-nav"
      style={{
        paddingBottom: 'calc(0.375rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="flex items-center justify-around px-1 pt-1 pb-0.5 max-w-2xl mx-auto relative">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabSelect(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 min-w-0 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <div
                  className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-emerald-100 dark:bg-emerald-950/60'
                      : 'bg-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25px]' : 'stroke-2'}`} />
                </div>

                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-1.5 px-1 py-0.2 bg-emerald-600 text-white text-[8.5px] font-bold rounded-full min-w-3.5 h-3.5 flex items-center justify-center text-center leading-none shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {tab.dot && (
                  <span className="absolute -top-0.5 right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                )}
              </div>

              <span className="text-[10px] font-medium mt-0.5 tracking-tight truncate max-w-full text-center leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
