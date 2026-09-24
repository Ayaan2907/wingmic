'use client';

import { useEffect } from 'react';

/**
 * Production-only PWA registration guard. Dev never registers, so hot
 * reload and local API calls stay untouched.
 */
export function shouldRegisterServiceWorker(env: string | undefined): boolean {
  return env === 'production';
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!shouldRegisterServiceWorker(process.env.NODE_ENV)) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      // Registration failure is non-fatal — the app works fully without the
      // SW (no offline shell), so it surfaces as a warning, never a crash.
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[pwa] service worker registration failed', error);
      });
    };

    if (document.readyState === 'complete') {
      void register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
