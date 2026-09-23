export type GoogleAuthDiagnosticStatus = 'pending' | 'success' | 'failed' | 'info';

export interface GoogleAuthDiagnosticUpdate {
  stage: number;
  status: GoogleAuthDiagnosticStatus;
  detail?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface GoogleAuthDiagnosticEntry extends GoogleAuthDiagnosticUpdate {
  timestamp: string;
}

type DiagnosticListener = (entries: GoogleAuthDiagnosticEntry[]) => void;

const listeners = new Set<DiagnosticListener>();
let entries: GoogleAuthDiagnosticEntry[] = [];
let active = false;

function notify(): void {
  const snapshot = [...entries];
  listeners.forEach((listener) => listener(snapshot));
}

export function resetGoogleAuthDiagnostics(): void {
  active = true;
  entries = [];
  notify();
}

export function isGoogleAuthDiagnosticsActive(): boolean {
  return active;
}

export function reportGoogleAuthDiagnostic(update: GoogleAuthDiagnosticUpdate): void {
  if (!active && update.stage !== 1) return;

  const safeEntry: GoogleAuthDiagnosticEntry = {
    stage: Math.min(13, Math.max(1, Number(update.stage) || 1)),
    status: update.status,
    detail: update.detail?.slice(0, 160),
    errorCode: update.errorCode?.slice(0, 80),
    errorMessage: update.errorMessage?.slice(0, 160),
    timestamp: new Date().toLocaleTimeString(),
  };

  entries = [...entries.filter((entry) => entry.stage !== safeEntry.stage), safeEntry]
    .sort((a, b) => a.stage - b.stage);
  notify();
}

export function subscribeToGoogleAuthDiagnostics(listener: DiagnosticListener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => listeners.delete(listener);
}

export function safeGoogleAuthError(error: unknown): { code: string; message: string } {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const rawCode = typeof candidate?.code === 'string' ? candidate.code : 'UNKNOWN';
  const code = /^[A-Za-z0-9_./-]{1,80}$/.test(rawCode) ? rawCode : 'UNKNOWN';

  if (
    code === 'USER_CANCELLED' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return { code, message: 'Google Sign-In was cancelled.' };
  }
  if (code === 'auth/network-request-failed') {
    return { code, message: 'A network error interrupted authentication.' };
  }
  if (code.startsWith('auth/')) {
    return { code, message: 'Firebase rejected the Google credential.' };
  }
  return { code, message: 'Google Sign-In did not complete at this stage.' };
}
