import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vedmoulya.app',
  appName: 'VedMoulya',
  webDir: 'out',
  server: {
    // Serve the static bundle over https://localhost inside the WebView so
    // service workers and absolute gateway URLs behave like a real origin.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
