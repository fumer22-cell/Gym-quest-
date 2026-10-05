import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installBackdrop, installFloor } from './ui/art/render';
import { App } from './ui/App';
import './styles.css';
import './game.css';

// Ask the browser not to evict our offline data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

installBackdrop();
installFloor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: cache the whole app after the first visit (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
