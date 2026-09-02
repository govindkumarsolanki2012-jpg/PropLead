import React from 'react';
import { Lock, Sparkles, Check, X } from 'lucide-react';

interface FeatureLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  featureName?: string;
}

export const FeatureLockedModal: React.FC<FeatureLockedModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  featureName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Your free trial has ended.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Continue using Property Agent Lead Tracker for:
            </p>
          </div>

          {/* Pricing Highlight */}
          <div className="py-3 px-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-500/30">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              ₹49<span className="text-sm font-semibold text-slate-500 dark:text-slate-400">/month</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Keep full unlimited access to your leads & inventory
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                onClose();
                onSubscribe();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Subscribe</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
