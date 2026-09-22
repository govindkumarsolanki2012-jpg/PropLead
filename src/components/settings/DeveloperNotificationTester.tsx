import React, { useState, useEffect } from 'react';
import { FlaskConical, BellRing, Calendar, Clock, Check, ArrowRight, Sparkles } from 'lucide-react';
import { scheduleSampleNotification, triggerNotificationAction, NotificationPayloadExtra } from '../../utils/notifications';

interface DeveloperNotificationTesterProps {
  onNotifyTriggered?: (title: string, body: string) => void;
  className?: string;
}

export const DeveloperNotificationTester: React.FC<DeveloperNotificationTesterProps> = ({
  onNotifyTriggered,
  className = '',
}) => {
  const [activeCountdown, setActiveCountdown] = useState<{
    type: 'followup' | 'visit';
    secondsRemaining: number;
    title: string;
    body: string;
    extra: NotificationPayloadExtra;
  } | null>(null);
  const [lastFired, setLastFired] = useState<{
    type: 'followup' | 'visit';
    title: string;
    body: string;
    extra: NotificationPayloadExtra;
  } | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (!activeCountdown) return;

    if (activeCountdown.secondsRemaining <= 0) {
      setLastFired({
        type: activeCountdown.type,
        title: activeCountdown.title,
        body: activeCountdown.body,
        extra: activeCountdown.extra,
      });
      setActiveCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      setActiveCountdown((prev) =>
        prev && prev.secondsRemaining > 1
          ? { ...prev, secondsRemaining: prev.secondsRemaining - 1 }
          : null
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCountdown]);

  const handleSendSample = async (type: 'followup' | 'visit') => {
    const isFollowup = type === 'followup';
    const title = isFollowup ? 'Follow-up in 30 min' : 'Property visit now';
    const body = isFollowup ? 'Jyothi • 6:00 PM' : 'Jyothi • Madhurawada';
    const extra: NotificationPayloadExtra = {
      leadId: 'sample-lead',
      clientName: 'Jyothi',
      type: isFollowup ? 'followup' : 'visit',
      reminderKind: '30m',
    };

    setActiveCountdown({
      type,
      secondsRemaining: 5,
      title,
      body,
      extra,
    });
    setLastFired(null);

    await scheduleSampleNotification(type);
    if (onNotifyTriggered) {
      onNotifyTriggered(title, body);
    }
  };

  const handleDirectSimulatedTap = (extra: NotificationPayloadExtra) => {
    triggerNotificationAction(extra);
  };

  return (
    <div
      id="developer-notification-tester"
      className={`p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/80 space-y-3 shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Developer / Testing Feature
              </h3>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-300">
                AI Studio QA
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
              Test notification appearance, PropLead icon, channel & tap routing
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Trigger realistic 5-second delayed notifications. Does <span className="font-semibold">not</span> create fake database records. Tapping navigates directly to demo client <span className="font-semibold text-emerald-700 dark:text-emerald-400">Jyothi</span>.
      </p>

      {/* Active 5-second countdown alert */}
      {activeCountdown && (
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Triggering in {activeCountdown.secondsRemaining}s...
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {activeCountdown.title} • {activeCountdown.body}
              </div>
            </div>
          </div>
          <span className="px-2 py-1 rounded-md bg-amber-500 text-white font-extrabold text-xs shrink-0">
            {activeCountdown.secondsRemaining}s
          </span>
        </div>
      )}

      {/* Last fired test notification banner with instant tap button */}
      {lastFired && !activeCountdown && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Sample Notification Sent (5s elapsed)</span>
            </div>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              Active
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800 text-xs">
            <div className="font-bold text-slate-900 dark:text-white">{lastFired.title}</div>
            <div className="text-slate-500 text-[11px]">{lastFired.body}</div>
          </div>

          <button
            type="button"
            onClick={() => handleDirectSimulatedTap(lastFired.extra)}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-98 cursor-pointer"
          >
            <span>👉 Tap Sample Notification (Test Deep-Link)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {/* Button 1: Send Sample Notification (Follow-up) */}
        <button
          type="button"
          id="btn-send-sample-notification"
          disabled={Boolean(activeCountdown)}
          onClick={() => handleSendSample('followup')}
          className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 text-left shadow-2xs transition-all flex flex-col justify-between gap-2 active:scale-98 disabled:opacity-60 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <BellRing className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Send Sample Notification
              </span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pl-1">
            Follow-up in 30 min • <span className="font-semibold text-slate-700 dark:text-slate-200">Jyothi • 6:00 PM</span>
          </div>
        </button>

        {/* Button 2: Send Sample Visit Notification */}
        <button
          type="button"
          id="btn-send-sample-visit-notification"
          disabled={Boolean(activeCountdown)}
          onClick={() => handleSendSample('visit')}
          className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 text-left shadow-2xs transition-all flex flex-col justify-between gap-2 active:scale-98 disabled:opacity-60 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Send Sample Visit Notification
              </span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pl-1">
            Property visit now • <span className="font-semibold text-slate-700 dark:text-slate-200">Jyothi • Madhurawada</span>
          </div>
        </button>
      </div>
    </div>
  );
};
