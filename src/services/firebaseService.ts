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
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { Lead, Property, UserProfile, WhatsAppTemplate } from '../types';
import { INITIAL_LEADS, INITIAL_PROPERTIES, INITIAL_USER_PROFILE } from '../data/initialData';

// --- AUTHENTICATION HELPERS ---

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}

export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
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
    return snapshot.docs.map((docSnap) => docSnap.data() as Lead);
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
      const leadsList = snapshot.docs.map((docSnap) => docSnap.data() as Lead);
      // Sort in memory by createdAt descending or updatedAt
      leadsList.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
      onUpdate(leadsList);
    },
    (err) => {
      console.warn('Firestore Leads subscription offline/error:', err);
    }
  );
}

export async function addLeadToFirestore(userId: string, lead: Lead): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  await setDoc(leadRef, {
    ...lead,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateLeadInFirestore(userId: string, lead: Lead): Promise<void> {
  const leadRef = doc(db, 'users', userId, 'leads', lead.id);
  await setDoc(leadRef, {
    ...lead,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
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
    return snapshot.docs.map((docSnap) => docSnap.data() as Property);
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
      const propList = snapshot.docs.map((docSnap) => docSnap.data() as Property);
      propList.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
      onUpdate(propList);
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
