/**
 * Global App Toast Dispatcher
 * Dispatches a lightweight event to App.tsx to show a consistent toast notification.
 */
export function showAppToast(message: string, isError = false): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('proplead:show-toast', {
        detail: { message, isError },
      })
    );
  }
}
