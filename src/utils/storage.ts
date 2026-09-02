import { Lead, UserProfile, PhoneContact, WhatsAppTemplate, Property } from '../types';
import { INITIAL_LEADS, INITIAL_USER_PROFILE, INITIAL_PROPERTIES } from '../data/initialData';
import { WHATSAPP_TEMPLATES } from './whatsapp';
import { formatIndianCurrency, formatBudgetRange } from './formatters';

const STORAGE_KEYS = {
  LEADS: 'proplead_leads_v1',
  PROPERTIES: 'proplead_properties_v1',
  PROFILE: 'proplead_profile_v1',
  TEMPLATES: 'proplead_templates_v1',
  IS_LOGGED_IN: 'proplead_is_logged_in_v1',
  THEME: 'proplead_theme_v1',
};

export function getStoredProperties(): Property[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(INITIAL_PROPERTIES));
      return INITIAL_PROPERTIES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading properties from storage:', err);
    return INITIAL_PROPERTIES;
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
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading leads from storage:', err);
    return INITIAL_LEADS;
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
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(INITIAL_USER_PROFILE));
      return INITIAL_USER_PROFILE;
    }
    return JSON.parse(raw);
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

export function resetToSampleData(): { leads: Lead[]; properties: Property[]; profile: UserProfile } {
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(INITIAL_LEADS));
  localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(INITIAL_PROPERTIES));
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(INITIAL_USER_PROFILE));
  return { leads: INITIAL_LEADS, properties: INITIAL_PROPERTIES, profile: INITIAL_USER_PROFILE };
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.LEADS);
  localStorage.removeItem(STORAGE_KEYS.PROPERTIES);
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
}

/**
 * Export Leads array to clean CSV download
 */
export function exportLeadsToCSV(leads: Lead[], agentName?: string): void {
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

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `PropLead_Leads_Export_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sample phone contacts for import simulation
 */
export const SAMPLE_PHONE_CONTACTS: PhoneContact[] = [
  { id: 'c1', name: 'Alok Nath Mishra', phone: '9820011223', email: 'alok.mishra@gmail.com' },
  { id: 'c2', name: 'Dr. Smita Kulkarni', phone: '9845099881', email: 'dr.smita.k@apollo.org' },
  { id: 'c3', name: 'Harish Rathi (Builder Rep)', phone: '9988112233', email: 'harish.rathi@lodha.com' },
  { id: 'c4', name: 'Mohit Agarwal (Investor)', phone: '9765123488', email: 'mohit.agarwal@invest.co' },
  { id: 'c5', name: 'Shalini Narang', phone: '9810554433', email: 'shalini.narang@yahoo.com' },
  { id: 'c6', name: 'Deepak Chawla', phone: '9899123400', email: 'deepak.c@techm.com' },
  { id: 'c7', name: 'Gautam Singhania', phone: '9821887766', email: 'gautam.s@gmail.com' },
  { id: 'c8', name: 'Ritu Kapoor', phone: '9440998877', email: 'ritu.kapoor@tcs.com' },
];
