import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PropLeadLogo } from './PropLeadLogo';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => {
  const reducedMotion = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.div
      id="app-splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease }}
      className={`fixed inset-0 z-[100] bg-[#ECE5DD] dark:bg-[#111B21] select-none overflow-hidden ${className}`}
      role="status"
      aria-label="Preparing PropLead"
    >
      {/* Keep the logo at its final size and position throughout both text fades. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <PropLeadLogo className="w-24 h-24" showShadow={false} />
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 w-72 max-w-[calc(100vw-3rem)] px-3 text-center">
          <motion.h1
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.22, duration: reducedMotion ? 0 : 0.48, ease }}
            className="text-[28px] font-semibold tracking-[-0.035em] text-slate-900 dark:text-slate-100 leading-[1.2]"
          >
            Prop<span className="text-emerald-700 dark:text-emerald-400">Lead</span>
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.36, duration: reducedMotion ? 0 : 0.42, ease }}
            className="text-[11px] font-medium text-slate-600 dark:text-slate-400 tracking-[0.08em] leading-relaxed mt-2.5"
          >
            Property Agent CRM
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
};
