import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.proplead.tracker',
  appName: 'PropLead',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#059669',
    },
  },
};

export default config;
