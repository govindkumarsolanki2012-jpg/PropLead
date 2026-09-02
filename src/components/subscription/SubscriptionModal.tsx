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
  Play,
  RotateCcw,
} from 'lucide-react';
import { UserProfile, GooglePlaySubscriptionProduct } from '../../types';
import {
  fetchGooglePlayProduct,
  launchGooglePlayPurchase,
  restoreGooglePlayPurchases,
  getEffectiveSubscriptionStatus,
  openGooglePlayManageSubscriptions,
  openGooglePlayFixPayment,
  simulateBillingState,
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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<GooglePlaySubscriptionProduct | null>(null);
  const [showTestingSuite, setShowTestingSuite] = useState<boolean>(false);

  const { status, daysRemaining, expiryFormatted, isSubscribed, isLocked } =
    getEffectiveSubscriptionStatus(profile);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      fetchGooglePlayProduct().then((prod) => setProductDetails(prod));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPurchase = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStatus('Starting Google Play Billing flow...');

    try {
      const result = await launchGooglePlayPurchase(profile.id, (step) => {
        setProcessingStatus(step);
      });

      if (result.success && result.profileUpdates) {
        onUpdateProfile(result.profileUpdates);
        onSubscribe?.('property_agent_pro');
        setSuccessMessage('🎉 Subscription activated successfully via Google Play!');

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

  const handleSimulate = async (targetState: any, customDays?: number) => {
    setIsProcessing(true);
    const result = await simulateBillingState(profile.id, targetState, customDays);
    if (result.success && result.profileUpdates) {
      onUpdateProfile(result.profileUpdates);
      setSuccessMessage(`Simulated state updated: ${targetState}`);
    }
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="relative p-6 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white text-center pb-7">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 text-white border border-white/30 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-white">
            Never Miss Another Property Lead
          </h2>
          <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto leading-relaxed">
            Keep your property leads, customers, follow-ups and property matching organized.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
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

          {/* Current State Indicator */}
          {status === 'ACTIVE' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-emerald-800 dark:text-emerald-200">
                  Pro Subscription Active
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                Auto-renews at ₹49/mo
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
                {profile.paymentIssueMessage || 'Google Play could not renew your ₹49/month subscription. Please update your payment method.'}
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

          {/* Pricing Box */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                ₹49<span className="text-sm font-semibold text-slate-500">/month</span>
              </div>
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                30-day free trial
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Auto-renewing monthly subscription • Cancel anytime
              </p>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-xs">
              Google Play
            </div>
          </div>

          {/* Feature Checklist (Exact User Request) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Included with Pro
            </div>

            {[
              'Lead management',
              'Customer profiles',
              'Follow-up reminders',
              'Property matching',
              'WhatsApp sharing',
              'Property database',
              'Activity history',
              'Cloud data',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* Google Play Billing Assurance */}
          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Secure Google Play Billing. You will only be billed ₹49/month after the 30-day trial ends.
            </span>
          </div>

          {/* Testing Simulator Toolbar for Verification */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowTestingSuite(!showTestingSuite)}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline block mx-auto font-medium"
            >
              {showTestingSuite ? 'Hide Test Suite' : '🛠️ Google Play Billing & Trial Test Suite (17 Scenarios)'}
            </button>

            {showTestingSuite && (
              <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800/90 rounded-2xl space-y-2.5 text-xs border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                  Simulate Account & Google Play States:
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <button
                    onClick={() => handleSimulate('TRIAL', 30)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border font-medium text-left hover:border-emerald-500"
                  >
                    1. Trial: 30 Days Left
                  </button>
                  <button
                    onClick={() => handleSimulate('TRIAL', 15)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border font-medium text-left hover:border-emerald-500"
                  >
                    2. Trial: 15 Days Left
                  </button>
                  <button
                    onClick={() => handleSimulate('TRIAL', 7)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border font-medium text-left hover:border-amber-500"
                  >
                    3. Trial: 7 Days Left
                  </button>
                  <button
                    onClick={() => handleSimulate('TRIAL', 1)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg border font-medium text-left hover:border-amber-500"
                  >
                    4. Trial: 1 Day Left
                  </button>
                  <button
                    onClick={() => handleSimulate('EXPIRED')}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-300 font-bold text-left"
                  >
                    5. Trial Expired (0 Days)
                  </button>
                  <button
                    onClick={() => handleSimulate('ACTIVE')}
                    className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-300 font-bold text-left"
                  >
                    6. Active Pro Subscriber
                  </button>
                  <button
                    onClick={() => handleSimulate('CANCELED_BUT_ACTIVE')}
                    className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg border border-blue-300 font-medium text-left"
                  >
                    7. Canceled (Active till date)
                  </button>
                  <button
                    onClick={() => handleSimulate('PAYMENT_ISSUE')}
                    className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-300 font-bold text-left"
                  >
                    8. Payment Issue (Grace)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {/* Main Action Button */}
          {status === 'ACTIVE' ? (
            <button
              onClick={openGooglePlayManageSubscriptions}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Manage Google Play Subscription</span>
            </button>
          ) : (
            <button
              disabled={isProcessing}
              onClick={handleStartPurchase}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              <span>
                {isProcessing
                  ? processingStatus || 'Processing...'
                  : status === 'TRIAL' && daysRemaining > 0
                  ? 'Start Free Trial (₹49/mo after 30d)'
                  : 'Subscribe for ₹49/month'}
              </span>
            </button>
          )}

          {/* Secondary Actions */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <button
              disabled={isProcessing}
              onClick={handleRestore}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Purchase</span>
            </button>
            <button
              onClick={onClose}
              className="hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            >
              {isLocked ? 'View-Only Mode' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
