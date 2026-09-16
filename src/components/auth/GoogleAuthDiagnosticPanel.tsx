import React, { useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthDiagnosticEntry,
  subscribeToGoogleAuthDiagnostics,
} from '../../utils/googleAuthDiagnostics';

const STAGES = [
  'Google button clicked',
  'Native PropLeadSocialLogin called',
  'Credential Manager callback received',
  'Credential type received',
  'Google credential parsed successfully',
  'ID token received: YES/NO',
  'Native Capacitor call resolved/rejected',
  'TypeScript received native result',
  'Firebase credential created',
  'Firebase signInWithCredential started',
  'Firebase signInWithCredential SUCCESS/FAILED',
  'Firebase auth-state listener fired',
  'Final authentication state',
] as const;

export const GoogleAuthDiagnosticPanel: React.FC = () => {
  const [entries, setEntries] = useState<GoogleAuthDiagnosticEntry[]>([]);

  useEffect(() => subscribeToGoogleAuthDiagnostics(setEntries), []);

  const byStage = useMemo(
    () => new Map(entries.map((entry) => [entry.stage, entry])),
    [entries]
  );

  if (entries.length === 0) return null;

  return (
    <section
      aria-live="polite"
      className="mt-4 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/90 p-3 text-left dark:border-sky-700 dark:bg-sky-950/40"
    >
      <div className="mb-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
          Temporary Google Sign-In diagnostics
        </p>
        <p className="text-[10px] text-sky-700/80 dark:text-sky-300/80">
          Internal testing only — remove after Google Sign-In is fixed. No account or token data is shown.
        </p>
      </div>

      <ol className="space-y-1.5">
        {STAGES.map((label, index) => {
          const stage = index + 1;
          const entry = byStage.get(stage);
          const stateLabel =
            entry?.status === 'success'
              ? 'PASS'
              : entry?.status === 'failed'
                ? 'FAIL'
                : entry?.status === 'pending'
                  ? 'WAIT'
                  : entry
                    ? 'INFO'
                    : '—';
          const stateClass =
            entry?.status === 'success'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : entry?.status === 'failed'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                : entry?.status === 'pending'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

          return (
            <li key={stage} className="rounded-lg bg-white/80 px-2 py-1.5 dark:bg-slate-900/70">
              <div className="flex items-start gap-2">
                <span className="w-4 shrink-0 text-[10px] font-bold text-slate-500">{stage}.</span>
                <span className="min-w-0 flex-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                  {label}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-black ${stateClass}`}>
                  {stateLabel}
                </span>
              </div>
              {entry?.detail && (
                <p className="mt-1 pl-6 text-[10px] text-slate-600 dark:text-slate-400">
                  {entry.detail}
                </p>
              )}
              {entry?.status === 'failed' && (
                <p className="mt-1 pl-6 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  Stage {stage}
                  {entry.errorCode ? ` · ${entry.errorCode}` : ''}
                  {entry.errorMessage ? ` · ${entry.errorMessage}` : ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
