import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installBackdrop } from './ui/art/render';
import { App } from './ui/App';
import './styles.css';

// Ask the browser not to evict our offline data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

installBackdrop();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
