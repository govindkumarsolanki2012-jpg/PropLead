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
  getContacts?(): Promise<{
    contacts: Array<{
      contactId: string;
      displayName: string;
      phoneNumber: string;
    }>;
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
  const isNative = Capacitor.isNativePlatform();
  console.log(`[Permissions] PERMISSION_PATH=${isNative ? 'native' : 'fallback'}`);

  if (!isNative) {
    console.log('[Permissions] CONTACTS_PERMISSION_NATIVE=granted (web/dev)');
    return { state: 'granted', isPermanentlyDenied: false };
  }

  // 1. Direct native Android checkSelfPermission via AppSettingsPlugin
  try {
    const nativeRes = await AppSettings.checkPermission({ name: 'contacts' });
    console.log('[Permissions] NATIVE_PLUGIN_AVAILABLE=yes');
    if (nativeRes && typeof nativeRes.granted === 'boolean') {
      const nativeState: PermissionState = nativeRes.granted ? 'granted' : (nativeRes.state || 'prompt');
      console.log(`[Permissions] CONTACTS_PERMISSION_NATIVE=${nativeRes.granted ? 'granted' : 'denied'} state=${nativeState} permanentlyDenied=${Boolean(nativeRes.isPermanentlyDenied)}`);
      
      if (nativeRes.granted) {
        return { state: 'granted', isPermanentlyDenied: false };
      }
      return {
        state: nativeState,
        isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
      };
    }
  } catch (err) {
    console.log('[Permissions] NATIVE_PLUGIN_AVAILABLE=no error:', err);
  }

  // 2. Fallback to @capacitor-community/contacts checkPermissions only if AppSettings failed
  try {
    const status = await Contacts.checkPermissions();
    const contactsState = status?.contacts;
    console.log(`[Permissions] Fallback Contacts.checkPermissions returned: ${contactsState}`);

    if (contactsState === 'granted') {
      console.log('[Permissions] CONTACTS_PERMISSION_NATIVE=granted');
      return { state: 'granted', isPermanentlyDenied: false };
    }
    if (contactsState === 'denied') {
      console.log('[Permissions] CONTACTS_PERMISSION_NATIVE=denied');
      return { state: 'denied', isPermanentlyDenied: true };
    }
    return { state: 'prompt', isPermanentlyDenied: false };
  } catch (err) {
    console.warn('[Permissions] Fallback notice checking contacts permission:', err);
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

  // Request via AppSettings plugin
  try {
    const nativeRes = await AppSettings.requestPermission({ name: 'contacts' });
    if (nativeRes && typeof nativeRes.granted === 'boolean') {
      console.log(`[Permissions] CONTACTS_PERMISSION_NATIVE=${nativeRes.granted ? 'granted' : 'denied'} state=${nativeRes.state}`);
      if (nativeRes.granted) {
        return { state: 'granted', isPermanentlyDenied: false };
      }
      return {
        state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
        isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
      };
    }
  } catch (err) {
    console.warn('[Permissions] AppSettings requestPermission error:', err);
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
    console.warn('[Permissions] Fallback notice requesting contacts permission:', err);
    return { state: 'denied', isPermanentlyDenied: false };
  }
}

/**
 * Reads contacts natively from Android using AppSettingsPlugin (which requires only READ_CONTACTS),
 * falling back to @capacitor-community/contacts if needed.
 */
export async function getNativeDeviceContacts(): Promise<Array<{ id: string; name: string; phone: string }>> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  // 1. Prefer AppSettings direct ContentResolver (requires only READ_CONTACTS)
  try {
    if (AppSettings.getContacts) {
      const res = await AppSettings.getContacts();
      if (res && Array.isArray(res.contacts)) {
        return res.contacts.map((c) => ({
          id: c.contactId || `dev_${Math.random()}`,
          name: c.displayName || 'Client',
          phone: c.phoneNumber || '',
        }));
      }
    }
  } catch (err) {
    console.debug('[Permissions] AppSettings getContacts fallback notice:', err);
  }

  // 2. Fallback to Contacts plugin
  try {
    const result = await Contacts.getContacts({
      projection: {
        name: true,
        phones: true,
        postalAddresses: true,
      },
    });
    const rawContacts = result?.contacts || [];
    return rawContacts.map((rc, i) => {
      const displayName =
        rc.name?.display?.trim() ||
        [rc.name?.given, rc.name?.middle, rc.name?.family].filter(Boolean).join(' ').trim() ||
        'Client';
      const phone = rc.phones?.[0]?.number?.trim() || '';
      return {
        id: rc.contactId || `dev_${Date.now()}_${i}`,
        name: displayName,
        phone,
      };
    });
  } catch (err) {
    console.warn('[Permissions] Contacts plugin read error:', err);
    throw err;
  }
}

/**
 * Checks the CURRENT live permission state for RECORD_AUDIO / Microphone.
 * Queries the native Android OS layer directly on Android, or navigator.permissions on Web.
 */
export async function checkMicrophonePermission(): Promise<NativePermissionResult> {
  const isNative = Capacitor.isNativePlatform();
  console.log(`[Permissions] MIC PERMISSION_PATH=${isNative ? 'native' : 'fallback'}`);

  if (isNative) {
    try {
      const nativeRes = await AppSettings.checkPermission({ name: 'microphone' });
      console.log('[Permissions] NATIVE_PLUGIN_AVAILABLE=yes');
      if (nativeRes && typeof nativeRes.granted === 'boolean') {
        const nativeState: PermissionState = nativeRes.granted ? 'granted' : (nativeRes.state || 'prompt');
        console.log(`[Permissions] MIC_PERMISSION_NATIVE=${nativeRes.granted ? 'granted' : 'denied'} state=${nativeState} permanentlyDenied=${Boolean(nativeRes.isPermanentlyDenied)}`);
        
        if (nativeRes.granted) {
          return { state: 'granted', isPermanentlyDenied: false };
        }
        return {
          state: nativeState,
          isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
        };
      }
    } catch (err) {
      console.log('[Permissions] AppSettings checkPermission mic notice:', err);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log(`[Permissions] Navigator permissions microphone state: ${status.state}`);
      if (status.state === 'granted') {
        console.log('[Permissions] MIC_PERMISSION_NATIVE=granted (browser)');
        return { state: 'granted', isPermanentlyDenied: false };
      }
      if (status.state === 'denied') {
        console.log('[Permissions] MIC_PERMISSION_NATIVE=denied (browser)');
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
        console.log(`[Permissions] MIC_PERMISSION_NATIVE=${nativeRes.granted ? 'granted' : 'denied'} state=${nativeRes.state}`);
        if (nativeRes.granted) {
          return { state: 'granted', isPermanentlyDenied: false };
        }
        return {
          state: nativeRes.state || (nativeRes.isPermanentlyDenied ? 'denied' : 'prompt'),
          isPermanentlyDenied: nativeRes.isPermanentlyDenied || false,
        };
      }
    } catch (err) {
      console.warn('[Permissions] AppSettings requestPermission mic notice:', err);
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
