import {StrictMode} from 'react';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

