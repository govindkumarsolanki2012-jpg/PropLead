import React from 'react';
import { motion } from 'motion/react';
import { PropLeadLogo } from './PropLeadLogo';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => (
  <motion.div
    id="app-splash-screen"
    initial={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    className={`fixed inset-0 z-[100] bg-[#ECE5DD] dark:bg-[#111B21] select-none overflow-hidden ${className}`}
    role="status"
    aria-label="Preparing PropLead"
  >
    {/* Absolute centering keeps the emblem stationary when the text appears. */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <PropLeadLogo className="w-24 h-24" showShadow={false} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.25 }}
        className="absolute top-full left-1/2 -translate-x-1/2 mt-5 w-72 px-3 text-center"
      >
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
          Prop<span className="text-emerald-600 dark:text-emerald-400">Lead</span>
        </h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide mt-2">
          Property Agent CRM
        </p>
      </motion.div>
    </div>
  </motion.div>
);
