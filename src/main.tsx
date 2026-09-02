import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Immediate early theme initialization to prevent theme flicker on boot/restart
try {
  const savedTheme = localStorage.getItem('proplead_theme_v1');
  if (
    savedTheme === 'dark' ||
    (savedTheme === null &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  }
} catch (e) {
  // fallback
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

