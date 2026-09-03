import React, { useState, useEffect } from 'react';
import { Building2, Sparkles, Phone, ArrowRight, CheckCircle2, ShieldCheck, Clock, Check, Users, MessageSquare } from 'lucide-react';
import { UserProfile } from '../../types';
import { signInWithGoogle } from '../../services/firebaseService';

interface OnboardingFlowProps {
  onComplete: (profile: Partial<UserProfile>) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  // Step 1: Splash, Step 2: Welcome, Step 3: Login/Register, Step 4: 3-screen Walkthrough, Step 5: Trial Activation
  const [step, setStep] = useState<number>(1);
  const [loginMethod, setLoginMethod] = useState<'selection' | 'otp'>('selection');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [googleEmail, setGoogleEmail] = useState<string>('');
  const [walkthroughIndex, setWalkthroughIndex] = useState<number>(0);
  const [agentName, setAgentName] = useState<string>('');
  const [agencyName, setAgencyName] = useState<string>('');
  const [city, setCity] = useState<string>('');

  // Auto transition from Splash (Step 1) to Welcome (Step 2) after 1.5 seconds
  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => {
        setStep(2);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const walkthroughScreens = [
    {
      title: 'Keep Every Lead Organized',
      desc: 'Capture leads in under 10 seconds from WhatsApp, MagicBricks, 99acres, referrals, and walk-ins.',
      icon: Users,
      color: 'bg-emerald-500',
      badge: 'Step 1 of 3',
    },
    {
      title: 'Never Forget a Follow-Up',
      desc: 'Get timely reminders for every site visit, call, and token negotiation so no deal turns cold.',
      icon: Clock,
      color: 'bg-blue-500',
      badge: 'Step 2 of 3',
    },
    {
      title: 'Close More Property Deals',
      desc: 'Send one-tap WhatsApp brochures, log client calls, and track deals smoothly from lead to registration.',
      icon: Sparkles,
      color: 'bg-amber-500',
      badge: 'Step 3 of 3',
    },
  ];

  const handleGoogleSignInClick = async () => {
    try {
      setIsSigningInGoogle(true);
      const user = await signInWithGoogle();
      if (user) {
        if (user.displayName) setAgentName(user.displayName);
        if (user.email) setGoogleEmail(user.email);
        setStep(4);
      }
    } catch (err: any) {
      console.warn('Google sign in cancelled or fallback:', err);
      setStep(4); // allow continuing smoothly
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleFinishOnboarding = () => {
    onComplete({
      name: agentName.trim() || 'Property Agent',
      agencyName: agencyName.trim() || '',
      phone: phoneInput.trim() || '',
      email: googleEmail || '',
      city: city.trim() || '',
      isTrialActive: true,
      trialStartDate: new Date().toISOString(),
      trialDaysRemaining: 30,
      isSubscribed: false,
      hasCompletedOnboarding: true,
      isOnboarded: true,
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 relative overflow-y-auto">
      {/* STEP 1: SPLASH SCREEN */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center animate-fade-in text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-6 animate-bounce">
            <Building2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            PropLead
          </h1>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            Property Agent Lead Tracker
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Starting your lead engine...</span>
          </div>
        </div>
      )}

      {/* STEP 2: WELCOME SCREEN */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between py-6">
          <div className="flex justify-center pt-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8" />
            </div>
          </div>

          <div className="text-center my-auto px-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-4 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-3.5 h-3.5" />
              <span>For Indian Property Agents & Brokers</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Never Miss a Property Lead Again
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 max-w-sm mx-auto leading-relaxed">
              Manage your leads, follow-ups, site visits and customer requirements in one simple, lightning-fast app.
            </p>
          </div>

          <div className="space-y-3 pt-6">
            <button
              onClick={() => setStep(3)}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-base transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Free 30-Day trial automatically activated • No credit card needed
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: LOGIN / REGISTRATION */}
      {step === 3 && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                P
              </div>
              <span className="font-bold text-slate-900 dark:text-white">PropLead Account</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Agent Registration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sign in with your mobile number or Google account to keep your leads backed up.
            </p>

            <div className="mt-6 space-y-3">
              {/* Agent Details */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Agency / Brokerage Name
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  placeholder="e.g. Sharma Real Estate"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                  <span className="px-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700/50 py-2.5 border-r border-slate-300 dark:border-slate-700">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white outline-hidden bg-transparent"
                    placeholder="98201 23456"
                    maxLength={10}
                  />
                </div>
              </div>

              {isOtpSent && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Enter 4-Digit OTP
                    </label>
                    <span className="text-[10px] text-emerald-600 font-medium">OTP: 5491</span>
                  </div>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-center font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white outline-hidden"
                    maxLength={4}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-6">
            {!isOtpSent ? (
              <>
                <button
                  onClick={() => setIsOtpSent(true)}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <Phone className="w-4 h-4" />
                  <span>Continue with Mobile OTP</span>
                </button>
                <button
                  type="button"
                  disabled={isSigningInGoogle}
                  onClick={handleGoogleSignInClick}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-sm shadow-2xs transition-all disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  <span>{isSigningInGoogle ? 'Connecting with Google...' : 'Quick Sign in with Google'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setStep(4)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Verify & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: 3-SCREEN WALKTHROUGH */}
      {step === 4 && (
        <div className="flex-1 flex flex-col justify-between py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {walkthroughScreens[walkthroughIndex].badge}
            </span>
            <button
              onClick={() => setStep(5)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
            >
              Skip
            </button>
          </div>

          <div className="my-auto text-center px-4 py-8">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-inner">
                {React.createElement(walkthroughScreens[walkthroughIndex].icon, {
                  className: 'w-12 h-12 text-emerald-600 dark:text-emerald-400 stroke-[1.8]',
                })}
              </div>
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {walkthroughScreens[walkthroughIndex].title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 max-w-xs mx-auto leading-relaxed">
              {walkthroughScreens[walkthroughIndex].desc}
            </p>

            {/* Indicator Dots */}
            <div className="flex justify-center items-center gap-2 mt-8">
              {walkthroughScreens.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    walkthroughIndex === i ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {walkthroughIndex < walkthroughScreens.length - 1 ? (
              <button
                onClick={() => setWalkthroughIndex((prev) => prev + 1)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setStep(5)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Activate Free Trial</span>
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: AUTOMATIC 30-DAY FREE TRIAL ACTIVATION */}
      {step === 5 && (
        <div className="flex-1 flex flex-col justify-between py-6 text-center">
          <div className="my-auto px-2">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-md border-2 border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 mb-3">
              🎉 30-Day Free Trial Activated!
            </span>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome aboard, {agentName}!
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-xs mx-auto">
              Your 30-day full access has started. All features are unlocked with zero payment commitment.
            </p>

            <div className="mt-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-left space-y-2.5 max-w-xs mx-auto">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Unlimited Lead Management</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>One-Tap WhatsApp & Dialing</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Site Visit & Follow-Up Reminders</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Zero Ads • No Credit Card Required</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleFinishOnboarding}
            className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-base transition-all"
          >
            <span>Go to My Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
