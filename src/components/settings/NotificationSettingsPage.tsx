import React, { useState } from 'react';
import { ChevronLeft, AlertTriangle, BellOff } from 'lucide-react';
import { NotificationSettings } from '../../types';

type ConfirmableNotificationKey = 'followUpReminders' | 'propertyVisitReminders' | 'dailySummary';

interface ConfirmationConfig {
  title: string;
  message: string;
}

const CONFIRMATION_CONFIGS: Record<ConfirmableNotificationKey, ConfirmationConfig> = {
  followUpReminders: {
    title: 'Turn off follow-up reminders?',
    message: 'You may miss scheduled client follow-ups.',
  },
  propertyVisitReminders: {
    title: 'Turn off property visit reminders?',
    message: 'You may miss scheduled property visits.',
  },
  dailySummary: {
    title: 'Turn off daily summary?',
    message: 'You will no longer receive the morning follow-up overview.',
  },
};

interface NotificationSettingsPageProps {
  notificationSettings: NotificationSettings;
  permissionState: { granted: boolean; display: string };
  isRequestingPerm: boolean;
  onBack: () => void;
  onToggleNotification: (key: keyof NotificationSettings) => void;
  onRequestPermission: () => void;
}

export const NotificationSettingsPage: React.FC<NotificationSettingsPageProps> = ({
  notificationSettings,
  permissionState,
  isRequestingPerm,
  onBack,
  onToggleNotification,
  onRequestPermission,
}) => {
  const [confirmDisableKey, setConfirmDisableKey] = useState<ConfirmableNotificationKey | null>(null);

  const handleSwitchClick = (key: ConfirmableNotificationKey) => {
    // Only show confirmation when turning OFF
    if (notificationSettings[key]) {
      setConfirmDisableKey(key);
    } else {
      // Turning ON does not require confirmation
      onToggleNotification(key);
    }
  };

  const handleCancelDisable = () => {
    setConfirmDisableKey(null);
  };

  const handleConfirmDisable = () => {
    if (confirmDisableKey) {
      onToggleNotification(confirmDisableKey);
      setConfirmDisableKey(null);
    }
  };

  return (
    <div id="notifications-settings-page" className="space-y-4">
      {/* Top Header / Back Navigation */}
      <div className="flex items-center gap-2.5 pb-1">
        <button
          type="button"
          id="btn-back-to-settings"
          onClick={onBack}
          className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shadow-2xs cursor-pointer active:scale-95 shrink-0"
          aria-label="Back to Settings"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Notifications
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Manage alerts and reminder timings
          </p>
        </div>
      </div>

      {/* Permission Warning (if system notification permission not granted) */}
      {!permissionState.granted && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-tight">
              Notification permission is required to receive follow-up & visit alerts.
            </p>
          </div>
          <button
            type="button"
            disabled={isRequestingPerm}
            onClick={onRequestPermission}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 shadow-2xs transition-colors cursor-pointer"
          >
            {isRequestingPerm ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      )}

      {/* Notifications Settings Card */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
        {/* 1. Follow-up reminders */}
        <div className="flex items-center justify-between py-1">
          <div className="pr-4 min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Follow-up reminders
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Alerts for scheduled client follow-ups
            </p>
          </div>
          <button
            type="button"
            role="switch"
            id="switch-follow-up-reminders"
            aria-checked={notificationSettings.followUpReminders}
            onClick={() => handleSwitchClick('followUpReminders')}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
              notificationSettings.followUpReminders
                ? 'bg-emerald-600'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                notificationSettings.followUpReminders ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* 2. Property visit reminders */}
        <div className="flex items-center justify-between py-1">
          <div className="pr-4 min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Property visit reminders
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Alerts for client property visits and walkthroughs
            </p>
          </div>
          <button
            type="button"
            role="switch"
            id="switch-property-visit-reminders"
            aria-checked={notificationSettings.propertyVisitReminders}
            onClick={() => handleSwitchClick('propertyVisitReminders')}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
              notificationSettings.propertyVisitReminders
                ? 'bg-emerald-600'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                notificationSettings.propertyVisitReminders ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* 3. Daily summary */}
        <div className="flex items-center justify-between py-1">
          <div className="pr-4 min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Daily summary
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Morning 9:00 AM overview of today's scheduled follow-ups
            </p>
          </div>
          <button
            type="button"
            role="switch"
            id="switch-daily-summary"
            aria-checked={notificationSettings.dailySummary}
            onClick={() => handleSwitchClick('dailySummary')}
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 cursor-pointer ${
              notificationSettings.dailySummary
                ? 'bg-emerald-600'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                notificationSettings.dailySummary ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* 4. Reminder timing */}
        <div className="flex items-center justify-between py-1">
          <div className="pr-4 min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
              Reminder timing
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Standard alert schedule for scheduled events
            </p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
            30 min before + exact time
          </span>
        </div>
      </div>

      {/* Confirmation Warning Modal before turning OFF any notification */}
      {confirmDisableKey && (
        <div
          id="modal-confirm-disable-notification"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={handleCancelDisable}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BellOff className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3
                  id="confirm-disable-title"
                  className="text-sm font-bold text-slate-900 dark:text-white leading-snug"
                >
                  {CONFIRMATION_CONFIGS[confirmDisableKey].title}
                </h3>
                <p
                  id="confirm-disable-message"
                  className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
                >
                  {CONFIRMATION_CONFIGS[confirmDisableKey].message}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                id="btn-confirm-turn-off"
                onClick={handleConfirmDisable}
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer active:scale-95 text-center"
              >
                Turn Off
              </button>
              <button
                type="button"
                id="btn-confirm-keep-on"
                onClick={handleCancelDisable}
                className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer active:scale-95 text-center"
              >
                Keep On
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
