import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PropLeadLogo } from './PropLeadLogo';
import './SplashScreen.css';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => {
  const reducedMotion = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  const reveal = (delay: number) => ({
    delay: reducedMotion ? 0 : delay,
    duration: reducedMotion ? 0 : 0.5,
    ease,
  });

  return (
    <motion.div
      id="app-splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease }}
      className={`proplead-splash fixed inset-0 z-[100] bg-white flex items-center justify-center box-border select-none overflow-hidden ${className}`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
      }}
      role="status"
      aria-label="Preparing PropLead"
    >
      {/* Fixed grid tracks reserve all space before text fades in: no layout shift. */}
      <div className="grid grid-rows-[96px_36px_20px] justify-items-center gap-y-3 w-72 max-w-[calc(100vw-3rem)] text-center">
        <motion.div
          data-splash-reveal
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reveal(0)}
          className="w-24 h-24 bg-transparent"
        >
          <PropLeadLogo className="w-24 h-24" showShadow={false} alt="" />
        </motion.div>
        <motion.h1
          data-splash-reveal
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reveal(0.16)}
          className="m-0 text-[28px] leading-9 font-semibold tracking-[-0.035em] text-slate-900"
        >
          Prop<span className="text-emerald-700">Lead</span>
        </motion.h1>
        <motion.p
          data-splash-reveal
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reveal(0.3)}
          className="m-0 text-[11px] leading-5 font-medium tracking-[0.08em] text-slate-500"
        >
          Property Agent CRM
        </motion.p>
      </div>
    </motion.div>
  );
};
