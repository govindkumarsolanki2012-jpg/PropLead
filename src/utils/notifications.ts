import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel, ActionPerformed } from '@capacitor/local-notifications';
import { Lead, NotificationSettings, FollowUpType } from '../types';
import { auth } from '../lib/firebase';

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

function resolveAuthUid(passedUid?: string | null): string | null {
  if (passedUid && typeof passedUid === 'string' && passedUid.trim().length > 0) {
    return passedUid.trim();
  }
  return auth?.currentUser?.uid || null;
}

const getNotificationSettingsKey = (uid?: string | null) => {
  const effectiveUid = resolveAuthUid(uid);
  return effectiveUid ? `proplead_notification_settings_v1_${effectiveUid}` : 'proplead_notification_settings_v1';
};

const getScheduledNotificationsRegistryKey = (uid?: string | null) => {
  const effectiveUid = resolveAuthUid(uid);
  return effectiveUid ? `proplead_scheduled_notifications_registry_v1_${effectiveUid}` : 'proplead_scheduled_notifications_registry_v1';
};

const getNotificationPermPromptedKey = (uid?: string | null) => {
  const effectiveUid = resolveAuthUid(uid);
  return effectiveUid ? `proplead_notification_perm_prompted_v1_${effectiveUid}` : 'proplead_notification_perm_prompted_v1';
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  followUpReminders: true,
  propertyVisitReminders: true,
  dailySummary: true,
};

export interface NotificationPayloadExtra {
  leadId?: string;
  clientName?: string;
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
export function getStoredNotificationSettings(uid?: string | null): NotificationSettings {
  try {
    const key = getNotificationSettingsKey(uid);
    const raw = localStorage.getItem(key);
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
export function saveStoredNotificationSettings(settings: NotificationSettings, uid?: string | null): void {
  try {
    const key = getNotificationSettingsKey(uid);
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save notification settings:', e);
  }
}

/**
 * Local registry to track scheduled IDs per lead.
 */
function getActiveScheduledRegistry(uid?: string | null): Record<string, number[]> {
  try {
    const key = getScheduledNotificationsRegistryKey(uid);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveActiveScheduledRegistry(registry: Record<string, number[]>, uid?: string | null): void {
  try {
    const key = getScheduledNotificationsRegistryKey(uid);
    localStorage.setItem(key, JSON.stringify(registry));
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
  const bhk = sanitizeNotificationText(lead.bhk);
  if (bhk && bhk.toLowerCase() !== 'any') {
    const compactBhk = bhk.replace(/\s+/g, '');
    return `${compactBhk} requirement`;
  }

  const propertyType = sanitizeNotificationText(lead.propertyType);
  if (propertyType) {
    const formattedType = propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
    return `${formattedType} requirement`;
  }

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

  return 'Location details';
}

/**
 * Format the full notification body for a lead reminder.
 */
export function formatFollowUpNotificationBody(
  clientName: string,
  userNote?: string | null,
  activityType?: FollowUpType
): string {
  const cleanName = sanitizeNotificationText(clientName) || 'Client';
  const cleanNote = sanitizeNotificationText(userNote);

  if (cleanNote) {
    return formatNotificationBody(cleanName, cleanNote);
  }

  if (activityType === 'site_visit') {
    return formatNotificationBody(cleanName, 'Property site visit');
  }
  if (activityType === 'meeting') {
    return formatNotificationBody(cleanName, 'Client meeting');
  }
  if (activityType === 'whatsapp') {
    return formatNotificationBody(cleanName, 'WhatsApp follow-up');
  }
  return formatNotificationBody(cleanName, 'Follow-up call');
}

/**
 * Determine the 30m notification title based on activity type.
 */
export function get30mNotificationTitle(activityType?: FollowUpType): string {
  if (activityType === 'site_visit') {
    return 'Property visit in 30 minutes';
  }
  if (activityType === 'meeting') {
    return 'Meeting in 30 minutes';
  }
  if (activityType === 'whatsapp') {
    return 'WhatsApp follow-up in 30 minutes';
  }
  return 'Follow-up in 30 minutes';
}

/**
 * Determine the exact-time notification title based on activity type.
 */
export function getExactNotificationTitle(activityType?: FollowUpType): string {
  if (activityType === 'site_visit') {
    return 'Property visit now';
  }
  if (activityType === 'meeting') {
    return 'Client meeting now';
  }
  if (activityType === 'whatsapp') {
    return 'Send WhatsApp follow-up';
  }
  return 'Follow-up due now';
}

/**
 * Helper to resolve whether a reminder is a site visit or generic follow-up.
 */
export function resolveActivityType(
  lead: Lead,
  activityTypeOrIsVisit?: FollowUpType | boolean
): FollowUpType {
  if (typeof activityTypeOrIsVisit === 'string') {
    return activityTypeOrIsVisit;
  }
  if (activityTypeOrIsVisit === true) {
    return 'site_visit';
  }
  if (lead.nextFollowUpType) {
    return lead.nextFollowUpType;
  }
  if (lead.status === 'site_visit_scheduled') {
    return 'site_visit';
  }
  if (lead.nextFollowUpNote && /visit/i.test(lead.nextFollowUpNote)) {
    return 'site_visit';
  }
  return 'call';
}

/**
 * Initialize Notification channels & click action listener on app launch.
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
      // 1. Follow-ups Channel (HIGH importance)
      const followUpChannel: Channel = {
        id: FOLLOWUP_CHANNEL_ID,
        name: FOLLOWUP_CHANNEL_NAME,
        description: 'Time-critical reminders for lead follow-ups and calls',
        importance: 4, // HIGH: makes sound and appears as heads-up
        visibility: 1, // PUBLIC: show on lockscreen
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#059669',
      };

      // 2. Property Visits Channel (HIGH importance)
      const visitsChannel: Channel = {
        id: VISITS_CHANNEL_ID,
        name: VISITS_CHANNEL_NAME,
        description: 'Scheduled property visits and client meetings',
        importance: 4, // HIGH
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#0284C7',
      };

      await LocalNotifications.createChannel(followUpChannel);
      await LocalNotifications.createChannel(visitsChannel);
      isChannelInitialized = true;
    }

    // Set up click action listener
    LocalNotifications.removeAllListeners();
    LocalNotifications.addListener('localNotificationActionPerformed', (notification: ActionPerformed) => {
      const extra = (notification?.notification?.extra || {}) as NotificationPayloadExtra;
      if (globalActionListener) {
        globalActionListener(extra);
      }
    });
  } catch (err) {
    console.warn('Failed to initialize local notification channels:', err);
  }
}

/**
 * Request notification permissions from device OS with graceful handling.
 */
export async function requestNotificationPermission(uid?: string | null): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  try {
    const result = await LocalNotifications.requestPermissions();
    setNotificationPermissionPrompted(uid);
    return result.display === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permissions:', err);
    return false;
  }
}

/**
 * Check current notification permission status.
 */
export async function checkNotificationPermission(): Promise<{ granted: boolean; display: string }> {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window) {
      const granted = Notification.permission === 'granted';
      return { granted, display: Notification.permission };
    }
    return { granted: true, display: 'granted' };
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    return {
      granted: perm.display === 'granted',
      display: perm.display,
    };
  } catch (err) {
    console.warn('Error checking notification permissions:', err);
    return { granted: false, display: 'prompt' };
  }
}

export function wasNotificationPermissionPrompted(uid?: string | null): boolean {
  try {
    const key = getNotificationPermPromptedKey(uid);
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function setNotificationPermissionPrompted(uid?: string | null): void {
  try {
    const key = getNotificationPermPromptedKey(uid);
    localStorage.setItem(key, 'true');
  } catch {}
}

/**
 * Cancel all scheduled notifications associated with a specific lead.
 */
export async function cancelNotificationsForLead(leadId: string, uid?: string | null): Promise<void> {
  if (!leadId) return;

  const registry = getActiveScheduledRegistry(uid);
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
  saveActiveScheduledRegistry(registry, uid);
}

/**
 * Cancel all follow-up notifications across all leads.
 */
export async function cancelAllFollowUpNotifications(leads: Lead[], uid?: string | null): Promise<void> {
  for (const lead of leads) {
    const isVisit = lead.status === 'site_visit_scheduled' || (lead.nextFollowUpNote && /visit/i.test(lead.nextFollowUpNote));
    if (!isVisit) {
      await cancelNotificationsForLead(lead.id, uid);
    }
  }
}

/**
 * Cancel all property visit notifications across all leads.
 */
export async function cancelAllPropertyVisitNotifications(leads: Lead[], uid?: string | null): Promise<void> {
  for (const lead of leads) {
    const isVisit = lead.status === 'site_visit_scheduled' || (lead.nextFollowUpNote && /visit/i.test(lead.nextFollowUpNote));
    if (isVisit) {
      await cancelNotificationsForLead(lead.id, uid);
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
 * Cancel all pending and scheduled notifications for the user on logout or account deletion.
 */
export async function cancelAllUserNotifications(leads?: Lead[], uid?: string | null): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id })),
          });
        }
      } catch (err) {
        console.warn('Error clearing pending notifications via LocalNotifications.getPending:', err);
      }
    }

    // Cancel by lead ID for all registered notifications in registry
    const registry = getActiveScheduledRegistry(uid);
    for (const leadId of Object.keys(registry)) {
      await cancelNotificationsForLead(leadId, uid);
    }

    // Also cancel for any provided leads array
    if (leads && leads.length > 0) {
      for (const lead of leads) {
        if (lead?.id) {
          await cancelNotificationsForLead(lead.id, uid);
        }
      }
    }

    // Cancel daily summary notification
    await cancelDailySummaryNotification();

    // Clear registry cache for this UID
    saveActiveScheduledRegistry({}, uid);
  } catch (err) {
    console.warn('Error cancelling all user notifications:', err);
  }
}

/**
 * Schedule notifications for a lead's follow-up or property visit.
 */
export async function scheduleFollowUpNotifications(
  lead: Lead,
  activityTypeOrIsVisit?: FollowUpType | boolean,
  uid?: string | null
): Promise<void> {
  if (!lead || !lead.id) return;

  // Always cancel any previously scheduled notifications first to prevent duplicates or stale times
  await cancelNotificationsForLead(lead.id, uid);

  if (!lead.nextFollowUpDate || !lead.nextFollowUpTime) {
    return;
  }

  const activityType = resolveActivityType(lead, activityTypeOrIsVisit);
  const isVisit = activityType === 'site_visit';

  const settings = getStoredNotificationSettings(uid);

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
  const leadDisplayName = sanitizeNotificationText(lead.name) || 'Client';
  const targetChannelId = isVisit ? VISITS_CHANNEL_ID : FOLLOWUP_CHANNEL_ID;

  const notificationBody = formatFollowUpNotificationBody(
    leadDisplayName,
    lead.nextFollowUpNote,
    activityType
  );

  // 1. 30-minute reminder
  if (thirtyMinBefore > now) {
    const id = isVisit ? getVisit30mId(lead.id) : getFollowUp30mId(lead.id);
    const title = get30mNotificationTitle(activityType);

    notificationsToSchedule.push({
      id,
      title,
      body: notificationBody,
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
  const exactId = isVisit ? getVisitExactId(lead.id) : getFollowUpExactId(lead.id);
  const exactTitle = getExactNotificationTitle(activityType);

  notificationsToSchedule.push({
    id: exactId,
    title: exactTitle,
    body: notificationBody,
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

  // 3. Overdue follow-up reminder
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
      const registry = getActiveScheduledRegistry(uid);
      registry[lead.id] = scheduledIds;
      saveActiveScheduledRegistry(registry, uid);
    } catch (err) {
      console.warn('Failed to schedule local notifications:', err);
    }
  }
}

/**
 * Schedule or update the morning Daily Summary notification at 9:00 AM.
 */
export async function scheduleDailySummaryNotification(leads: Lead[], uid?: string | null): Promise<void> {
  const settings = getStoredNotificationSettings(uid);
  if (!settings.dailySummary) {
    await cancelDailySummaryNotification();
    return;
  }

  const now = new Date();
  const targetDate = new Date();
  targetDate.setHours(9, 0, 0, 0);

  if (now.getTime() >= targetDate.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const targetDayStr = `${year}-${month}-${day}`;

  const matchingLeads = leads.filter(
    (l) => l.nextFollowUpDate === targetDayStr && l.status !== 'closed' && l.status !== 'lost'
  );
  const count = matchingLeads.length;

  if (count === 0) {
    await cancelDailySummaryNotification();
    return;
  }

  const title = 'PropLead Daily Follow-ups';
  const body = count === 1 ? 'You have 1 follow-up today' : `You have ${count} follow-ups today`;

  try {
    if (Capacitor.isNativePlatform()) {
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
 * Synchronize notifications for all leads.
 */
export async function syncAllLeadNotifications(leads: Lead[], uid?: string | null): Promise<void> {
  const settings = getStoredNotificationSettings(uid);

  for (const lead of leads) {
    if (lead.nextFollowUpDate && lead.nextFollowUpTime && lead.status !== 'closed' && lead.status !== 'lost') {
      await scheduleFollowUpNotifications(lead, undefined, uid);
    } else {
      await cancelNotificationsForLead(lead.id, uid);
    }
  }

  if (settings.dailySummary) {
    await scheduleDailySummaryNotification(leads, uid);
  } else {
    await cancelDailySummaryNotification();
  }
}
