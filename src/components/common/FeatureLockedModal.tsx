import React from 'react';
import { Lock, Sparkles, Check, X } from 'lucide-react';

interface FeatureLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  featureName?: string;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export const FeatureLockedModal: React.FC<FeatureLockedModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  featureName,
  title,
  message,
  confirmText = 'View Plans',
  cancelText = 'Not Now',
}) => {
  if (!isOpen) return null;

  const displayTitle = title || 'PropLead Pro Required';
  const displayMessage =
    message ||
    (featureName && featureName !== 'Follow-Ups' && featureName !== 'Schedule Follow-Up'
      ? `Your free trial has expired. Subscribe to continue using ${featureName}.`
      : 'Your free trial has expired. Subscribe to continue managing follow-ups.');

  return (
    <div
      id="modal-feature-locked"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h3
              id="feature-locked-title"
              className="text-lg font-black text-slate-900 dark:text-white tracking-tight"
            >
              {displayTitle}
            </h3>
            <p
              id="feature-locked-message"
              className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
            >
              {displayMessage}
            </p>
          </div>

          {/* Pricing Highlight */}
          <div className="py-3 px-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-500/30 text-left space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Quarterly Plan
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Best Value (₹66.33/mo)
                </span>
              </div>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                ₹199 <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ 3 Months</span>
              </span>
            </div>

            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Monthly Plan
                </span>
                <span className="text-[11px] text-slate-400">
                  Standard flexibility
                </span>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                ₹79 <span className="text-xs font-normal text-slate-400">/ 1 Month</span>
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              id="btn-locked-view-plans"
              onClick={() => {
                onClose();
                onSubscribe();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{confirmText}</span>
            </button>

            <button
              type="button"
              id="btn-locked-not-now"
              onClick={onClose}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
