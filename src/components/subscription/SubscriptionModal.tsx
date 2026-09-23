import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  AlertCircle,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { UserProfile, GooglePlaySubscriptionProduct, SubscriptionPlanId } from '../../types';
import {
  fetchGooglePlayProduct,
  GooglePlayProductResult,
  launchGooglePlayPurchase,
  restoreGooglePlayPurchases,
  getEffectiveSubscriptionStatus,
  openGooglePlayManageSubscriptions,
  openGooglePlayFixPayment,
  SUBSCRIPTION_PLANS,
  PRO_FEATURES_LIST,
  startFreeTrialServer,
  formatTrialEndDateTime,
} from '../../utils/billing';
import confetti from 'canvas-confetti';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onSubscribe?: (plan: string) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  onSubscribe,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>('quarterly');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStartingTrial, setIsStartingTrial] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productState, setProductState] = useState<{
    isLoading: boolean;
    isAvailable: boolean;
    product: GooglePlaySubscriptionProduct | null;
    error: string | null;
  }>({
    isLoading: true,
    isAvailable: true,
    product: null,
    error: null,
  });

  const {
    status,
    trialStatus,
    trialEverStarted,
    daysRemaining,
    expiryFormatted,
    isLocked,
    isTrialEndDateMissingOrInvalid,
  } = getEffectiveSubscriptionStatus(profile);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setProductState((prev) => ({ ...prev, isLoading: true }));

      fetchGooglePlayProduct().then((res: GooglePlayProductResult) => {
        setProductState({
          isLoading: false,
          isAvailable: res.isAvailable,
          product: res.product,
          error: res.error || null,
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await startFreeTrialServer(profile.id);
      if (res.success && res.trialEndDate) {
        onUpdateProfile({
          trialStatus: 'active',
          trialStartDate: res.trialStartDate,
          trialEndDate: res.trialEndDate,
          trialEverStarted: true,
          subscriptionStatus: 'TRIAL',
          isTrialActive: true,
        });
        setSuccessMessage('🎉 7-day free trial activated! All features unlocked.');
        try {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}
      } else {
        setErrorMessage(res.error || res.message || 'Failed to activate free trial.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error activating free trial.');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleStartPurchase = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStatus('Starting Google Play Billing flow...');

    try {
      const result = await launchGooglePlayPurchase(
        profile.id,
        (step) => {
          setProcessingStatus(step);
        },
        selectedPlanId
      );

      if (result.success && result.profileUpdates) {
        onUpdateProfile(result.profileUpdates);
        onSubscribe?.('property_agent_pro');
        setSuccessMessage('🎉 Subscription activated successfully!');

        try {
          confetti({
            particleCount: 70,
            spread: 75,
            origin: { y: 0.6 },
          });
        } catch {}

        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(result.error || 'Failed to complete Google Play purchase');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google Play purchase was interrupted.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStatus('Checking Google Play...');

    try {
      const result = await restoreGooglePlayPurchases(profile.id, (step) => setProcessingStatus(step));
      if (result.success && result.restored && result.profileUpdates) {
        onUpdateProfile(result.profileUpdates);
        setSuccessMessage(result.message);
        try {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
        } catch {}
      } else {
        setErrorMessage(result.message);
      }
    } catch (err) {
      setErrorMessage('Google Play billing is currently unavailable. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const selectedPlan = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.quarterly;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="relative p-6 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white text-center pb-6">
          <button
            id="btn_close_subscription_modal"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2.5 text-white border border-white/30 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-white">
            Choose Your Plan
          </h2>
          <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto leading-relaxed">
            Unlock all PropLead features
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Message Banners */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current State Indicators */}
          {status === 'ACTIVE' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-emerald-800 dark:text-emerald-200">
                  Pro Subscription Active
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                {profile.planId === 'monthly' ? '₹79/month' : '₹199 / 3 months'}
              </span>
            </div>
          )}

          {status === 'CANCELED_BUT_ACTIVE' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Auto-Renewal Cancelled</span>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-300">
                You retain full Pro access until {expiryFormatted || 'end of period'}.
              </p>
            </div>
          )}

          {status === 'PAYMENT_ISSUE' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Payment Issue with Google Play</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                {profile.paymentIssueMessage || 'Google Play could not renew your subscription. Please update your payment method.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={openGooglePlayFixPayment}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1"
                >
                  <span>Fix Payment</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={openGooglePlayManageSubscriptions}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[11px]"
                >
                  Manage
                </button>
              </div>
            </div>
          )}

          {/* Manual Free Trial Available Banner */}
          {trialStatus === 'not_started' && status !== 'ACTIVE' && status !== 'CANCELED_BUT_ACTIVE' && status !== 'PAYMENT_ISSUE' && !trialEverStarted && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500/30 dark:border-emerald-500/20 text-xs flex flex-col gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      7-Day Free Trial
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Free • ₹0
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Try all PropLead Pro features risk-free for 7 days. Start whenever you are ready.
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn_modal_start_trial"
                disabled={isStartingTrial || isProcessing}
                onClick={handleStartTrial}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isStartingTrial ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating Trial...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Start 7-Day Free Trial Now</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Dynamic Real Trial Countdown Indicator */}
          {status === 'TRIAL' && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex flex-col gap-2 transition-all ${
                daysRemaining <= 2
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                  : daysRemaining <= 4
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs ${
                      daysRemaining <= 2 ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      Free Trial Active
                    </div>
                    <div
                      className={`text-[11px] font-bold mt-0.5 ${
                        daysRemaining <= 2
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                    </div>
                  </div>
                </div>
                <div className="shrink-0 pl-2">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full whitespace-nowrap">
                    ₹0 Today
                  </span>
                </div>
              </div>

              {profile.trialEndDate && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatTrialEndDateTime(profile.trialEndDate)}</span>
                </div>
              )}
            </div>
          )}

          {/* Trial Expired / Unverified State */}
          {status === 'EXPIRED' && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-rose-900 dark:text-rose-100 text-xs">
                  {isTrialEndDateMissingOrInvalid ? 'Trial Status Unverified' : 'Free Trial Expired (0 Days Remaining)'}
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                  {isTrialEndDateMissingOrInvalid
                    ? 'Authoritative trial end date could not be verified. Select a plan below to activate full access.'
                    : 'Your free trial period has ended. Select a plan below to continue adding leads, properties, and follow-ups.'}
                </p>
              </div>
            </div>
          )}

          {/* 2 PRICING CARDS (Selection: Default 3 Months) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-0.5">
              Select Billing Duration
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* MONTHLY CARD */}
              <button
                type="button"
                id="btn_plan_monthly"
                onClick={() => setSelectedPlanId('monthly')}
                className={`relative text-left p-3.5 rounded-2xl transition-all flex flex-col justify-between cursor-pointer border-2 ${
                  selectedPlanId === 'monthly'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-xs ring-2 ring-emerald-600/20'
                    : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      1 Month
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                        selectedPlanId === 'monthly'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {selectedPlanId === 'monthly' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        ₹79
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        / month
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-tight">
                    Flexible monthly plan
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    ₹79 every month
                  </p>
                </div>
              </button>

              {/* 3-MONTH CARD (Prominent / Recommended / Best Value) */}
              <button
                type="button"
                id="btn_plan_quarterly"
                onClick={() => setSelectedPlanId('quarterly')}
                className={`relative text-left p-3.5 rounded-2xl transition-all flex flex-col justify-between cursor-pointer border-2 ${
                  selectedPlanId === 'quarterly'
                    ? 'border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/50 shadow-sm ring-2 ring-emerald-600/20'
                    : 'border-emerald-300/70 dark:border-emerald-700/50 bg-white dark:bg-slate-800/60 hover:border-emerald-400'
                }`}
              >
                {/* Top Badge: BEST VALUE */}
                <div className="absolute -top-2.5 right-3">
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                    BEST VALUE
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      3 Months
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                        selectedPlanId === 'quarterly'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {selectedPlanId === 'quarterly' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        ₹199
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      ₹66.33/month
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                  <div className="inline-block">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded-md">
                      Save ₹38
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                    ₹199 every 3 months
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* FEATURE LIST (Exact User Request) */}
          <div className="pt-2 space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Included with Pro:
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {PRO_FEATURES_LIST.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                  <span className="font-medium text-[11px] leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER NOTE (Exact User Request) */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="leading-tight">
              Secure checkout via Google Play. Auto-renews. Cancel anytime.
            </span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Main Action Button */}
          {status === 'ACTIVE' ? (
            <button
              id="btn_manage_subscription"
              onClick={openGooglePlayManageSubscriptions}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Manage Google Play Subscription</span>
            </button>
          ) : (
            <button
              id="btn_subscribe_cta"
              disabled={isProcessing || productState.isLoading}
              onClick={handleStartPurchase}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              <span>
                {isProcessing
                  ? processingStatus || 'Processing...'
                  : selectedPlan.ctaText}
              </span>
            </button>
          )}

          {/* Secondary Actions */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            <button
              id="btn_restore_purchase"
              disabled={isProcessing}
              onClick={handleRestore}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Purchase</span>
            </button>
            <button
              id="btn_close_modal_bottom"
              onClick={onClose}
              className="hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
            >
              {isLocked ? 'View-Only Mode' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
