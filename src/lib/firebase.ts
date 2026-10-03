import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with durable WebView-safe persistence.
// IndexedDB is preferred for Firebase's auth state and refresh token, with
// localStorage as a fallback for environments where IndexedDB is unavailable.
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} catch (error: any) {
  // Supports Vite hot reload or another module that initialized this app first.
  // Production startup normally takes the initializeAuth branch above.
  if (error?.code !== 'auth/already-initialized') {
    throw error;
  }
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const authReady = auth.authStateReady();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with offline persistence (single-tab manager prevents multi-lease clock drift errors)
// and experimentalAutoDetectLongPolling to ensure resilient backend connection across web proxies and mobile networks
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({}),
    }),
    experimentalAutoDetectLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch (e) {
  // If already initialized, retrieve default or custom database instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

export const db = firestoreInstance;

// Initialize Storage with explicit bucket
export const storage = getStorage(app, firebaseConfig.storageBucket || 'proplead-e5c6a.firebasestorage.app');

export type { FirebaseUser };

