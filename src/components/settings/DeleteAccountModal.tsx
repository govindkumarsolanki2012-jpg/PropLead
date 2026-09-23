import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  X,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { openGooglePlayManageSubscriptions, getBillingApiUrl } from '../../utils/billing';
import { deleteAllUserStorageFiles } from '../../utils/attachmentStorage';
import { clearUserScopedStorage } from '../../utils/storage';
import { cancelAllUserNotifications } from '../../utils/notifications';
import { Lead } from '../../types';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
  currentUserEmail?: string | null;
  leads?: Lead[];
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountDeleted,
  currentUserEmail,
  leads = [],
}) => {
  const [confirmText, setConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletionResult, setDeletionResult] = useState<'confirm' | 'success' | 'partial'>('confirm');
  const finalizingRef = useRef<boolean>(false);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

  const finishAndReturnToSignIn = async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    try {
      // The backend deletes the Firebase Auth user before returning success.
      // Explicitly end the local Firebase session so no stale authenticated
      // dashboard can remain visible with a now-deleted account.
      await auth.signOut();
      onAccountDeleted();
    } catch (signOutErr) {
      console.error('[Account Deletion] Local Firebase sign-out failed:', signOutErr);
      setDeletionResult('partial');
      finalizingRef.current = false;

      // Never leave the deleted account inside the dashboard, even if the
      // local Firebase SDK could not complete sign-out cleanly.
      window.setTimeout(onAccountDeleted, 2000);
    }
  };

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setErrorMessage('You must be signed in to delete your account.');
      setIsDeleting(false);
      return;
    }

    const deletedUserId = currentUser.uid;

    try {
      // Obtain a fresh Firebase ID token for the authenticated backend request.
      const idToken = await currentUser.getIdToken(true);
      const deleteApiUrl = getBillingApiUrl('/api/account/delete');
      const res = await fetch(deleteApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: deletedUserId,
          email: currentUser.email,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.success === false)) {
        throw new Error(data?.error || data?.message || 'Server failed to delete user data.');
      }

      // The backend has now deleted Firestore data, Storage objects where
      // configured, and the Firebase Auth account. Complete device cleanup.
      await Promise.allSettled([
        deleteAllUserStorageFiles(deletedUserId),
        cancelAllUserNotifications(leads),
      ]);

      clearUserScopedStorage(deletedUserId);
      try {
        sessionStorage.removeItem('proplead_pending_lead_id');
      } catch {}

      setIsDeleting(false);
      setDeletionResult('success');

      // Give the user a brief confirmation before returning to sign-in.
      window.setTimeout(() => {
        void finishAndReturnToSignIn();
      }, 1600);
    } catch (err: any) {
      console.error('[Account Deletion Error]', err);
      setErrorMessage(
        err?.message || 'An error occurred while deleting your account. Please try again or contact support.'
      );
      setIsDeleting(false);
    }
  };

  if (deletionResult !== 'confirm') {
    const isPartial = deletionResult === 'partial';
    return (
      <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xl dark:border-emerald-900/60 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Account deleted
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Your PropLead account and saved data have been deleted.
          </p>
          {isPartial && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Your PropLead data was deleted, but we could not fully remove the sign-in account. Please sign in again to finish account deletion.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            If you had an active Google Play subscription, manage or cancel it separately in Google Play.
          </p>
          <button
            type="button"
            onClick={() => void finishAndReturnToSignIn()}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-black/70 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] backdrop-blur-xs animate-in fade-in duration-200 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl dark:border-rose-900/60 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 dark:text-rose-100">
                Delete Account &amp; All Data
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Permanent and irreversible action
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-8 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Are you sure you want to delete your PropLead account?
          </p>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              The following will be permanently erased immediately:
            </span>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li>All leads, client contact numbers, and WhatsApp logs</li>
              <li>All property listings, photos, and private owner contacts</li>
              <li>All voice memos, follow-up schedules, and visit reminders</li>
              <li>Your agent profile and Firebase cloud backups</li>
            </ul>
          </div>

          {/* Critical Google Play Notice */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Important Google Play Subscription Notice</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
              Deleting your PropLead account <strong>does not automatically cancel</strong> your active Google Play subscription. Google requires you to cancel recurring subscriptions directly inside the Google Play Store to stop future billing cycles.
            </p>
            <button
              type="button"
              onClick={openGooglePlayManageSubscriptions}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
            >
              <span>Manage Google Play Subscriptions</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Confirm input */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Type <span className="font-black text-rose-600 dark:text-rose-400">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onFocus={(e) => {
                const input = e.currentTarget;
                window.setTimeout(() => {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 250);
              }}
              placeholder="DELETE"
              disabled={isDeleting}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-850">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isConfirmed || isDeleting}
            onClick={handleDelete}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting Account...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Permanently Delete Everything</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
