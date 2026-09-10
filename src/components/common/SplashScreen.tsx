import React from 'react';
import { Building2 } from 'lucide-react';

interface SplashScreenProps {
  className?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ className = '' }) => {
  return (
    <div
      id="launch-splash-screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white select-none ${className}`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Center Brand Identity: PropLead Logo & App Name */}
      <div className="flex flex-col items-center justify-center text-center -mt-8">
        {/* Logo Container */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/25">
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
      </div>

      {/* Bottom Footer / Trust Badge */}
      <div
        className="absolute bottom-6 left-0 right-0 text-center"
        style={{
          bottom: 'calc(1.5rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
        }}
      >
        <p className="text-[11px] font-semibold text-slate-400/80 dark:text-slate-500 tracking-wider uppercase">
          Real Estate CRM • Indian Property Agents
        </p>
      </div>
    </div>
  );
};
