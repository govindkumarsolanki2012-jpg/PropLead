import {StrictMode, useEffect} from 'react';
import {Capacitor, registerPlugin} from '@capacitor/core';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure Light Mode is permanently active and cleanup any legacy theme data
try {
  localStorage.removeItem('proplead_theme_v1');
  document.documentElement.classList.remove('dark');
} catch (e) {
  // fallback
}

const NativeLaunchSplash = registerPlugin<{
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
}>('SplashScreen');
let nativeSplashHidden = false;

function NativeSplashHandoff() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || nativeSplashHidden) return;
    let secondFrame = 0;
    // Start after React commits and the neutral first frame can be painted.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        nativeSplashHidden = true;
        void NativeLaunchSplash.hide({ fadeOutDuration: 0 }).catch((error) => {
          console.warn('Native launch splash hide failed:', error);
        });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <NativeSplashHandoff />
  </StrictMode>,
);

