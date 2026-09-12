import React from 'react';
import { Building2 } from 'lucide-react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => {
  return (
    <motion.div
      id="launch-splash-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: {
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white select-none pointer-events-auto ${className}`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Center Brand Identity: PropLead Logo & App Name */}
      <motion.div
        initial={{ opacity: 0.92, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{
          opacity: 0,
          scale: 0.96,
          transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
        }}
        className="flex flex-col items-center justify-center text-center -mt-8"
      >
        {/* Logo Container */}
        <div className="w-20 h-20 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-600/25">
          <Building2 className="w-10 h-10 stroke-[2.2]" />
        </div>

        {/* App Name */}
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-4 h-8 leading-8">
          Prop<span className="text-emerald-600 dark:text-emerald-400">Lead</span>
        </h1>

        {/* Tagline */}
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2 h-4 leading-4">
          Property Agent Lead Tracker
        </p>
      </motion.div>

      {/* Bottom Footer / Trust Badge */}
      <motion.div
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        className="absolute bottom-6 left-0 right-0 text-center"
        style={{
          bottom: 'calc(1.5rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
        }}
      >
        <p className="text-[11px] font-semibold text-slate-400/80 dark:text-slate-500 tracking-wider uppercase">
          Real Estate CRM • Indian Property Agents
        </p>
      </motion.div>
    </motion.div>
  );
};
