import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

interface ToastNotificationProps {
  message: string | null;
  isError?: boolean;
}

/** Render outside modal/frame overflow and stacking contexts. */
export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, isError = false }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed left-0 right-0 z-[9999] pointer-events-none flex justify-center px-4"
      style={{
        bottom: 'calc(6rem + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role={isError ? 'alert' : 'status'}
            className={`w-fit max-w-md min-w-0 px-4 py-3 text-center text-white rounded-2xl text-xs font-semibold leading-relaxed shadow-xl border break-words ${
              isError ? 'bg-rose-600 border-rose-700' : 'bg-slate-900/95 border-slate-700'
            }`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};
