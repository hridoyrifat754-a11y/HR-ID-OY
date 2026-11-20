import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import './index.css';

// Register VitePWA Service Worker with automatic background update detection
// Ensures Android PWA / WebAPK receives website updates without re-installing APK
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    (window as unknown as { __applyAlamKhanUpdate?: () => void }).__applyAlamKhanUpdate = () => {
      updateSW(true);
    };
    window.dispatchEvent(new CustomEvent('alam-khan-sw-update'));
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Periodically check for updates every 15 minutes and whenever app regains focus
      setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      }, 15 * 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {});
        }
      });
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
