import { Lead, UserProfile, WhatsAppTemplate, Property } from '../types';
import { INITIAL_USER_PROFILE } from '../data/initialData';
import { WHATSAPP_TEMPLATES } from './whatsapp';
import { formatBudgetRange } from './formatters';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { showAppToast } from './toast';

const STORAGE_KEYS = {
  LEADS: 'proplead_leads_v1',
  PROPERTIES: 'proplead_properties_v1',
  PROFILE: 'proplead_profile_v1',
  TEMPLATES: 'proplead_templates_v1',
  IS_LOGGED_IN: 'proplead_is_logged_in_v1',
  THEME: 'proplead_theme_v1',
};

// Known legacy demo IDs to prevent old cached demo items from showing up
const DEMO_LEAD_IDS = new Set([
  'lead_100', 'lead_101', 'lead_102', 'lead_103', 'lead_104', 'lead_105', 'lead_106', 'lead_107'
]);
const DEMO_PROP_IDS = new Set([
  'prop_201', 'prop_202', 'prop_203', 'prop_204', 'prop_205', 'prop_206', 'prop_207', 'prop_208'
]);

export function getStoredProperties(): Property[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
    if (!raw) {
      return [];
    }
    const parsed: Property[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(p => p && !DEMO_PROP_IDS.has(p.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.error('Error loading properties from storage:', err);
    return [];
  }
}

export function saveStoredProperties(properties: Property[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  } catch (err) {
    console.error('Error saving properties to storage:', err);
  }
}

export function getStoredLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (!raw) {
      return [];
    }
    const parsed: Lead[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(l => l && !DEMO_LEAD_IDS.has(l.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.error('Error loading leads from storage:', err);
    return [];
  }
}

export function saveStoredLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  } catch (err) {
    console.error('Error saving leads to storage:', err);
  }
}

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      return INITIAL_USER_PROFILE;
    }
    const parsed: UserProfile = JSON.parse(raw);
    // If the profile was previously seeded with the demo agent 'Rajesh Sharma'
    if (parsed && (parsed.id === 'usr_001' || (parsed.name === 'Rajesh Sharma' && parsed.phone === '9820123456'))) {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      return INITIAL_USER_PROFILE;
    }
    return parsed || INITIAL_USER_PROFILE;
  } catch (err) {
    console.error('Error loading profile from storage:', err);
    return INITIAL_USER_PROFILE;
  }
}

export function saveStoredProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving profile to storage:', err);
  }
}

export function getStoredTemplates(): WhatsAppTemplate[] {
  return WHATSAPP_TEMPLATES;
}

export function saveStoredTemplates(templates: WhatsAppTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  } catch (err) {
    console.error('Error saving templates to storage:', err);
  }
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LEADS);
    localStorage.removeItem(STORAGE_KEYS.PROPERTIES);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.IS_LOGGED_IN);
  } catch (err) {
    console.error('Error clearing local storage:', err);
  }
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
      // Write file into device Cache directory
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      // Launch native Android Intent (ACTION_SEND) so the user can choose/save the file
      // to their preferred device location (e.g. Save to Files, Google Drive, Downloads)
      await Share.share({
        title: filename,
        text: 'PropLead Leads Export',
        url: writeResult.uri,
        dialogTitle: 'Save CSV File',
      });

      showAppToast('CSV downloaded successfully');
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (nativeErr: any) {
      const errStr = String(nativeErr?.message || nativeErr || '');
      // If user dismissed the Android share/save dialog, treat as cancelled
      if (errStr.toLowerCase().includes('cancel') || errStr.toLowerCase().includes('abort')) {
        return { success: true, message: 'Cancelled' };
      }
      console.warn('[CSV Export] Native Capacitor share warning, attempting web fallback:', nativeErr);
    }
  }

  // 2. Android Web / Mobile Chrome / Web Share API with Files
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  if (isAndroid && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'PropLead Leads Export',
        });
        showAppToast('CSV downloaded successfully');
        return { success: true, message: 'CSV downloaded successfully' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User dismissed the Android share sheet
        return { success: true, message: 'Cancelled' };
      }
      console.warn('[CSV Export] Android Web Share warning, trying file picker/download:', shareErr);
    }
  }

  // 3. File System Access API (Modern Desktop Chrome / Edge)
  // Lets the user choose the destination folder & file name on their device
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'CSV Document',
            accept: { 'text/csv': ['.csv'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showAppToast('CSV downloaded successfully');
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (pickerErr: any) {
      if (pickerErr?.name === 'AbortError') {
        // User cancelled the file picker dialog
        return { success: true, message: 'Cancelled' };
      }
      console.warn('[CSV Export] showSaveFilePicker failed, trying download fallback:', pickerErr);
    }
  }

  // 4. Standard Web Download Fallback (<a download="...">)
  try {
    // Use application/octet-stream to prevent mobile browsers from rendering raw text inline
    const downloadBlob = new Blob([csvContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(downloadBlob);
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
    console.error('[CSV Export] Standard download failed:', dlErr);
    const errMsg = dlErr?.message || 'Download failed. Please check permissions.';
    showAppToast(`Failed to download CSV: ${errMsg}`, true);
    return { success: false, message: errMsg };
  }
}
