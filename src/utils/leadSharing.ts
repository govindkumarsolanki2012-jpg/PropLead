import { Share } from '@capacitor/share';
import { Lead, LeadPriority } from '../types';
import {
  formatDisplayPhone,
  formatBudgetRange,
  formatRelativeDate,
  STATUS_CONFIG,
  PROPERTY_TYPE_LABELS,
} from './formatters';

/**
 * Generate a clean, professionally formatted lead summary for sharing.
 *
 * Structure:
 * 🏠 PropLead - LEAD DETAILS
 *
 * 👤 Name: ...
 * 📱 Mobile: ...
 *
 * 🎯 REQUIREMENT
 * • Configuration: ...
 * • Property Type: ...
 * • Budget: ...
 * • Preferred City: ...
 * • Preferred Locality: ...
 *
 * 📌 LEAD STATUS
 * • Status: ...
 * • Lead Temperature: ...
 * • Source: ...
 *
 * 📅 FOLLOW-UP
 * • Next Follow-Up: ...
 *
 * 📝 NOTES
 * • ...
 */
export function generateLeadShareSummary(lead: Lead): string {
  const sections: string[] = [];

  // 1. Header
  sections.push('🏠 PropLead - LEAD DETAILS');

  // 2. Name & Mobile (always at the top)
  const contactLines: string[] = [];
  if (lead.name?.trim()) {
    contactLines.push(`👤 Name: ${lead.name.trim()}`);
  }
  const displayPhone = formatDisplayPhone(lead.phone) || lead.phone?.trim();
  if (displayPhone) {
    contactLines.push(`📱 Mobile: ${displayPhone}`);
  }
  if (contactLines.length > 0) {
    sections.push(contactLines.join('\n'));
  }

  // 3. REQUIREMENT section
  const requirementLines: string[] = [];
  if (lead.bhk?.trim()) {
    requirementLines.push(`• Configuration: ${lead.bhk.trim()}`);
  }
  if (lead.propertyType) {
    const propTypeLabel = PROPERTY_TYPE_LABELS[lead.propertyType] || lead.propertyType;
    if (propTypeLabel) {
      requirementLines.push(`• Property Type: ${propTypeLabel}`);
    }
  }
  if (lead.budgetMin || lead.budgetMax) {
    const budgetStr = formatBudgetRange(lead.budgetMin, lead.budgetMax);
    if (budgetStr && budgetStr !== 'Flexible Budget') {
      requirementLines.push(`• Budget: ${budgetStr}`);
    }
  }
  if (lead.preferredCity?.trim()) {
    requirementLines.push(`• Preferred City: ${lead.preferredCity.trim()}`);
  }

  // Locality resolution
  const locality =
    lead.preferredLocality?.trim() ||
    (lead.preferredLocations && lead.preferredLocations.filter(Boolean).join(', '));
  if (locality) {
    requirementLines.push(`• Preferred Locality: ${locality}`);
  }

  if (lead.plotSizeSqFt) {
    requirementLines.push(`• Plot Size: ${lead.plotSizeSqFt.toLocaleString('en-IN')} sq.ft`);
  }

  if (requirementLines.length > 0) {
    sections.push(`🎯 REQUIREMENT\n${requirementLines.join('\n')}`);
  }

  // 4. LEAD STATUS section
  const statusLines: string[] = [];
  if (lead.status) {
    const statusLabel = STATUS_CONFIG[lead.status]?.label || lead.status;
    statusLines.push(`• Status: ${statusLabel}`);
  }
  if (lead.priority) {
    const priorityMap: Record<LeadPriority, string> = {
      hot: 'Hot',
      warm: 'Warm',
      cold: 'Cold',
    };
    const tempLabel =
      priorityMap[lead.priority] ||
      (lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1));
    statusLines.push(`• Lead Temperature: ${tempLabel}`);
  }
  if (lead.source?.trim()) {
    statusLines.push(`• Source: ${lead.source.trim()}`);
  }

  if (statusLines.length > 0) {
    sections.push(`📌 LEAD STATUS\n${statusLines.join('\n')}`);
  }

  // 5. FOLLOW-UP section (only if scheduled date is present)
  if (lead.nextFollowUpDate?.trim()) {
    const followUpInfo = formatRelativeDate(lead.nextFollowUpDate, lead.nextFollowUpTime);
    if (followUpInfo?.text && followUpInfo.text !== 'No follow-up set') {
      const followUpLines = [`• Next Follow-Up: ${followUpInfo.text}`];
      if (lead.nextFollowUpNote?.trim()) {
        followUpLines.push(`• Follow-Up Note: ${lead.nextFollowUpNote.trim()}`);
      }
      sections.push(`📅 FOLLOW-UP\n${followUpLines.join('\n')}`);
    }
  }

  // 6. NOTES section (only if available)
  if (lead.notes?.trim()) {
    sections.push(`📝 NOTES\n• ${lead.notes.trim()}`);
  }

  return sections.join('\n\n');
}

/**
 * Open the Android native Share Sheet (or system share) with the formatted lead summary.
 */
export async function shareLead(lead: Lead): Promise<void> {
  const summaryText = generateLeadShareSummary(lead);

  try {
    // Primary: Capacitor Share plugin for Android native Share Sheet
    await Share.share({
      title: `PropLead - ${lead.name || 'Lead Details'}`,
      text: summaryText,
      dialogTitle: 'Share Lead Details',
    });
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    // Silently return if user cancelled/dismissed
    if (
      msg.includes('cancel') ||
      msg.includes('abort') ||
      err?.name === 'AbortError'
    ) {
      return;
    }

    // Secondary fallback: Web navigator.share
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `PropLead - ${lead.name || 'Lead Details'}`,
          text: summaryText,
        });
        return;
      } catch (navErr: any) {
        const navMsg = String(navErr?.message || '').toLowerCase();
        if (
          navMsg.includes('cancel') ||
          navMsg.includes('abort') ||
          navErr?.name === 'AbortError'
        ) {
          return;
        }
      }
    }

    // Tertiary fallback: silent copy to clipboard if share sheet is unsupported
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summaryText);
      }
    } catch {
      // Ignore silently
    }
  }
}
