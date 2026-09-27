import { getDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Lead, Property, UserProfile } from '../types';
import {
  getStoredLeads,
  getStoredProperties,
  getStoredProfile,
  saveStoredLeads,
  saveStoredProperties,
  saveStoredProfile,
  getLegacyStoredProfile,
  getLegacyStoredLeads,
  getLegacyStoredProperties,
  clearLegacyStoredData,
} from './storage';

export interface MigrationResult {
  migrated: boolean;
  isNewUser?: boolean;
  leadsUploaded: number;
  propertiesUploaded: number;
  error?: string;
}

const DEMO_LEAD_IDS = new Set([
  'lead_100', 'lead_101', 'lead_102', 'lead_103', 'lead_104', 'lead_105', 'lead_106', 'lead_107'
]);
const DEMO_PROP_IDS = new Set([
  'prop_201', 'prop_202', 'prop_203', 'prop_204', 'prop_205', 'prop_206', 'prop_207', 'prop_208'
]);

function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value
          .filter((item) => item !== undefined)
          .map((item) =>
            item !== null && typeof item === 'object' && !(item instanceof Date)
              ? cleanFirestorePayload(item)
              : item
          );
      } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        result[key] = cleanFirestorePayload(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Safely migrates existing device localStorage leads, properties, and profile
 * to the authenticated agent's Firestore cloud container.
 * 
 * Strict Multi-Account Isolation:
 * - Validates caller-supplied UID strictly against auth.currentUser.uid.
 * - Migrates legacy global cache ONLY if legacy profile ownership is proven (profile.id === auth.currentUser.uid).
 * - If ownership cannot be proven, unowned legacy cache is completely ignored and NEVER uploaded to another account.
 * - Writes ONLY to /users/{auth.currentUser.uid} paths.
 */
export async function syncLocalDataToFirestore(
  userId: string,
  userEmail?: string | null,
  userName?: string | null,
  userPhone?: string | null
): Promise<MigrationResult> {
  // 1. Verify caller UID matches authenticated user UID
  const currentAuthUser = auth.currentUser;
  if (!currentAuthUser || !userId || currentAuthUser.uid !== userId) {
    return {
      migrated: false,
      leadsUploaded: 0,
      propertiesUploaded: 0,
      error: 'Unauthenticated or UID mismatch',
    };
  }

  const migrationKey = `proplead_migrated_v1_${userId}`;

  try {
    // Check if user already migrated on this device to avoid redundant operations
    if (typeof window !== 'undefined' && localStorage.getItem(migrationKey) === 'true') {
      return {
        migrated: true,
        leadsUploaded: 0,
        propertiesUploaded: 0,
      };
    }

    // 2. Check if user profile already exists in Firestore
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    const isGenuinelyNewUser = !userSnap.exists();

    // 3. Check if Firestore already has leads for this user
    const leadsColl = collection(db, 'users', userId, 'leads');
    const existingLeadsSnap = await getDocs(leadsColl);
    const existingLeadIds = new Set(existingLeadsSnap.docs.map((d) => d.id));

    // 4. Check if Firestore already has properties for this user
    const propsColl = collection(db, 'users', userId, 'properties');
    const existingPropsSnap = await getDocs(propsColl);
    const existingPropIds = new Set(existingPropsSnap.docs.map((d) => d.id));

    // 5. Evaluate local caches (UID-scoped cache first, and legacy cache only if proven)
    const localProfile = getStoredProfile(userId);
    const localLeads = getStoredLeads(userId);
    const localProperties = getStoredProperties(userId);

    // Check legacy global cache ownership
    const legacyProfile = getLegacyStoredProfile();
    const isLegacyOwnershipProven = Boolean(
      legacyProfile &&
      legacyProfile.id &&
      legacyProfile.id === userId &&
      legacyProfile.id !== 'usr_001'
    );

    let candidateProfile: UserProfile = localProfile;
    let candidateLeads: Lead[] = localLeads;
    let candidateProps: Property[] = localProperties;

    // If legacy ownership is definitively proven, merge legacy items
    if (isLegacyOwnershipProven && legacyProfile) {
      candidateProfile = { ...legacyProfile, ...localProfile };
      const legacyLeads = getLegacyStoredLeads();
      const legacyProps = getLegacyStoredProperties();

      const combinedLeadMap = new Map<string, Lead>();
      legacyLeads.forEach((l) => combinedLeadMap.set(l.id, l));
      localLeads.forEach((l) => combinedLeadMap.set(l.id, l));
      candidateLeads = Array.from(combinedLeadMap.values());

      const combinedPropMap = new Map<string, Property>();
      legacyProps.forEach((p) => combinedPropMap.set(p.id, p));
      localProperties.forEach((p) => combinedPropMap.set(p.id, p));
      candidateProps = Array.from(combinedPropMap.values());
    }

    const batch = writeBatch(db);
    let batchOperations = 0;
    let leadsToUpload = 0;
    let propsToUpload = 0;

    // Purge any legacy demo leads from user's Firestore collection if present
    for (const docSnap of existingLeadsSnap.docs) {
      if (DEMO_LEAD_IDS.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        batchOperations++;
      }
    }

    // Purge any legacy demo properties from user's Firestore collection if present
    for (const docSnap of existingPropsSnap.docs) {
      if (DEMO_PROP_IDS.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        batchOperations++;
      }
    }

    // A. Migrate/Initialize Profile ONLY if not already in Firestore
    if (isGenuinelyNewUser) {
      const isDemoName = candidateProfile.name === 'Rajesh Sharma' || candidateProfile.name === 'Vikram Malhotra';
      const isDemoPhone = candidateProfile.phone === '9820123456';
      const cleanName = userName || (!isDemoName ? candidateProfile.name : '') || (userEmail ? userEmail.split('@')[0] : 'Property Agent');
      const cleanPhone = userPhone || (!isDemoPhone ? candidateProfile.phone : '') || '';

      const safeProfile: Record<string, any> = {
        id: userId,
        name: cleanName,
        phone: cleanPhone,
        email: userEmail || candidateProfile.email || '',
        agencyName: candidateProfile.agencyName || '',
        city: candidateProfile.city || '',
        reraNumber: candidateProfile.reraNumber || '',
        language: candidateProfile.language || 'en',
        darkMode: Boolean(candidateProfile.darkMode),
        notificationsEnabled: candidateProfile.notificationsEnabled ?? true,
        isOnboarded: true,
        onboardingCompleted: false,
        hasCompletedOnboarding: false,
        trialStatus: 'not_started',
        trialEverStarted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(userDocRef, cleanFirestorePayload(safeProfile), { merge: true });
      batchOperations++;
    }

    // B. Migrate Leads (only real user-created leads, never demo data)
    const validLeads = candidateLeads.filter((l) => l && !DEMO_LEAD_IDS.has(l.id));
    for (const lead of validLeads) {
      if (!existingLeadIds.has(lead.id)) {
        const leadRef = doc(db, 'users', userId, 'leads', lead.id);
        batch.set(leadRef, cleanFirestorePayload(lead), { merge: true });
        leadsToUpload++;
        batchOperations++;
      }
    }

    // C. Migrate Properties (only real user-created properties, never demo data)
    const validProps = candidateProps.filter((p) => p && !DEMO_PROP_IDS.has(p.id));
    for (const property of validProps) {
      if (!existingPropIds.has(property.id)) {
        const propRef = doc(db, 'users', userId, 'properties', property.id);
        batch.set(propRef, cleanFirestorePayload(property), { merge: true });
        propsToUpload++;
        batchOperations++;
      }
    }

    if (batchOperations > 0) {
      await batch.commit();
    }

    // If legacy ownership was proven and migrated, save into UID-scoped cache and remove legacy keys
    if (isLegacyOwnershipProven) {
      saveStoredProfile(candidateProfile, userId);
      saveStoredLeads(validLeads, userId);
      saveStoredProperties(validProps, userId);
      clearLegacyStoredData();
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(migrationKey, 'true');
    }

    return {
      migrated: true,
      isNewUser: isGenuinelyNewUser,
      leadsUploaded: leadsToUpload,
      propertiesUploaded: propsToUpload,
    };
  } catch (err: any) {
    console.warn('Migration notice:', err);
    return {
      migrated: false,
      leadsUploaded: 0,
      propertiesUploaded: 0,
      error: err?.message || 'Migration failed',
    };
  }
}
