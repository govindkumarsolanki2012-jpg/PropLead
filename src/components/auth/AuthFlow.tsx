import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Users,
  Home,
  Cloud,
  FlaskConical,
} from 'lucide-react';
import { signInWithGoogle, signInWithDeveloperAccount } from '../../services/firebaseService';

interface AuthFlowProps {
  onSuccess?: () => void;
}

export const AuthFlow: React.FC<AuthFlowProps> = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [devLoading, setDevLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeveloperSignIn = async () => {
    setErrorMessage(null);
    try {
      setDevLoading(true);
      await signInWithDeveloperAccount();
    } catch (err: any) {
      console.error('[AuthFlow] Developer login error:', err);
      setErrorMessage(err?.message || 'Failed to sign in with developer account.');
    } finally {
      setDevLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    try {
      setLoading(true);
      // Authoritative Firebase Google Authentication
      await signInWithGoogle();
      // On success, onAuthStateChanged in App.tsx detects the user session,
      // syncs/initializes the Firestore profile and 30-day trial, and opens the Dashboard.
    } catch (err: any) {
      console.error('[AuthFlow] Google sign-in error:', err);
      const msg = err?.message || String(err || '');
      const isTechnicalError =
        msg.includes('16') ||
        msg.includes('28444') ||
        msg.includes('10:') ||
        msg.toLowerCase().includes('reauth') ||
        msg.toLowerCase().includes('developer') ||
        msg.toLowerCase().includes('failed') ||
        msg.toLowerCase().includes('exception');

      const isCancelled =
        !isTechnicalError &&
        (err?.code === 'auth/popup-closed-by-user' ||
          err?.code === 'USER_CANCELLED' ||
          msg.toLowerCase().includes('user cancelled') ||
          msg.toLowerCase().includes('user canceled') ||
          msg === 'Google Sign-In cancelled by user');

      if (isCancelled) {
        setErrorMessage(null); // User intentionally dismissed the bottom sheet / dialog
      } else if (err?.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error. Please check your internet connection.');
      } else if (err?.message) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Could not sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-6 relative overflow-y-auto"
      style={{
        paddingTop: 'calc(1.5rem + max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)))',
        paddingBottom: 'calc(1rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/25 mb-4">
            <Building2 className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            PropLead
          </h1>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-wider">
            Property Agent Lead & Follow-up Tracker
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Close property deals faster with intelligent lead tracking, automated matching, and multi-device cloud sync.
          </p>
        </div>

        {/* Feature Highlights Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6 space-y-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Lead Pipeline & Follow-Up Reminders
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Never lose track of a client or site visit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Automated Inventory Matching
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Match buyer preferences to listings in 1 tap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                30-Day Pro Trial Included
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Full access automatically activated for new accounts
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Action: Continue with Google */}
        <div className="space-y-3">
          <button
            id="btn-google-auth"
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-4 px-5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-extrabold rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-lg shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-3 text-sm transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            One tap to sign in to your existing account or create a new account.
          </p>

          {/* DEVELOPER / TEST LOGIN BUTTON */}
          <div className="pt-3 border-t border-dashed border-amber-300 dark:border-amber-700/60">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                <FlaskConical className="w-3 h-3" />
                DEVELOPER / TEST MODE
              </span>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Fixed UID • 30D Trial
              </span>
            </div>
            <button
              id="btn-developer-login"
              type="button"
              disabled={loading || devLoading}
              onClick={handleDeveloperSignIn}
              className="w-full py-3.5 px-4 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-bold rounded-2xl border-2 border-dashed border-amber-400 dark:border-amber-600 flex items-center justify-center gap-2.5 text-xs transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {devLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-700 dark:text-amber-400" />
                  <span>Logging in with Developer Account...</span>
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  <span>Developer Login (Bypass Native Google Block)</span>
                </>
              )}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-amber-800/80 dark:text-amber-400/80">
              Signs into Firebase Auth directly. Full Firestore persistence, leads, properties, and 30-day trial enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="pt-4 pb-2 text-center border-t border-slate-100 dark:border-slate-800">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected by Firebase Authentication & Cloud Firestore</span>
        </div>
      </div>
    </div>
  );
};
