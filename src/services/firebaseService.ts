import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, auth, googleProvider, FirebaseUser } from '../lib/firebase';
import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import firebaseConfig from '../../firebase-applet-config.json';
import { Lead, Property, UserProfile, WhatsAppTemplate } from '../types';

// Known legacy demo IDs to filter out and purge from Firestore if ever present
const DEMO_LEAD_IDS = new Set([
  'lead_100', 'lead_101', 'lead_102', 'lead_103', 'lead_104', 'lead_105', 'lead_106', 'lead_107'
]);
const DEMO_PROP_IDS = new Set([
  'prop_201', 'prop_202', 'prop_203', 'prop_204', 'prop_205', 'prop_206', 'prop_207', 'prop_208'
]);

// --- AUTHENTICATION HELPERS ---

export type { ConfirmationResult, RecaptchaVerifier };

let isSocialLoginInitialized = false;

/**
 * Initializes native Android Google Sign-In (Credential Manager) using the Web Client ID.
 */
export async function initSocialLogin(): Promise<void> {
  if (isSocialLoginInitialized || !Capacitor.isNativePlatform()) {
    return;
  }
  const webClientId =
    (firebaseConfig as any).oAuthClientId ||
    '36803800158-f1e83pmo78ge5gpiosi9buukrbi6if7m.apps.googleusercontent.com';

  console.log('[Auth] Initializing native SocialLogin with Web Client ID:', webClientId);

  try {
    await SocialLogin.initialize({
      google: {
        webClientId,
        mode: 'online',
      },
    });
    isSocialLoginInitialized = true;
    console.log('[Auth] SocialLogin initialized successfully.');
  } catch (err) {
    console.error('[Auth] Error initializing native SocialLogin:', err);
  }
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Signs in with Google:
 * - On Native Android: Uses native Google Credential Manager (bottom sheet account selector)
 *   without launching Chrome or web redirect flows, obtains the ID token, and authenticates
 *   directly with Firebase via signInWithCredential.
 * - On Web / Preview: Uses standard signInWithPopup.
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (Capacitor.isNativePlatform()) {
    await initSocialLogin();

    const packageName = 'com.proplead.tracker';
    const signingSha1 = '71:21:34:6A:91:F9:31:7D:FB:E7:99:7B:53:96:31:CF:FC:ED:A5:06';
    const webClientId =
      (firebaseConfig as any).oAuthClientId ||
      '36803800158-f1e83pmo78ge5gpiosi9buukrbi6if7m.apps.googleusercontent.com';

    console.log('[GoogleAuth Diagnostics] Pre-login configuration:', {
      'package name': packageName,
      'signing SHA-1': signingSha1,
      'webClientId': webClientId,
      'filterByAuthorizedAccounts': false,
    });

    let loginResponse: any;
    try {
      loginResponse = await SocialLogin.login({
        provider: 'google',
        options: {
          style: 'bottom',
          filterByAuthorizedAccounts: false,
          scopes: ['email', 'profile'],
        },
      });
    } catch (err: any) {
      const errMessage = err?.message || String(err || '');
      const errorCodeMatch = errMessage.match(/\[(\d+)\]/);
      const errorCode = err?.code || (errorCodeMatch ? `[${errorCodeMatch[1]}]` : 'ERROR_LOGIN_FAILED');

      console.error('[GoogleAuth Diagnostics] Native Google Sign-In error:', {
        'Google login result/error code': errorCode,
        'package name': packageName,
        'signing SHA-1': signingSha1,
        'webClientId': webClientId,
        'whether an idToken was returned': false,
        'errorMessage': errMessage,
      });

      if (errMessage.includes('16') || errMessage.toLowerCase().includes('account reauth failed')) {
        console.error(
          '[GoogleAuth Diagnostics] [16] Account reauth failed:\n' +
          '- Package: ' + packageName + '\n' +
          '- Signing SHA-1: ' + signingSha1 + '\n' +
          '- Web Client ID: ' + webClientId
        );
      }
      throw err;
    }

    const result = loginResponse?.result || loginResponse;
    const idToken = result?.idToken;
    const hasIdToken = Boolean(idToken);

    console.log('[GoogleAuth Diagnostics] Native Google Sign-In result received:', {
      'Google login result/error code': 'SUCCESS [0]',
      'package name': packageName,
      'signing SHA-1': signingSha1,
      'webClientId': webClientId,
      'whether an idToken was returned': hasIdToken,
      'responseType': result?.responseType || 'online',
    });

    if (!idToken) {
      console.error('[GoogleAuth Diagnostics] No idToken in login result:', result);
      throw new Error('Google Sign-In completed natively, but no ID token was returned.');
    }

    console.log('[GoogleAuth] Passing idToken to Firebase GoogleAuthProvider.credential()...');
    const credential = GoogleAuthProvider.credential(idToken);

    console.log('[GoogleAuth] Authenticating with Firebase signInWithCredential...');
    try {
      const userCredential = await signInWithCredential(auth, credential);
      console.log('[GoogleAuth Diagnostics] Firebase authentication successful:', {
        'Google login result/error code': 'AUTH_SUCCESS',
        'package name': packageName,
        'signing SHA-1': signingSha1,
        'webClientId': webClientId,
        'whether an idToken was returned': true,
        'uid': userCredential.user.uid,
        'email': userCredential.user.email,
      });
      return userCredential.user;
    } catch (fbErr: any) {
      console.error('[GoogleAuth Diagnostics] Firebase signInWithCredential failed:', {
        'Google login result/error code': fbErr?.code || 'FIREBASE_AUTH_ERROR',
        'package name': packageName,
        'signing SHA-1': signingSha1,
        'webClientId': webClientId,
        'whether an idToken was returned': true,
        'errorMessage': fbErr?.message || String(fbErr),
      });
      throw fbErr;
    }
  } else {
    console.log('[GoogleAuth] Web platform: launching Firebase signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }
}

export async function signOutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch (e) {
      console.warn('SocialLogin native logout non-critical error:', e);
    }
  }
  await fbSignOut(auth);
}

export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/**
 * Safely clears any active RecaptchaVerifier instance and cleans up its DOM container.
 */
export function cleanupPhoneRecaptchaVerifier(containerId: string = 'recaptcha-container'): void {
  if (typeof window === 'undefined') return;

  const win = window as any;
  if (win._propleadRecaptchaVerifier) {
    try {
      win._propleadRecaptchaVerifier.clear();
    } catch (err) {
      console.debug('Error clearing _propleadRecaptchaVerifier:', err);
    }
    win._propleadRecaptchaVerifier = null;
  }

  if (win.recaptchaVerifier) {
    try {
      win.recaptchaVerifier.clear();
    } catch (err) {
      console.debug('Error clearing recaptchaVerifier:', err);
    }
    win.recaptchaVerifier = null;
  }

  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Returns an existing valid RecaptchaVerifier instance or creates a new one
 * after cleanly resetting the container element.
 */
export function getOrCreatePhoneRecaptchaVerifier(
  containerId: string = 'recaptcha-container',
  onExpired?: () => void
): RecaptchaVerifier {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const existing = win._propleadRecaptchaVerifier || win.recaptchaVerifier;
    const container = document.getElementById(containerId);

    // Reuse existing valid instance if present and container is in DOM
    if (existing && container) {
      return existing;
    }

    // Clean up any stale state before instantiating a new verifier
    cleanupPhoneRecaptchaVerifier(containerId);
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      cleanupPhoneRecaptchaVerifier(containerId);
      if (onExpired) onExpired();
    },
  });

  if (typeof window !== 'undefined') {
    const win = window as any;
    win._propleadRecaptchaVerifier = verifier;
    win.recaptchaVerifier = verifier;
  }

  return verifier;
}

/**
 * Creates or reuses an invisible RecaptchaVerifier for Firebase Phone Auth.
 */
export function createPhoneRecaptchaVerifier(
  containerId: string = 'recaptcha-container',
  onExpired?: () => void
): RecaptchaVerifier {
  return getOrCreatePhoneRecaptchaVerifier(containerId, onExpired);
}

/**
 * Sends a 6-digit OTP to the specified E.164 phone number via Firebase Phone Authentication.
 */
export async function sendPhoneOtp(
  e164PhoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  try {
    return await signInWithPhoneNumber(auth, e164PhoneNumber, verifier);
  } catch (err: any) {
    console.error('Firebase signInWithPhoneNumber error:', err);
    throw err;
  }
}

/**
 * Verifies the OTP entered by the user using Firebase ConfirmationResult.
 * Resolves to the authenticated FirebaseUser only if verification succeeds.
 */
export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<FirebaseUser> {
  try {
    const userCredential = await confirmationResult.confirm(otpCode.trim());
    return userCredential.user;
  } catch (err: any) {
    console.error('Firebase OTP confirmation error:', err);
    throw err;
  }
}

// --- USER PROFILE OPERATIONS ---

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile from Firestore:', err);
    return null;
  }
}

export async function saveUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...profile,
      id: userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving user profile to Firestore:', err);
    throw err;
  }
}

export function subscribeUserProfile(
  userId: string,
  onUpdate: (profile: UserProfile | null) => void
): Unsubscribe {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as UserProfile);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Firestore User Profile subscription offline/error:', err);
    }
  );
}

// --- LEADS OPERATIONS (Isolated per agent) ---

export async function getLeadsFromFirestore(userId: string): Promise<Lead[]> {
  try {
    const leadsRef = collection(db, 'users', userId, 'leads');
    const q = query(leadsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const validLeads: Lead[] = [];
    snapshot.docs.forEach((docSnap) => {
      if (DEMO_LEAD_IDS.has(docSnap.id)) {
        deleteDoc(docSnap.ref).catch(() => {});
      } else {
        validLeads.push(docSnap.data() as Lead);
      }
    });
    return validLeads;
  } catch (err) {
    console.error('Error getting leads from Firestore:', err);
    return [];
  }
}

export function subscribeLeadsFromFirestore(
  userId: string,
  onUpdate: (leads: Lead[]) => void
): Unsubscribe {
  const leadsRef = collection(db, 'users', userId, 'leads');
  const q = query(leadsRef);
  return onSnapshot(
    q,
    (snapshot) => {
      const validLeads: Lead[] = [];
      snapshot.docs.forEach((docSnap) => {
        if (DEMO_LEAD_IDS.has(docSnap.id)) {
          deleteDoc(docSnap.ref).catch(() => {});
        } else {
          validLeads.push(docSnap.data() as Lead);
        }
      });
      // Sort in memory by createdAt descending or updatedAt
      validLeads.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
      onUpdate(validLeads);
    },
    (err) => {
      console.warn('Firestore Leads subscription offline/error:', err);
    }
  );
}

function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export async function addLeadToFirestore(userId: string, lead: Lead): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  await setDoc(leadRef, cleanFirestorePayload({
    ...lead,
    updatedAt: new Date().toISOString(),
  }));
}

export async function updateLeadInFirestore(userId: string, lead: Lead): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  await setDoc(leadRef, cleanFirestorePayload({
    ...lead,
    updatedAt: new Date().toISOString(),
  }), { merge: true });
}

export async function deleteLeadFromFirestore(userId: string, leadId: string): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', leadId);
  await deleteDoc(leadRef);
}

export async function batchAddLeadsToFirestore(userId: string, leads: Lead[]): Promise<void> {
  const batch = writeBatch(db);
  leads.forEach((lead) => {
    const refDoc = doc(db, 'users', userId, 'leads', lead.id);
    batch.set(refDoc, lead, { merge: true });
  });
  await batch.commit();
}

// --- PROPERTIES OPERATIONS (Isolated per agent) ---

export async function getPropertiesFromFirestore(userId: string): Promise<Property[]> {
  try {
    const propsRef = collection(db, 'users', userId, 'properties');
    const snapshot = await getDocs(propsRef);
    const validProps: Property[] = [];
    snapshot.docs.forEach((docSnap) => {
      if (DEMO_PROP_IDS.has(docSnap.id)) {
        deleteDoc(docSnap.ref).catch(() => {});
      } else {
        validProps.push(docSnap.data() as Property);
      }
    });
    return validProps;
  } catch (err) {
    console.error('Error getting properties from Firestore:', err);
    return [];
  }
}

export function subscribePropertiesFromFirestore(
  userId: string,
  onUpdate: (properties: Property[]) => void
): Unsubscribe {
  const propsRef = collection(db, 'users', userId, 'properties');
  return onSnapshot(
    propsRef,
    (snapshot) => {
      const validProps: Property[] = [];
      snapshot.docs.forEach((docSnap) => {
        if (DEMO_PROP_IDS.has(docSnap.id)) {
          deleteDoc(docSnap.ref).catch(() => {});
        } else {
          validProps.push(docSnap.data() as Property);
        }
      });
      validProps.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
      onUpdate(validProps);
    },
    (err) => {
      console.warn('Firestore Properties subscription offline/error:', err);
    }
  );
}

export async function addPropertyToFirestore(userId: string, property: Property): Promise<void> {
  const propRef = doc(db, 'users', userId, 'properties', property.id);
  await setDoc(propRef, {
    ...property,
    updatedAt: new Date().toISOString(),
  });
}

export async function updatePropertyInFirestore(userId: string, property: Property): Promise<void> {
  const propRef = doc(db, 'users', userId, 'properties', property.id);
  await setDoc(propRef, {
    ...property,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function deletePropertyFromFirestore(userId: string, propertyId: string): Promise<void> {
  const propRef = doc(db, 'users', userId, 'properties', propertyId);
  await deleteDoc(propRef);
}

// --- FIREBASE STORAGE: PROPERTY PHOTOS ---

export async function uploadPropertyPhoto(
  userId: string,
  propertyId: string,
  file: File | Blob,
  fileName?: string
): Promise<string> {
  try {
    const cleanFileName = fileName || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const photoRef = ref(storage, `users/${userId}/properties/${propertyId}/photos/${cleanFileName}`);
    const uploadResult = await uploadBytes(photoRef, file);
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return downloadUrl;
  } catch (err) {
    console.error('Firebase Storage photo upload error:', err);
    throw err;
  }
}
