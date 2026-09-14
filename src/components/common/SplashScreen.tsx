import React from 'react';
import { motion } from 'motion/react';
import { Building2 } from 'lucide-react';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => {
  return (
    <motion.div
      id="app-splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-white dark:bg-slate-900 select-none overflow-hidden ${className}`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 1.5rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)',
      }}
    >
      {/* Top balance spacing */}
      <div className="h-6 w-full" aria-hidden="true" />

      {/* Centered App Logo & Brand (WhatsApp / YouTube style) */}
      <div className="flex flex-col items-center justify-center text-center px-4 -mt-4">
        {/* Animated App Icon: smooth subtle scale-up and fade-in */}
        <motion.div
          initial={{ opacity: 0, scale: 0.84 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.65,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative flex items-center justify-center"
        >
          {/* Subtle ambient halo */}
          <div className="absolute -inset-2 bg-emerald-500/15 dark:bg-emerald-500/20 rounded-3xl blur-md" />

          {/* Core Brand Emblem */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/25">
            <Building2 className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-xs" />
          </div>
        </motion.div>

        {/* Brand Title: smooth delayed fade-in */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-5 flex flex-col items-center"
        >
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
            Prop<span className="text-emerald-600 dark:text-emerald-400">Lead</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wide uppercase mt-1.5">
            Property Agent CRM
          </p>
        </motion.div>
      </div>

      {/* Bottom Footer Note (similar to WhatsApp 'from Meta' signature) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center px-4"
      >
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
          Real Estate Lead Engine
        </p>
      </motion.div>
    </motion.div>
  );
};
