import { Lead, UserProfile, WhatsAppTemplate, Property } from '../types';
import { INITIAL_USER_PROFILE } from '../data/initialData';
import { WHATSAPP_TEMPLATES } from './whatsapp';
import { formatBudgetRange } from './formatters';
import { Capacitor } from '@capacitor/core';
import { showAppToast } from './toast';
import { CsvDownload } from './csvDownload';
import { auth } from '../lib/firebase';

/**
 * UID-scoped storage keys builder.
 * Guarantees zero account data bleeding between different Firebase accounts.
 */
export const getUserStorageKeys = (uid: string) => ({
  LEADS: `proplead_leads_v1_${uid}`,
  PROPERTIES: `proplead_properties_v1_${uid}`,
  PROFILE: `proplead_profile_v1_${uid}`,
  TEMPLATES: `proplead_templates_v1_${uid}`,
  ONBOARDED: `proplead_onboarded_v1_${uid}`,
  MIGRATED: `proplead_migrated_v1_${uid}`,
  TRIAL: `proplead_trial_v1_${uid}`,
  SUB_STATUS: `proplead_sub_status_${uid}`,
});

/**
 * Legacy global storage keys.
 * ONLY referenced for safe, ownership-verified legacy migration.
 */
export const LEGACY_STORAGE_KEYS = {
  LEADS: 'proplead_leads_v1',
  PROPERTIES: 'proplead_properties_v1',
  PROFILE: 'proplead_profile_v1',
  TEMPLATES: 'proplead_templates_v1',
  IS_LOGGED_IN: 'proplead_is_logged_in_v1',
} as const;

// Known legacy demo IDs to prevent old cached demo items from showing up
const DEMO_LEAD_IDS = new Set([
  'lead_100', 'lead_101', 'lead_102', 'lead_103', 'lead_104', 'lead_105', 'lead_106', 'lead_107'
]);
const DEMO_PROP_IDS = new Set([
  'prop_201', 'prop_202', 'prop_203', 'prop_204', 'prop_205', 'prop_206', 'prop_207', 'prop_208'
]);

/**
 * Helper to resolve the authenticated Firebase UID.
 * Never trusts unauthenticated, spoofed, or mismatched UIDs.
 */
function resolveAuthUid(passedUid?: string | null): string | null {
  const currentAuthUid = auth?.currentUser?.uid || null;
  if (!currentAuthUid) {
    return null;
  }
  if (passedUid && typeof passedUid === 'string' && passedUid.trim().length > 0) {
    if (passedUid.trim() !== currentAuthUid) {
      console.warn('[storage] Passed UID does not match current authenticated Firebase UID');
      return null;
    }
    return currentAuthUid;
  }
  return currentAuthUid;
}

export function getStoredProperties(uid?: string | null): Property[] {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return [];
  }
  try {
    const key = getUserStorageKeys(effectiveUid).PROPERTIES;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed: Property[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(p => p && !DEMO_PROP_IDS.has(p.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.warn('Notice loading properties from storage:', err);
    return [];
  }
}

export function saveStoredProperties(properties: Property[], uid?: string | null): void {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).PROPERTIES;
    localStorage.setItem(key, JSON.stringify(properties));
  } catch (err) {
    console.warn('Notice saving properties to storage:', err);
  }
}

export function getStoredLeads(uid?: string | null): Lead[] {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return [];
  }
  try {
    const key = getUserStorageKeys(effectiveUid).LEADS;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed: Lead[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(l => l && !DEMO_LEAD_IDS.has(l.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.warn('Notice loading leads from storage:', err);
    return [];
  }
}

export function saveStoredLeads(leads: Lead[], uid?: string | null): void {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).LEADS;
    localStorage.setItem(key, JSON.stringify(leads));
  } catch (err) {
    console.warn('Notice saving leads to storage:', err);
  }
}

export function getStoredProfile(uid?: string | null): UserProfile {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return INITIAL_USER_PROFILE;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).PROFILE;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return INITIAL_USER_PROFILE;
    }
    const parsed: UserProfile = JSON.parse(raw);
    // If the profile was previously seeded with the demo agent 'Rajesh Sharma'
    if (parsed && (parsed.id === 'usr_001' || (parsed.name === 'Rajesh Sharma' && parsed.phone === '9820123456'))) {
      localStorage.removeItem(key);
      return INITIAL_USER_PROFILE;
    }
    return parsed || INITIAL_USER_PROFILE;
  } catch (err) {
    console.warn('Notice loading profile from storage:', err);
    return INITIAL_USER_PROFILE;
  }
}

export function saveStoredProfile(profile: UserProfile, uid?: string | null): void {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).PROFILE;
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (err) {
    console.warn('Notice saving profile to storage:', err);
  }
}

export function getStoredTemplates(uid?: string | null): WhatsAppTemplate[] {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return WHATSAPP_TEMPLATES;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).TEMPLATES;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Notice loading templates from storage:', err);
  }
  return WHATSAPP_TEMPLATES;
}

export function saveStoredTemplates(templates: WhatsAppTemplate[], uid?: string | null): void {
  const effectiveUid = resolveAuthUid(uid);
  if (!effectiveUid || typeof window === 'undefined') {
    return;
  }
  try {
    const key = getUserStorageKeys(effectiveUid).TEMPLATES;
    localStorage.setItem(key, JSON.stringify(templates));
  } catch (err) {
    console.warn('Notice saving templates to storage:', err);
  }
}

/**
 * Controlled legacy storage readers.
 * Used exclusively for safe migration where ownership can be proven.
 */
export function getLegacyStoredProfile(): UserProfile | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(LEGACY_STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    const parsed: UserProfile = JSON.parse(raw);
    if (parsed && (parsed.id === 'usr_001' || (parsed.name === 'Rajesh Sharma' && parsed.phone === '9820123456'))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getLegacyStoredLeads(): Lead[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LEGACY_STORAGE_KEYS.LEADS);
    if (!raw) return [];
    const parsed: Lead[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(l => l && !DEMO_LEAD_IDS.has(l.id));
  } catch {
    return [];
  }
}

export function getLegacyStoredProperties(): Property[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LEGACY_STORAGE_KEYS.PROPERTIES);
    if (!raw) return [];
    const parsed: Property[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p && !DEMO_PROP_IDS.has(p.id));
  } catch {
    return [];
  }
}

export function clearLegacyStoredData(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(LEGACY_STORAGE_KEYS.LEADS);
    localStorage.removeItem(LEGACY_STORAGE_KEYS.PROPERTIES);
    localStorage.removeItem(LEGACY_STORAGE_KEYS.PROFILE);
    localStorage.removeItem(LEGACY_STORAGE_KEYS.TEMPLATES);
    localStorage.removeItem(LEGACY_STORAGE_KEYS.IS_LOGGED_IN);
  } catch (err) {
    console.warn('Notice clearing legacy storage:', err);
  }
}

/**
 * Clears user-scoped local storage for a specific UID without touching
 * another account's cache or unrelated device preferences (e.g. language).
 */
export function clearUserScopedStorage(userId?: string): void {
  if (typeof window === 'undefined') return;
  const targetUid = resolveAuthUid(userId);

  try {
    if (targetUid) {
      const keys = getUserStorageKeys(targetUid);
      localStorage.removeItem(keys.LEADS);
      localStorage.removeItem(keys.PROPERTIES);
      localStorage.removeItem(keys.PROFILE);
      localStorage.removeItem(keys.TEMPLATES);
      localStorage.removeItem(keys.ONBOARDED);
      localStorage.removeItem(keys.MIGRATED);
      localStorage.removeItem(`proplead_migrated_${targetUid}`);
      localStorage.removeItem(keys.TRIAL);
      localStorage.removeItem(keys.SUB_STATUS);
      localStorage.removeItem(`proplead_notification_settings_v1_${targetUid}`);
      localStorage.removeItem(`proplead_scheduled_notifications_registry_v1_${targetUid}`);
      localStorage.removeItem(`proplead_notification_perm_prompted_v1_${targetUid}`);
      localStorage.removeItem(`proplead_sync_${targetUid}`);

      // Scan and clean any key ending with _${targetUid}
      const suffix = `_${targetUid}`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.endsWith(suffix) || key.includes(suffix))) {
          localStorage.removeItem(key);
        }
      }
    }

    localStorage.removeItem(LEGACY_STORAGE_KEYS.IS_LOGGED_IN);
  } catch (err) {
    console.warn('Error clearing user-scoped storage:', err);
  }
}

export function clearAllData(userId?: string): void {
  clearUserScopedStorage(userId);
}

/**
 * Export Leads array to clean CSV download with native Android and Web support.
 * Filename format: PropLead_Leads_YYYY-MM-DD.csv
 */
export async function exportLeadsToCSV(
  leads: Lead[],
  _agentName?: string
): Promise<{ success: boolean; message: string }> {
  if (!leads || leads.length === 0) {
    const emptyMsg = 'No leads available to export.';
    showAppToast(emptyMsg, true);
    return { success: false, message: emptyMsg };
  }

  const headers = [
    'Customer Name',
    'Phone Number',
    'WhatsApp',
    'Email',
    'Requirement',
    'Property Type',
    'BHK / Configuration',
    'Budget Min (₹)',
    'Budget Max (₹)',
    'Budget Range Text',
    'Preferred Locations',
    'Status',
    'Priority',
    'Lead Source',
    'Next Follow-Up Date',
    'Next Follow-Up Time',
    'Follow-Up Notes',
    'General Notes',
    'Created Date',
    'Last Contacted',
  ];

  const escapeCSV = (str: string | undefined | null) => {
    if (!str) return '""';
    const clean = String(str).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = leads.map((lead) => [
    escapeCSV(lead.name),
    escapeCSV(lead.phone),
    escapeCSV(lead.whatsapp || lead.phone),
    escapeCSV(lead.email || ''),
    escapeCSV(lead.requirement.toUpperCase()),
    escapeCSV(lead.propertyType),
    escapeCSV(lead.bhk || ''),
    escapeCSV(lead.budgetMin ? String(lead.budgetMin) : ''),
    escapeCSV(lead.budgetMax ? String(lead.budgetMax) : ''),
    escapeCSV(formatBudgetRange(lead.budgetMin, lead.budgetMax)),
    escapeCSV(lead.preferredLocations.join('; ')),
    escapeCSV(lead.status),
    escapeCSV(lead.priority),
    escapeCSV(lead.source),
    escapeCSV(lead.nextFollowUpDate || ''),
    escapeCSV(lead.nextFollowUpTime || ''),
    escapeCSV(lead.nextFollowUpNote || ''),
    escapeCSV(lead.notes || ''),
    escapeCSV(lead.createdAt),
    escapeCSV(lead.lastContactedAt || ''),
  ]);

  // Prepend UTF-8 BOM so Excel & mobile spreadsheet viewers open accented/Indic characters cleanly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  // Filename formatted as: PropLead_Leads_YYYY-MM-DD.csv
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const filename = `PropLead_Leads_${year}-${month}-${day}.csv`;

  // 1. Native Android App via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await CsvDownload.saveCsvFile({
        fileName: filename,
        content: csvContent,
        mimeType: 'text/csv',
      });

      if (result.canceled) {
        return { success: false, message: 'Canceled by user' };
      }

      if (result.success) {
        return { success: true, message: 'PropLead CSV downloaded' };
      } else {
        const errMsg = result.error || 'Failed to save CSV file.';
        showAppToast(errMsg, true);
        return { success: false, message: errMsg };
      }
    } catch (nativeErr: any) {
      console.warn('[CSV Export] Native Save As notice:', nativeErr);
      if (
        nativeErr?.message?.includes('canceled') ||
        nativeErr?.message?.includes('CANCELED')
      ) {
        return { success: false, message: 'Canceled by user' };
      }
      const errMsg = nativeErr?.message || 'Failed to save CSV.';
      showAppToast(errMsg, true);
      return { success: false, message: errMsg };
    }
  }

  // 2. Desktop / Web standard download behavior
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2500);

    showAppToast('CSV downloaded successfully');
    return { success: true, message: 'CSV downloaded successfully' };
  } catch (dlErr: any) {
    console.warn('[CSV Export] Standard web download notice:', dlErr);
    const errMsg = dlErr?.message || 'Download failed. Please check permissions.';
    showAppToast(errMsg, true);
    return { success: false, message: errMsg };
  }
}
