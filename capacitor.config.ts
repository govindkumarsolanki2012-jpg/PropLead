import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.proplead.tracker',
  appName: 'PropLead for Agents',
  webDir: 'dist',
  backgroundColor: '#ECE5DD',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    backgroundColor: '#ECE5DD',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      backgroundColor: '#ECE5DD',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_proplead',
      iconColor: '#059669',
    },
  },
};

export default config;
