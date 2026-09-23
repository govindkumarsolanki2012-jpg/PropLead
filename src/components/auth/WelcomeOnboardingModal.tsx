import React, { useState } from 'react';
import {
  Users,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Compass,
} from 'lucide-react';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onComplete: (action: 'lead' | 'dashboard') => void;
  onStartTrial?: () => Promise<boolean>;
  onExploreFirst?: () => void;
  agentName?: string;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  onComplete,
  onStartTrial,
  onExploreFirst,
  agentName,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartTrialClick = async () => {
    if (!onStartTrial) {
      setStep(2);
      return;
    }
    setIsActivating(true);
    setErrorMessage(null);
    try {
      const success = await onStartTrial();
      if (success) {
        setStep(2);
      } else {
        setErrorMessage('Unable to start trial right now. You can explore first or try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start trial. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleExploreClick = () => {
    if (onExploreFirst) {
      onExploreFirst();
    } else {
      onComplete('dashboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-emerald-100 dark:border-slate-800 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Header */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-emerald-50/80 via-teal-50/40 to-transparent dark:from-emerald-950/30 dark:via-slate-900 dark:to-transparent text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-600/25 mb-4">
            {step === 1 ? (
              <Building2 className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>

          {step === 1 ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>7-Day Free Trial Available</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Welcome to PropLead
              </h1>
              {agentName && (
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                  Hello, {agentName}!
                </p>
              )}
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Start your 7-day free trial whenever you're ready.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Trial Active • 7 Days Unlocked</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                You're all set!
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                Full Pro access is now active. Add your first lead to get started.
              </p>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="px-6 py-4 flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-3">
              {/* Benefit 1 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Track every lead
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Organize buyer requirements, BHK preferences, budgets, and WhatsApp contacts in one secure pipeline.
                  </p>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Manage property listings
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Store inventory photos and details with complete private owner confidentiality.
                  </p>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Never miss a follow-up
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Timely mobile notifications and 1-tap WhatsApp follow-up reminders keep deals moving forward.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
                  Your workspace is ready with full Pro access for 7 days. You can capture a lead in under 10 seconds or jump straight into the dashboard.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% private &amp; broker-confidential cloud backup</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800">
          {step === 1 ? (
            <div className="space-y-2.5">
              <button
                type="button"
                id="btn_start_free_trial"
                disabled={isActivating}
                onClick={handleStartTrialClick}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isActivating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating Free Trial...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Start 7-Day Free Trial</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn_explore_first"
                disabled={isActivating}
                onClick={handleExploreClick}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore First</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                id="btn_onboarding_add_lead"
                onClick={() => onComplete('lead')}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add First Lead</span>
              </button>
              <button
                type="button"
                id="btn_onboarding_dashboard"
                onClick={() => onComplete('dashboard')}
                className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.99] text-slate-800 dark:text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500" />
                <span>Explore Dashboard</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
