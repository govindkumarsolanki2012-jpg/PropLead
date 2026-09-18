import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel, ActionPerformed } from '@capacitor/local-notifications';
import { Lead, NotificationSettings } from '../types';

export const FOLLOWUP_CHANNEL_ID = 'proplead_followups';
export const FOLLOWUP_CHANNEL_NAME = 'PropLead Follow-ups';

export const VISITS_CHANNEL_ID = 'proplead_visits';
export const VISITS_CHANNEL_NAME = 'PropLead Property Visits';

// Legacy compatibility alias
export const NOTIFICATION_CHANNEL_ID = FOLLOWUP_CHANNEL_ID;
export const NOTIFICATION_CHANNEL_NAME = FOLLOWUP_CHANNEL_NAME;

export const NOTIFICATION_GROUP_KEY = 'proplead_reminders_group';
export const NOTIFICATION_SMALL_ICON = 'ic_stat_proplead';
export const NOTIFICATION_ICON_COLOR = '#059669';
export const DAILY_SUMMARY_NOTIFICATION_ID = 888123456;

const NOTIFICATION_SETTINGS_STORAGE_KEY = 'proplead_notification_settings_v1';
const SCHEDULED_NOTIFICATIONS_REGISTRY_KEY = 'proplead_scheduled_notifications_registry_v1';
const NOTIFICATION_PERM_PROMPTED_KEY = 'proplead_notification_perm_prompted_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  followUpReminders: true,
  propertyVisitReminders: true,
  dailySummary: true,
};

export interface NotificationPayloadExtra {
  leadId?: string;
  visitId?: string;
  type?: 'followup' | 'visit' | 'daily_summary';
  reminderKind?: '30m' | 'exact' | 'overdue' | 'daily_summary';
}

type NotificationActionListener = (extra: NotificationPayloadExtra) => void;
let globalActionListener: NotificationActionListener | null = null;
let isChannelInitialized = false;

/**
 * Generate a predictable, stable 32-bit positive integer ID from a string key.
 * On Android, notification IDs must be 32-bit signed integers (1 to 2,147,483,647).
 */
export function hashStringToPositiveInt(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return (Math.abs(hash) % 1900000000) + 100000;
}

export function getFollowUp30mId(leadId: string): number {
  return hashStringToPositiveInt(`lead_${leadId}_fu_30m`);
}

export function getFollowUpExactId(leadId: string): number {
  return hashStringToPositiveInt(`lead_${leadId}_fu_exact`);
}

export function getFollowUpOverdueId(leadId: string): number {
  return hashStringToPositiveInt(`lead_${leadId}_fu_overdue`);
}

export function getVisit30mId(leadId: string): number {
  return hashStringToPositiveInt(`lead_${leadId}_visit_30m`);
}

export function getVisitExactId(leadId: string): number {
  return hashStringToPositiveInt(`lead_${leadId}_visit_exact`);
}

/**
 * Retrieve saved NotificationSettings from localStorage with fallback defaults.
 */
export function getStoredNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        followUpReminders: parsed.followUpReminders ?? DEFAULT_NOTIFICATION_SETTINGS.followUpReminders,
        propertyVisitReminders: parsed.propertyVisitReminders ?? DEFAULT_NOTIFICATION_SETTINGS.propertyVisitReminders,
        dailySummary: parsed.dailySummary ?? DEFAULT_NOTIFICATION_SETTINGS.dailySummary,
      };
    }
  } catch (e) {
    console.warn('Failed to parse notification settings from storage:', e);
  }
  return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

/**
 * Persist NotificationSettings to localStorage.
 */
export function saveStoredNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save notification settings:', e);
  }
}

/**
 * Local registry to track scheduled IDs per lead.
 */
function getActiveScheduledRegistry(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(SCHEDULED_NOTIFICATIONS_REGISTRY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveActiveScheduledRegistry(registry: Record<string, number[]>): void {
  try {
    localStorage.setItem(SCHEDULED_NOTIFICATIONS_REGISTRY_KEY, JSON.stringify(registry));
  } catch {}
}

/**
 * Parse local date and time string into a Date object in local device timezone.
 */
export function parseLocalDateTime(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  let hour = 10;
  let minute = 0;

  if (timeStr) {
    const trimmed = timeStr.trim();
    const isPM = /pm/i.test(trimmed);
    const isAM = /am/i.test(trimmed);
    const timeWithoutAmPm = trimmed.replace(/[a-zA-Z]/g, '').trim();
    const [hStr, mStr] = timeWithoutAmPm.split(':');
    let parsedHour = parseInt(hStr, 10);
    const parsedMinute = parseInt(mStr || '0', 10);

    if (!isNaN(parsedHour)) {
      if (isPM && parsedHour < 12) parsedHour += 12;
      if (isAM && parsedHour === 12) parsedHour = 0;
      hour = parsedHour;
    }
    if (!isNaN(parsedMinute)) {
      minute = parsedMinute;
    }
  }

  const d = new Date(year, month, day, hour, minute, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTimeForDisplay(date: Date): string {
  return date
    .toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
}

/**
 * Sanitize a string to avoid null, undefined, or empty placeholder artifacts.
 */
export function sanitizeNotificationText(val?: string | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (
    !str ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'nan' ||
    str === '-' ||
    str === '•'
  ) {
    return '';
  }
  return str;
}

/**
 * Cleanly join non-empty primary and secondary parts with a bullet separator ' • '.
 * Guarantees no empty separators, leading/trailing bullets, or null/undefined strings.
 */
export function formatNotificationBody(primary: string, secondary?: string): string {
  const p = sanitizeNotificationText(primary);
  const s = sanitizeNotificationText(secondary);
  if (p && s) {
    return `${p} • ${s}`;
  }
  return p || s || 'Scheduled reminder';
}

/**
 * Extract requirement summary for a follow-up lead (e.g. '2BHK requirement', 'Villa requirement')
 */
export function getLeadRequirementSummary(lead: Lead): string {
  // If lead has bhk specified (e.g. "2 BHK", "3 BHK", "1 BHK")
  const bhk = sanitizeNotificationText(lead.bhk);
  if (bhk && bhk.toLowerCase() !== 'any') {
    // Format "2 BHK" -> "2BHK requirement"
    const compactBhk = bhk.replace(/\s+/g, '');
    return `${compactBhk} requirement`;
  }

  // If lead has propertyType specified (e.g. "flat", "villa", "plot")
  const propertyType = sanitizeNotificationText(lead.propertyType);
  if (propertyType) {
    const formattedType = propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
    return `${formattedType} requirement`;
  }

  // If nextFollowUpNote is short and informative
  const note = sanitizeNotificationText(lead.nextFollowUpNote);
  if (note && note.length <= 35 && !/^(call|follow up|visit)$/i.test(note)) {
    return note;
  }

  return 'Requirement details';
}

/**
 * Extract location summary for a property visit (e.g. 'Madhurawada', 'Sector 57')
 */
export function getLeadLocationSummary(lead: Lead): string {
  const locality = sanitizeNotificationText(lead.preferredLocality);
  if (locality) return locality;

  if (Array.isArray(lead.preferredLocations) && lead.preferredLocations.length > 0) {
    const firstLoc = sanitizeNotificationText(lead.preferredLocations[0]);
    if (firstLoc) return firstLoc;
  }

  const city = sanitizeNotificationText(lead.preferredCity);
  if (city) return city;

  const note = sanitizeNotificationText(lead.nextFollowUpNote);
  if (note && note.length <= 35 && !/^(call|follow up|visit)$/i.test(note)) {
    return note;
  }

  return 'Site visit location';
}

/**
 * Initialize Android notification channel and tap listeners.
 */
export async function initLocalNotifications(onAction?: NotificationActionListener): Promise<void> {
  if (onAction) {
    globalActionListener = onAction;
  }

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    if (!isChannelInitialized) {
      // 1. Delete legacy generic channel if present
      try {
        await LocalNotifications.deleteChannel({ id: 'proplead_reminders' });
      } catch {
        // Ignore if channel does not exist
      }

      // 2. PropLead Follow-ups channel (High importance for alerts, clean sound/vibration)
      const followUpChannel: Channel = {
        id: FOLLOWUP_CHANNEL_ID,
        name: FOLLOWUP_CHANNEL_NAME,
        description: 'Client follow-up reminders and scheduled calls',
        importance: 4, // High importance (heads-up banner where Android allows)
        visibility: 1, // Public visibility on lockscreen
        vibration: true,
      };

      // 3. PropLead Property Visits channel (High importance for site visits)
      const visitsChannel: Channel = {
        id: VISITS_CHANNEL_ID,
        name: VISITS_CHANNEL_NAME,
        description: 'Site visit reminders and property tours',
        importance: 4, // High importance (heads-up banner where Android allows)
        visibility: 1, // Public visibility on lockscreen
        vibration: true,
      };

      await LocalNotifications.createChannel(followUpChannel);
      await LocalNotifications.createChannel(visitsChannel);
      isChannelInitialized = true;
    }

    // Set up tap listener once
    await LocalNotifications.removeAllListeners();
    await LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction: ActionPerformed) => {
      const extra = (notificationAction.notification.extra as NotificationPayloadExtra) || {};
      if (globalActionListener) {
        globalActionListener(extra);
      }
    });
  } catch (err) {
    console.warn('LocalNotifications initialization note:', err);
  }
}

/**
 * Check current notification permissions.
 */
export async function checkNotificationPermission(): Promise<{
  granted: boolean;
  display: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return {
        granted: window.Notification.permission === 'granted',
        display: window.Notification.permission,
      };
    }
    return { granted: true, display: 'granted' };
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    return {
      granted: status.display === 'granted',
      display: status.display,
    };
  } catch (err) {
    console.warn('Failed to check notification permission:', err);
    return { granted: false, display: 'denied' };
  }
}

/**
 * Request notification permissions (Android 13+ POST_NOTIFICATIONS).
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  display: string;
}> {
  try {
    localStorage.setItem(NOTIFICATION_PERM_PROMPTED_KEY, 'true');
  } catch {}

  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await window.Notification.requestPermission();
        return { granted: res === 'granted', display: res };
      } catch {
        return { granted: false, display: 'denied' };
      }
    }
    return { granted: true, display: 'granted' };
  }

  try {
    const status = await LocalNotifications.requestPermissions();
    return {
      granted: status.display === 'granted',
      display: status.display,
    };
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return { granted: false, display: 'denied' };
  }
}

/**
 * Check if the user was already prompted for notification permissions.
 */
export function wasNotificationPermissionPrompted(): boolean {
  try {
    return localStorage.getItem(NOTIFICATION_PERM_PROMPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Cancel all scheduled notifications associated with a specific lead.
 */
export async function cancelNotificationsForLead(leadId: string): Promise<void> {
  if (!leadId) return;

  const registry = getActiveScheduledRegistry();
  const registeredIds = registry[leadId] || [];

  // Combine deterministic IDs with registered IDs
  const deterministicIds = [
    getFollowUp30mId(leadId),
    getFollowUpExactId(leadId),
    getFollowUpOverdueId(leadId),
    getVisit30mId(leadId),
    getVisitExactId(leadId),
  ];

  const uniqueIds = Array.from(new Set([...registeredIds, ...deterministicIds]));

  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({
        notifications: uniqueIds.map((id) => ({ id })),
      });
    }
  } catch (err) {
    console.warn(`Error cancelling notifications for lead ${leadId}:`, err);
  }

  delete registry[leadId];
  saveActiveScheduledRegistry(registry);
}

/**
 * Cancel all follow-up notifications across all leads.
 */
export async function cancelAllFollowUpNotifications(leads: Lead[]): Promise<void> {
  for (const lead of leads) {
    const isVisit = lead.status === 'site_visit_scheduled' || (lead.nextFollowUpNote && /visit/i.test(lead.nextFollowUpNote));
    if (!isVisit) {
      await cancelNotificationsForLead(lead.id);
    }
  }
}

/**
 * Cancel all property visit notifications across all leads.
 */
export async function cancelAllPropertyVisitNotifications(leads: Lead[]): Promise<void> {
  for (const lead of leads) {
    const isVisit = lead.status === 'site_visit_scheduled' || (lead.nextFollowUpNote && /visit/i.test(lead.nextFollowUpNote));
    if (isVisit) {
      await cancelNotificationsForLead(lead.id);
    }
  }
}

/**
 * Cancel daily summary notification.
 */
export async function cancelDailySummaryNotification(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({
        notifications: [{ id: DAILY_SUMMARY_NOTIFICATION_ID }],
      });
    }
  } catch (err) {
    console.warn('Error cancelling daily summary:', err);
  }
}

/**
 * Schedule notifications for a lead's follow-up or property visit.
 *
 * Follow-up:
 * 1. 30 minutes before: "Follow-up in 30 minutes" / "{lead.name} needs a follow-up at {time}"
 * 2. Exact time: "Follow up now" / "Call {lead.name}"
 *
 * Property Visit:
 * 1. 30 minutes before: "Property visit in 30 minutes" / "Visit with {lead.name} at {time}"
 * 2. Exact time: "Property visit now" / "Visit with {lead.name}"
 *
 * Overdue:
 * Single overdue notification scheduled 30m after exact time.
 */
export async function scheduleFollowUpNotifications(
  lead: Lead,
  isExplicitVisit?: boolean
): Promise<void> {
  if (!lead || !lead.id) return;

  // Always cancel any previously scheduled notifications first to prevent duplicates or stale times
  await cancelNotificationsForLead(lead.id);

  if (!lead.nextFollowUpDate || !lead.nextFollowUpTime) {
    return;
  }

  const settings = getStoredNotificationSettings();
  const isVisit =
    isExplicitVisit ||
    lead.status === 'site_visit_scheduled' ||
    (lead.nextFollowUpNote && /visit|site/i.test(lead.nextFollowUpNote));

  // Check category toggles
  if (isVisit && !settings.propertyVisitReminders) {
    return;
  }
  if (!isVisit && !settings.followUpReminders) {
    return;
  }

  const scheduledDate = parseLocalDateTime(lead.nextFollowUpDate, lead.nextFollowUpTime);
  if (!scheduledDate) return;

  const exactTime = scheduledDate.getTime();
  const thirtyMinBefore = exactTime - 30 * 60 * 1000;
  const overdueTime = exactTime + 30 * 60 * 1000;
  const now = Date.now();

  // If the exact time is already in the past, do not schedule
  if (exactTime <= now) {
    return;
  }

  const notificationsToSchedule: any[] = [];
  const scheduledIds: number[] = [];
  const displayTime = formatTimeForDisplay(scheduledDate);
  const leadDisplayName = sanitizeNotificationText(lead.name) || 'Client';
  const targetChannelId = isVisit ? VISITS_CHANNEL_ID : FOLLOWUP_CHANNEL_ID;

  // 1. 30-minute reminder (only if at least 30 minutes in future)
  // Priority: DEFAULT importance for advance notification
  if (thirtyMinBefore > now) {
    const id = isVisit ? getVisit30mId(lead.id) : getFollowUp30mId(lead.id);
    const title = isVisit ? 'Property visit in 30 min' : 'Follow-up in 30 min';
    const body = formatNotificationBody(leadDisplayName, displayTime);

    notificationsToSchedule.push({
      id,
      title,
      body,
      schedule: {
        at: new Date(thirtyMinBefore),
        allowWhileIdle: true,
      },
      channelId: targetChannelId,
      smallIcon: NOTIFICATION_SMALL_ICON,
      iconColor: NOTIFICATION_ICON_COLOR,
      group: NOTIFICATION_GROUP_KEY,
      extra: {
        leadId: lead.id,
        visitId: isVisit ? lead.id : undefined,
        type: isVisit ? 'visit' : 'followup',
        reminderKind: '30m',
      },
    });
    scheduledIds.push(id);
  }

  // 2. Exact-time reminder
  // Priority: HIGH importance for immediate action
  const exactId = isVisit ? getVisitExactId(lead.id) : getFollowUpExactId(lead.id);
  const exactTitle = isVisit ? 'Property visit now' : 'Follow up now';
  const exactSecondary = isVisit ? getLeadLocationSummary(lead) : getLeadRequirementSummary(lead);
  const exactBody = formatNotificationBody(leadDisplayName, exactSecondary);

  notificationsToSchedule.push({
    id: exactId,
    title: exactTitle,
    body: exactBody,
    schedule: {
      at: new Date(exactTime),
      allowWhileIdle: true,
    },
    channelId: targetChannelId,
    smallIcon: NOTIFICATION_SMALL_ICON,
    iconColor: NOTIFICATION_ICON_COLOR,
    group: NOTIFICATION_GROUP_KEY,
    extra: {
      leadId: lead.id,
      visitId: isVisit ? lead.id : undefined,
      type: isVisit ? 'visit' : 'followup',
      reminderKind: 'exact',
    },
  });
  scheduledIds.push(exactId);

  // 3. Overdue follow-up reminder (scheduled 30m after exact time, cancelled when completed/edited)
  if (!isVisit) {
    const overdueId = getFollowUpOverdueId(lead.id);
    notificationsToSchedule.push({
      id: overdueId,
      title: 'Follow-up overdue',
      body: formatNotificationBody(leadDisplayName, 'Follow-up overdue'),
      schedule: {
        at: new Date(overdueTime),
        allowWhileIdle: true,
      },
      channelId: FOLLOWUP_CHANNEL_ID,
      smallIcon: NOTIFICATION_SMALL_ICON,
      iconColor: NOTIFICATION_ICON_COLOR,
      group: NOTIFICATION_GROUP_KEY,
      extra: {
        leadId: lead.id,
        type: 'followup',
        reminderKind: 'overdue',
      },
    });
    scheduledIds.push(overdueId);
  }

  if (notificationsToSchedule.length > 0) {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
      }
      const registry = getActiveScheduledRegistry();
      registry[lead.id] = scheduledIds;
      saveActiveScheduledRegistry(registry);
    } catch (err) {
      console.warn('Failed to schedule local notifications:', err);
    }
  }
}

/**
 * Schedule or update the single morning Daily Summary notification at 9:00 AM.
 * Example:
 * Title: "PropLead Daily Follow-ups"
 * Body: "You have 5 follow-ups today"
 * If zero follow-ups: cancels notification to avoid spam.
 */
export async function scheduleDailySummaryNotification(leads: Lead[]): Promise<void> {
  const settings = getStoredNotificationSettings();
  if (!settings.dailySummary) {
    await cancelDailySummaryNotification();
    return;
  }

  const now = new Date();
  const targetDate = new Date();
  targetDate.setHours(9, 0, 0, 0);

  // If already past 9:00 AM today, schedule for 9:00 AM tomorrow
  if (now.getTime() >= targetDate.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Format target date as YYYY-MM-DD
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const targetDayStr = `${year}-${month}-${day}`;

  // Count leads with follow-up scheduled for the target day
  const matchingLeads = leads.filter(
    (l) => l.nextFollowUpDate === targetDayStr && l.status !== 'closed' && l.status !== 'lost'
  );
  const count = matchingLeads.length;

  if (count === 0) {
    // Zero follow-ups: do not show unnecessary notifications
    await cancelDailySummaryNotification();
    return;
  }

  const title = 'PropLead Daily Follow-ups';
  const body = count === 1 ? 'You have 1 follow-up today' : `You have ${count} follow-ups today`;

  try {
    if (Capacitor.isNativePlatform()) {
      // Cancel previous summary first to avoid duplicates
      await LocalNotifications.cancel({
        notifications: [{ id: DAILY_SUMMARY_NOTIFICATION_ID }],
      });

      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_SUMMARY_NOTIFICATION_ID,
            title,
            body,
            schedule: {
              at: targetDate,
              allowWhileIdle: true,
            },
            channelId: FOLLOWUP_CHANNEL_ID,
            smallIcon: NOTIFICATION_SMALL_ICON,
            iconColor: NOTIFICATION_ICON_COLOR,
            group: NOTIFICATION_GROUP_KEY,
            extra: {
              type: 'daily_summary',
              reminderKind: 'daily_summary',
            },
          },
        ],
      });
    }
  } catch (err) {
    console.warn('Failed to schedule daily summary notification:', err);
  }
}

/**
 * Synchronize notifications for all leads (called on app startup or settings toggle).
 */
export async function syncAllLeadNotifications(leads: Lead[]): Promise<void> {
  const settings = getStoredNotificationSettings();

  for (const lead of leads) {
    if (lead.nextFollowUpDate && lead.nextFollowUpTime && lead.status !== 'closed' && lead.status !== 'lost') {
      await scheduleFollowUpNotifications(lead);
    } else {
      await cancelNotificationsForLead(lead.id);
    }
  }

  if (settings.dailySummary) {
    await scheduleDailySummaryNotification(leads);
  } else {
    await cancelDailySummaryNotification();
  }
}
