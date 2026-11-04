import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

// Register Service Worker for PWA installability and offline support
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        // Trigger update check and activate waiting worker immediately
        registration.update().catch(() => {});
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.warn('PWA ServiceWorker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

