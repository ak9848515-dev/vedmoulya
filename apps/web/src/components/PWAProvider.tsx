'use client';

import { useEffect } from 'react';

export function PWAProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed — PWA features unavailable
      });
    }
  }, []);

  return children;
}
