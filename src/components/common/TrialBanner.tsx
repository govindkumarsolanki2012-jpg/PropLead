import React from 'react';
import { Sparkles, AlertCircle, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../../types';
import { getEffectiveSubscriptionStatus } from '../../utils/billing';

interface TrialBannerProps {
  profile: UserProfile;
  onOpenSubscription: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ profile, onOpenSubscription }) => {
  const { status, daysRemaining, isSubscribed } = getEffectiveSubscriptionStatus(profile);

  // 1. ACTIVE SUBSCRIPTION
  // For users with an active subscription, do not show the Trial Expired upgrade banner.
  if (status === 'ACTIVE' || status === 'CANCELED_BUT_ACTIVE' || isSubscribed) {
    return null;
  }

  // 2. PAYMENT ISSUE
  if (status === 'PAYMENT_ISSUE') {
    return (
      <div
        id="dashboard-payment-issue-banner"
        onClick={onOpenSubscription}
        className="mx-4 mt-3 p-2.5 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 flex items-center justify-between cursor-pointer transition-all hover:shadow-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            <span className="font-bold text-amber-800 dark:text-amber-300">Payment Issue</span>
            <span className="mx-1.5 opacity-40">•</span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">Action Required</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 flex-shrink-0 pl-2">
          <span>Fix</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  // 3. TRIAL EXPIRED (View-Only Mode)
  if (status === 'EXPIRED' || daysRemaining <= 0) {
    return (
      <div
        id="dashboard-trial-expired-banner"
        onClick={onOpenSubscription}
        className="mx-4 mt-3 p-2.5 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100/70 transition-all shadow-2xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-rose-600 text-white flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 truncate">
            <span>Trial Expired</span>
          </div>
        </div>
        <button
          type="button"
          id="dashboard-trial-expired-unlock-cta"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSubscription();
          }}
          className="flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 flex-shrink-0 pl-2 cursor-pointer"
        >
          <span>Unlock Pro</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // 4. ACTIVE FREE TRIAL (Dynamic days remaining)
  const isUrgent = daysRemaining <= 2;
  const isWarning = daysRemaining <= 4 && !isUrgent;

  return (
    <div
      id="dashboard-trial-active-banner"
      onClick={onOpenSubscription}
      className={`mx-4 mt-3 p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
        isUrgent
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
          : isWarning
          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
      } hover:shadow-xs`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            isUrgent ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {isUrgent ? <Clock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
        </div>
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          <span>Free Trial</span>
          <span className="mx-1.5 opacity-40">•</span>
          <span
            className={
              isUrgent
                ? 'text-amber-700 dark:text-amber-300 font-bold'
                : 'text-emerald-700 dark:text-emerald-300'
            }
          >
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
          </span>
        </div>
      </div>
      <button
        type="button"
        id="dashboard-trial-active-unlock-cta"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSubscription();
        }}
        className={`flex items-center gap-1 text-xs font-semibold flex-shrink-0 pl-2 cursor-pointer ${
          isUrgent ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
        }`}
      >
        <span>Unlock Pro</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

