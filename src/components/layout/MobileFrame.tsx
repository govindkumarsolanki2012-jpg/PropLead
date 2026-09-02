import React, { useState } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Sparkles } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  darkMode: boolean;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children, darkMode }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(false);
  const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} transition-colors duration-200`}>
      {/* Desktop view switcher bar (visible on large screens only) */}
      <div className="hidden lg:flex items-center justify-between px-6 py-2.5 bg-slate-900 text-slate-300 text-xs border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-semibold text-white tracking-wide">PropLead • Property Agent Lead Tracker</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Indian Real Estate Broker Edition</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setIsPhoneFrame(false)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                !isPhoneFrame
                  ? 'bg-emerald-600 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Full Screen View</span>
            </button>
            <button
              onClick={() => setIsPhoneFrame(true)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                isPhoneFrame
                  ? 'bg-emerald-600 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Mobile Frame</span>
            </button>
          </div>
        </div>
      </div>

      {/* Frame Container */}
      <div className={`mx-auto ${isPhoneFrame ? 'py-8 flex justify-center items-center min-h-[calc(100vh-45px)]' : ''}`}>
        {isPhoneFrame ? (
          /* Realistic Android Phone Mockup Frame */
          <div className="relative w-[412px] h-[860px] bg-slate-900 rounded-[44px] p-3 shadow-2xl ring-1 ring-slate-800 ring-offset-4 ring-offset-slate-950 flex flex-col overflow-hidden">
            {/* Top Phone Speaker / Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-800 ring-1 ring-emerald-500/20"></div>
            </div>

            {/* Android Status Bar */}
            <div className="h-7 w-full flex items-center justify-between px-6 text-[11px] font-medium tracking-tight text-slate-400 select-none z-40 bg-white dark:bg-slate-900 pt-1">
              <span>{currentTime}</span>
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-semibold">5G</span>
                <Battery className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* App Screen inside phone */}
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900 rounded-[32px] overflow-hidden flex flex-col relative border border-slate-200 dark:border-slate-800">
              {children}
            </div>

            {/* Android Navigation Gesture Pill */}
            <div className="h-4 w-full flex items-center justify-center bg-slate-900">
              <div className="w-32 h-1 bg-slate-600 rounded-full"></div>
            </div>
          </div>
        ) : (
          /* Full Responsive View */
          <div className="w-full max-w-2xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-900 shadow-xl sm:border-x sm:border-slate-200 dark:sm:border-slate-800 relative flex flex-col">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
