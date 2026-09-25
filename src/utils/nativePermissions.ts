import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Contacts } from '@capacitor-community/contacts';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface NativePermissionResult {
  state: PermissionState;
  isPermanentlyDenied?: boolean;
}

interface AppSettingsPluginInterface {
  openAppSettings(): Promise<{ opened: boolean }>;
  checkPermission(options: { name: 'contacts' | 'microphone' }): Promise<{
    granted: boolean;
    state: PermissionState;
    isPermanentlyDenied: boolean;
  }>;
  requestPermission(options: { name: 'contacts' | 'microphone' }): Promise<{
    granted: boolean;
    state: PermissionState;
    isPermanentlyDenied: boolean;
  }>;
}

const AppSettings = registerPlugin<AppSettingsPluginInterface>('AppSettings');

/**
 * Opens Android Application Settings screen for PropLead where user can toggle permissions.
 */
export async function openNativeAppSettings(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AppSettings.openAppSettings();
      return true;
    } catch (err) {
      console.warn('[NativePermissions] Could not open native app settings via plugin:', err);
    }
  }
  return false;
}

/**
 * Checks the CURRENT live native Android permission state for READ_CONTACTS.
 * Queries the native Android OS layer directly; never relies on cached React state.
 */
export async function checkContactsPermission(): Promise<NativePermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { state: 'granted', isPermanentlyDenied: false };
  }

  // 1. Check direct native Android checkSelfPermission via AppSettingsPlugin
  try {
    const nativeRes = await AppSettings.checkPermission({ name: 'contacts' });
    if (nativeRes && typeof nativeRes.granted === 'boolean') {
      if (nativeRes.granted) {
        return { state: 'granted', isPermanentlyDenied: false };
      }
      return {
        state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
        isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
      };
    }
  } catch (err) {
    // Fallback to community contacts plugin if custom native method failed
    console.debug('[NativePermissions] AppSettings checkPermission contacts fallback:', err);
  }

  // 2. Fallback to @capacitor-community/contacts checkPermissions
  try {
    const status = await Contacts.checkPermissions();
    const contactsState = status?.contacts;

    if (contactsState === 'granted') {
      return { state: 'granted', isPermanentlyDenied: false };
    }
    if (contactsState === 'denied') {
      return { state: 'denied', isPermanentlyDenied: true };
    }
    return { state: 'prompt', isPermanentlyDenied: false };
  } catch (err) {
    console.warn('[NativePermissions] Notice checking contacts permission:', err);
    return { state: 'prompt', isPermanentlyDenied: false };
  }
}

/**
 * Requests native Android contacts permission.
 * First checks current status so it won't request if already granted.
 */
export async function requestContactsPermission(): Promise<NativePermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { state: 'granted', isPermanentlyDenied: false };
  }

  // Check first to avoid unnecessary prompt
  const current = await checkContactsPermission();
  if (current.state === 'granted') {
    return current;
  }

  // Request via AppSettings plugin or Contacts plugin
  try {
    const nativeRes = await AppSettings.requestPermission({ name: 'contacts' });
    if (nativeRes && typeof nativeRes.granted === 'boolean') {
      if (nativeRes.granted) {
        return { state: 'granted', isPermanentlyDenied: false };
      }
      return {
        state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
        isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
      };
    }
  } catch {
    // Fallback to contacts plugin
  }

  try {
    const status = await Contacts.requestPermissions();
    const contactsState = status?.contacts;

    if (contactsState === 'granted') {
      return { state: 'granted', isPermanentlyDenied: false };
    }
    return {
      state: 'denied',
      isPermanentlyDenied: contactsState === 'denied',
    };
  } catch (err) {
    console.warn('[NativePermissions] Notice requesting contacts permission:', err);
    return { state: 'denied', isPermanentlyDenied: false };
  }
}

/**
 * Checks the CURRENT live permission state for RECORD_AUDIO / Microphone.
 * Queries the native Android OS layer directly on Android, or navigator.permissions on Web.
 */
export async function checkMicrophonePermission(): Promise<NativePermissionResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const nativeRes = await AppSettings.checkPermission({ name: 'microphone' });
      if (nativeRes && typeof nativeRes.granted === 'boolean') {
        if (nativeRes.granted) {
          return { state: 'granted', isPermanentlyDenied: false };
        }
        return {
          state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
          isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
        };
      }
    } catch (err) {
      console.debug('[NativePermissions] AppSettings checkPermission microphone fallback:', err);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'granted') {
        return { state: 'granted', isPermanentlyDenied: false };
      }
      if (status.state === 'denied') {
        return { state: 'denied', isPermanentlyDenied: true };
      }
      return { state: 'prompt', isPermanentlyDenied: false };
    } catch {
      // Some WebViews don't support query for 'microphone'
    }
  }

  return { state: 'prompt', isPermanentlyDenied: false };
}

/**
 * Requests native Android microphone permission.
 */
export async function requestMicrophonePermission(): Promise<NativePermissionResult> {
  if (Capacitor.isNativePlatform()) {
    const current = await checkMicrophonePermission();
    if (current.state === 'granted') {
      return current;
    }

    try {
      const nativeRes = await AppSettings.requestPermission({ name: 'microphone' });
      if (nativeRes && typeof nativeRes.granted === 'boolean') {
        if (nativeRes.granted) {
          return { state: 'granted', isPermanentlyDenied: false };
        }
        return {
          state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
          isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
        };
      }
    } catch {
      // Fallback
    }
  }

  return { state: 'prompt', isPermanentlyDenied: false };
}

/**
 * Registers an app resume listener across Android native lifecycle (CapApp appStateChange)
 * and Web (visibilitychange / window focus) to re-evaluate permissions when user returns from Settings.
 */
export function registerAppResumeListener(onResume: () => void): () => void {
  let appStateHandle: PluginListenerHandle | null = null;
  let isCleanedUp = false;

  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        onResume();
      }
    })
      .then((handle) => {
        if (isCleanedUp) {
          handle.remove();
        } else {
          appStateHandle = handle;
        }
      })
      .catch(() => {});
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      onResume();
    }
  };

  const handleWindowFocus = () => {
    onResume();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);

  return () => {
    isCleanedUp = true;
    if (appStateHandle) {
      appStateHandle.remove();
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
  };
}
