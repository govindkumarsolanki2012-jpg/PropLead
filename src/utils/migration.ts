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

/**
 * Safely migrates existing device localStorage leads, properties, and profile
 * to the authenticated agent's Firestore cloud container.
 * Guaranteed zero data loss and prevents duplicate imports.
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
  const alreadyMigrated = localStorage.getItem(migrationKey);

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
    let leadsToUpload = 0;
    let propsToUpload = 0;

    // A. Migrate Profile if not already in Firestore
    if (!userSnap.exists()) {
      const mergedProfile: Partial<UserProfile> = {
        ...localProfile,
        id: userId,
        name: userName || localProfile.name || 'Property Agent',
        email: userEmail || localProfile.email || '',
        isOnboarded: true,
        isTrialActive: localProfile.isTrialActive ?? true,
        trialDaysRemaining: localProfile.trialDaysRemaining ?? 30,
        trialStartDate: localProfile.trialStartDate || new Date().toISOString(),
        subscriptionStatus: localProfile.subscriptionStatus || 'TRIAL',
        isSubscribed: localProfile.isSubscribed || false,
      };
      batch.set(userDocRef, mergedProfile, { merge: true });
    }

    // B. Migrate Leads (only those not already in Firestore)
    for (const lead of localLeads) {
      if (!existingLeadIds.has(lead.id)) {
        const leadRef = doc(db, 'users', userId, 'leads', lead.id);
        batch.set(leadRef, lead, { merge: true });
        leadsToUpload++;
      }
    }

    // C. Migrate Properties (only those not already in Firestore)
    for (const property of localProperties) {
      if (!existingPropIds.has(property.id)) {
        const propRef = doc(db, 'users', userId, 'properties', property.id);
        batch.set(propRef, property, { merge: true });
        propsToUpload++;
      }
    }

    if (leadsToUpload > 0 || propsToUpload > 0 || !userSnap.exists()) {
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
      error: err?.message || 'Failed to sync local data to cloud',
    };
  }
}
