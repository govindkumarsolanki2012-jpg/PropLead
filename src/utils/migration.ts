import { getDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lead, Property, UserProfile } from '../types';
import { getStoredLeads, getStoredProperties, getStoredProfile } from './storage';

export interface MigrationResult {
  migrated: boolean;
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

/**
 * Safely migrates existing device localStorage leads, properties, and profile
 * to the authenticated agent's Firestore cloud container.
 * Guaranteed zero data loss and prevents duplicate imports.
 * Filters out and purges any legacy demo data from ever reaching or staying in Firestore.
 */
export async function syncLocalDataToFirestore(
  userId: string,
  userEmail?: string | null,
  userName?: string | null
): Promise<MigrationResult> {
  if (!userId) {
    return { migrated: false, leadsUploaded: 0, propertiesUploaded: 0, error: 'No userId provided' };
  }

  const migrationKey = `proplead_migrated_v1_${userId}`;

  try {
    // 1. Check if user profile already exists in Firestore
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);

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

    // A. Migrate Profile if not already in Firestore
    if (!userSnap.exists()) {
      const isDemoName = localProfile.name === 'Rajesh Sharma' || localProfile.name === 'Vikram Malhotra';
      const isDemoPhone = localProfile.phone === '9820123456';
      const cleanName = userName || (!isDemoName ? localProfile.name : '') || 'Property Agent';
      const cleanPhone = !isDemoPhone ? (localProfile.phone || '') : '';

      const mergedProfile: Partial<UserProfile> = {
        ...localProfile,
        id: userId,
        name: cleanName,
        phone: cleanPhone,
        email: userEmail || localProfile.email || '',
        isOnboarded: true,
        isTrialActive: localProfile.isTrialActive ?? true,
        trialDaysRemaining: localProfile.trialDaysRemaining ?? 30,
        trialStartDate: localProfile.trialStartDate || new Date().toISOString(),
        subscriptionStatus: localProfile.subscriptionStatus || 'TRIAL',
        isSubscribed: localProfile.isSubscribed || false,
      };
      batch.set(userDocRef, mergedProfile, { merge: true });
      batchOperations++;
    }

    // B. Migrate Leads (only real user-created leads, never demo data)
    const validLocalLeads = localLeads.filter((l) => l && !DEMO_LEAD_IDS.has(l.id));
    for (const lead of validLocalLeads) {
      if (!existingLeadIds.has(lead.id)) {
        const leadRef = doc(db, 'users', userId, 'leads', lead.id);
        batch.set(leadRef, lead, { merge: true });
        leadsToUpload++;
        batchOperations++;
      }
    }

    // C. Migrate Properties (only real user-created properties, never demo data)
    const validLocalProperties = localProperties.filter((p) => p && !DEMO_PROP_IDS.has(p.id));
    for (const property of validLocalProperties) {
      if (!existingPropIds.has(property.id)) {
        const propRef = doc(db, 'users', userId, 'properties', property.id);
        batch.set(propRef, property, { merge: true });
        propsToUpload++;
        batchOperations++;
      }
    }

    if (batchOperations > 0) {
      await batch.commit();
    }

    localStorage.setItem(migrationKey, 'true');

    return {
      migrated: true,
      leadsUploaded: leadsToUpload,
      propertiesUploaded: propsToUpload,
    };
  } catch (err: any) {
    console.error('Migration error:', err);
    return {
      migrated: false,
      leadsUploaded: 0,
      propertiesUploaded: 0,
      error: err?.message || 'Migration failed',
    };
  }
}
