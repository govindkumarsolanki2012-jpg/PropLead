import { getDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lead, Property, UserProfile } from '../types';
import { getStoredLeads, getStoredProperties, getStoredProfile } from './storage';

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
 * Guaranteed zero data loss and prevents duplicate imports.
 * Filters out and purges any legacy demo data from ever reaching or staying in Firestore.
 */
export async function syncLocalDataToFirestore(
  userId: string,
  userEmail?: string | null,
  userName?: string | null,
  userPhone?: string | null
): Promise<MigrationResult> {
  if (!userId) {
    return { migrated: false, leadsUploaded: 0, propertiesUploaded: 0, error: 'No userId provided' };
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

    // 1. Check if user profile already exists in Firestore
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    const isGenuinelyNewUser = !userSnap.exists();

    // 2. Check if Firestore already has leads for this user
    const leadsColl = collection(db, 'users', userId, 'leads');
    const existingLeadsSnap = await getDocs(leadsColl);
    const existingLeadIds = new Set(existingLeadsSnap.docs.map((d) => d.id));

    // 3. Check if Firestore already has properties for this user
    const propsColl = collection(db, 'users', userId, 'properties');
    const existingPropsSnap = await getDocs(propsColl);
    const existingPropIds = new Set(existingPropsSnap.docs.map((d) => d.id));

    const localProfile = getStoredProfile();
    const localLeads = getStoredLeads();
    const localProperties = getStoredProperties();

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
      const isDemoName = localProfile.name === 'Rajesh Sharma' || localProfile.name === 'Vikram Malhotra';
      const isDemoPhone = localProfile.phone === '9820123456';
      const cleanName = userName || (!isDemoName ? localProfile.name : '') || (userEmail ? userEmail.split('@')[0] : 'Property Agent');
      const cleanPhone = userPhone || (!isDemoPhone ? localProfile.phone : '') || '';

      // Bug 1 Fix: Client-side new-user provisioning must NOT write protected entitlement fields
      // that Firestore security rules reject (isSubscribed, subscriptionStatus, etc.).
      // Only write safe profile attributes and allowed initial trial markers (trialStatus: 'not_started', trialEverStarted: false).
      const safeProfile: Record<string, any> = {
        id: userId,
        name: cleanName,
        phone: cleanPhone,
        email: userEmail || localProfile.email || '',
        agencyName: localProfile.agencyName || '',
        city: localProfile.city || '',
        reraNumber: localProfile.reraNumber || '',
        language: localProfile.language || 'en',
        darkMode: Boolean(localProfile.darkMode),
        notificationsEnabled: localProfile.notificationsEnabled ?? true,
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
    } else {
      // Safe preservation for existing users: NEVER reset or overwrite existing trial dates or subscription fields from client.
      // Entitlements and trial status are strictly managed by trusted backend logic.
    }

    // B. Migrate Leads (only real user-created leads, never demo data)
    const validLocalLeads = localLeads.filter((l) => l && !DEMO_LEAD_IDS.has(l.id));
    for (const lead of validLocalLeads) {
      if (!existingLeadIds.has(lead.id)) {
        const leadRef = doc(db, 'users', userId, 'leads', lead.id);
        batch.set(leadRef, cleanFirestorePayload(lead), { merge: true });
        leadsToUpload++;
        batchOperations++;
      }
    }

    // C. Migrate Properties (only real user-created properties, never demo data)
    const validLocalProperties = localProperties.filter((p) => p && !DEMO_PROP_IDS.has(p.id));
    for (const property of validLocalProperties) {
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
