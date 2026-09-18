import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

// =========================================================================
// TRIAL & SUBSCRIPTION CONSTANTS
// =========================================================================
export const TRIAL_DURATION_DAYS = 7;

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// Durable server-side persistence for subscription states per user
export interface UserSubscriptionRecord {
  userId: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD';
  trialStartDate: string;
  trialEndDate: string;
  subscriptionExpiryDate: string | null;
  subscriptionProductId: string;
  subscriptionBasePlan: string;
  planId?: string;
  purchaseDate?: string;
  expiryDate?: string | null;
  purchaseToken?: string;
  orderId?: string;
  autoRenewing: boolean;
  acknowledged: boolean;
  paymentIssueMessage?: string;
  lastVerifiedAt?: string;
  updatedAt: string;
}

// -------------------------------------------------------------------------
// DURABLE PERSISTENCE LAYER (FIRESTORE + DISK FALLBACK)
// -------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

let FIRESTORE_PROJECT_ID = 'proplead-e5c6a';
let FIRESTORE_DATABASE_ID = 'ai-studio-proplead-10ea62d1-3291-4f7b-9549-788cd49f881d';

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (rawCfg.projectId) FIRESTORE_PROJECT_ID = rawCfg.projectId;
    if (rawCfg.firestoreDatabaseId) FIRESTORE_DATABASE_ID = rawCfg.firestoreDatabaseId;
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json in server.ts:', e);
}

const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;

// In-memory hot cache backed by local disk storage to survive restarts & container wakeups
function initLocalSubscriptionStore(): Map<string, UserSubscriptionRecord> {
  const store = new Map<string, UserSubscriptionRecord>();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [uid, item] of Object.entries(parsed)) {
          if (item && (item as any).userId) {
            store.set(uid, item as UserSubscriptionRecord);
          }
        }
      }
      console.log(`[Subscription Persistence] Restored ${store.size} subscription records from durable disk storage.`);
    }
  } catch (err) {
    console.warn('[Subscription Persistence] Failed to initialize local subscriptions cache:', err);
  }
  return store;
}

const subscriptionStore = initLocalSubscriptionStore();

function persistSubscriptionStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = Object.fromEntries(subscriptionStore.entries());
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(serialized, null, 2), 'utf8');
  } catch (err) {
    console.error('[Subscription Persistence] Error writing subscriptions to disk:', err);
  }
}

// Firestore Field Format Converters
function toFirestoreFields(record: UserSubscriptionRecord): Record<string, any> {
  const effectiveBasePlan = record.subscriptionBasePlan || record.planId || 'quarterly';
  const effectivePlanId = record.planId || record.subscriptionBasePlan || 'quarterly';

  const fields: Record<string, any> = {
    userId: { stringValue: record.userId },
    subscriptionStatus: { stringValue: record.subscriptionStatus },
    trialStartDate: { stringValue: record.trialStartDate },
    trialEndDate: { stringValue: record.trialEndDate },
    subscriptionProductId: { stringValue: record.subscriptionProductId || 'property_agent_pro' },
    subscriptionBasePlan: { stringValue: effectiveBasePlan },
    planId: { stringValue: effectivePlanId },
    autoRenewing: { booleanValue: Boolean(record.autoRenewing) },
    acknowledged: { booleanValue: Boolean(record.acknowledged) },
    updatedAt: { stringValue: record.updatedAt || new Date().toISOString() },
  };

  const resolvedExpiry = record.subscriptionExpiryDate || record.expiryDate;
  if (resolvedExpiry) {
    fields.subscriptionExpiryDate = { stringValue: resolvedExpiry };
    fields.expiryDate = { stringValue: resolvedExpiry };
  } else {
    fields.subscriptionExpiryDate = { nullValue: null };
  }

  if (record.purchaseDate) {
    fields.purchaseDate = { stringValue: record.purchaseDate };
  }
  if (record.purchaseToken) {
    fields.purchaseToken = { stringValue: record.purchaseToken };
  }
  if (record.orderId) {
    fields.orderId = { stringValue: record.orderId };
  }
  if (record.paymentIssueMessage) {
    fields.paymentIssueMessage = { stringValue: record.paymentIssueMessage };
  }
  if (record.lastVerifiedAt) {
    fields.lastVerifiedAt = { stringValue: record.lastVerifiedAt };
  }

  return fields;
}

function fromFirestoreFields(fields: Record<string, any>): UserSubscriptionRecord | null {
  if (!fields || !fields.userId) return null;

  const resolvedExpiry = fields.subscriptionExpiryDate?.stringValue || fields.expiryDate?.stringValue || null;
  const basePlan = fields.subscriptionBasePlan?.stringValue || fields.planId?.stringValue || 'quarterly';
  const planId = fields.planId?.stringValue || fields.subscriptionBasePlan?.stringValue || 'quarterly';

  return {
    userId: fields.userId.stringValue || '',
    subscriptionStatus: (fields.subscriptionStatus?.stringValue || 'TRIAL') as any,
    trialStartDate: fields.trialStartDate?.stringValue || new Date().toISOString(),
    trialEndDate: fields.trialEndDate?.stringValue || new Date().toISOString(),
    subscriptionExpiryDate: resolvedExpiry,
    expiryDate: resolvedExpiry,
    subscriptionProductId: fields.subscriptionProductId?.stringValue || 'property_agent_pro',
    subscriptionBasePlan: basePlan,
    planId,
    purchaseDate: fields.purchaseDate?.stringValue,
    purchaseToken: fields.purchaseToken?.stringValue,
    orderId: fields.orderId?.stringValue,
    autoRenewing: fields.autoRenewing?.booleanValue ?? false,
    acknowledged: fields.acknowledged?.booleanValue ?? false,
    paymentIssueMessage: fields.paymentIssueMessage?.stringValue,
    lastVerifiedAt: fields.lastVerifiedAt?.stringValue,
    updatedAt: fields.updatedAt?.stringValue || new Date().toISOString(),
  };
}

// -------------------------------------------------------------------------
// FIREBASE AUTH TOKEN CRYPTOGRAPHIC VERIFICATION (SERVER-SIDE)
// -------------------------------------------------------------------------
export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  exp: number;
}

let cachedGoogleCerts: Record<string, string> | null = null;
let certsExpiryTime = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < certsExpiryTime) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certs: HTTP ${res.status}`);
    }
    const cacheControl = res.headers.get('cache-control') || '';
    const match = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
    certsExpiryTime = now + maxAgeSeconds * 1000;
    cachedGoogleCerts = (await res.json()) as Record<string, string>;
    return cachedGoogleCerts;
  } catch (err) {
    if (cachedGoogleCerts) return cachedGoogleCerts;
    throw err;
  }
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseToken | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const signature = Buffer.from(parts[2], 'base64url');

    if (header.alg !== 'RS256' || !header.kid) {
      return null;
    }

    let certs = await getGooglePublicCerts();
    let cert = certs[header.kid];
    if (!cert) {
      cachedGoogleCerts = null;
      certs = await getGooglePublicCerts();
      cert = certs[header.kid];
      if (!cert) return null;
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isValid = verifier.verify(cert, signature);
    if (!isValid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) return null;
    if (payload.aud !== FIRESTORE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIRESTORE_PROJECT_ID}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;

    return {
      uid: payload.sub,
      email: payload.email,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function parseServiceAccountCredentials(raw?: string): any | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If user provided a standard Google API key (starts with 'AIza'), this is NOT a service account JSON
  if (trimmed.startsWith('AIza')) {
    console.warn('[Google Play Auth] GOOGLE_PLAY_SERVICE_ACCOUNT_KEY starts with "AIza" (Google API Key). Google Play Developer API requires a Google Cloud Service Account JSON credentials object with private_key.');
    return null;
  }

  // 1. Raw JSON string
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && (parsed.client_email || parsed.type === 'service_account')) {
        return parsed;
      }
    } catch {
      // Invalid JSON string
    }
  }

  // 2. File path to credentials JSON file
  if ((trimmed.endsWith('.json') || trimmed.startsWith('/') || trimmed.startsWith('./')) && fs.existsSync(trimmed)) {
    try {
      const content = fs.readFileSync(trimmed, 'utf8').trim();
      if (content.startsWith('{')) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && (parsed.client_email || parsed.type === 'service_account')) {
          return parsed;
        }
      }
    } catch {
      // Ignore file error
    }
  }

  // 3. Base64 encoded JSON string
  // A base64-encoded JSON object starting with '{' begins with 'ey' in base64
  if (trimmed.startsWith('ey')) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object' && (parsed.client_email || parsed.type === 'service_account')) {
          return parsed;
        }
      }
    } catch {
      // Ignore base64 error
    }
  }

  return null;
}

let cachedDatastoreToken: { token: string; expiresAt: number } | null = null;

async function getFirestoreServiceAccountToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedDatastoreToken && now < cachedDatastoreToken.expiresAt) {
    return cachedDatastoreToken.token;
  }

  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY);

  try {
    // 1. Prefer explicit Service Account JSON credentials if configured
    // 2. Otherwise use Application Default Credentials (ADC) natively available on Google Cloud Run
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/datastore'],
    };
    if (credentials) {
      authOptions.credentials = credentials;
    }
    const auth = new google.auth.GoogleAuth(authOptions);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (tokenResponse?.token) {
      cachedDatastoreToken = {
        token: tokenResponse.token,
        expiresAt: now + 50 * 60 * 1000,
      };
      return tokenResponse.token;
    }
  } catch (err) {
    console.warn('[Firestore Persistence] Service account / ADC auth warning:', err);
  }

  return null;
}

async function getFirestoreWriteToken(idToken?: string): Promise<string | null> {
  // 1. Prefer Service Account or ADC token which has admin privileges
  const saToken = await getFirestoreServiceAccountToken();
  if (saToken) return saToken;
  // 2. Fall back to user's Firebase ID token (authorized by Firestore rules to update their own /users/{userId})
  if (idToken) return idToken;
  return null;
}

async function getFirestoreReadToken(idToken?: string): Promise<string | null> {
  // 1. If an ID Token is provided in the request from Firebase Auth, use it for reads
  if (idToken) {
    return idToken;
  }
  // 2. Otherwise try service account / ADC token
  return getFirestoreServiceAccountToken();
}

async function syncSubscriptionToFirestore(record: UserSubscriptionRecord, idToken?: string): Promise<boolean> {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      return false;
    }

    const docUrl = `${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(record.userId)}`;
    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(record),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Firestore Persistence] Write to /subscriptions failed (${res.status}):`, errText);
      return false;
    }

    console.log(`[Firestore Persistence] Persisted subscription for user ${record.userId} to /subscriptions.`);
    return true;
  } catch (err) {
    console.warn('[Firestore Persistence] Network error writing subscription:', err);
    return false;
  }
}

/**
 * Persists active subscription fields directly to /users/{userId} in Firestore.
 * This guarantees the client app's onSnapshot real-time listener fires immediately,
 * unlocking Pro status on all screens without requiring a manual refresh.
 */
async function syncUserProfileSubscriptionToFirestore(
  userId: string,
  record: {
    isSubscribed: boolean;
    subscriptionStatus: string;
    subscriptionExpiryDate: string | null;
    subscriptionProductId: string;
    subscriptionBasePlan: string;
    planId?: string;
    purchaseDate?: string;
    expiryDate?: string | null;
    lastVerifiedAt?: string;
    autoRenewing: boolean;
  },
  idToken?: string
): Promise<boolean> {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      console.warn(`[Firestore User Sync] No auth token available to update /users/${userId}`);
      return false;
    }

    const fieldMasks = [
      'updateMask.fieldPaths=isSubscribed',
      'updateMask.fieldPaths=subscriptionStatus',
      'updateMask.fieldPaths=subscriptionProductId',
      'updateMask.fieldPaths=subscriptionBasePlan',
      'updateMask.fieldPaths=planId',
      'updateMask.fieldPaths=autoRenewing',
      'updateMask.fieldPaths=updatedAt',
    ];

    const effectiveBasePlan = record.subscriptionBasePlan || record.planId || 'quarterly';
    const effectivePlanId = record.planId || record.subscriptionBasePlan || 'quarterly';

    const fields: Record<string, any> = {
      isSubscribed: { booleanValue: record.isSubscribed },
      subscriptionStatus: { stringValue: record.subscriptionStatus },
      subscriptionProductId: { stringValue: record.subscriptionProductId },
      subscriptionBasePlan: { stringValue: effectiveBasePlan },
      planId: { stringValue: effectivePlanId },
      autoRenewing: { booleanValue: record.autoRenewing },
      updatedAt: { stringValue: new Date().toISOString() },
    };

    const resolvedExpiry = record.subscriptionExpiryDate || record.expiryDate;
    if (resolvedExpiry) {
      fieldMasks.push('updateMask.fieldPaths=subscriptionExpiryDate');
      fields.subscriptionExpiryDate = { stringValue: resolvedExpiry };
      fieldMasks.push('updateMask.fieldPaths=expiryDate');
      fields.expiryDate = { stringValue: resolvedExpiry };
    }

    if (record.purchaseDate) {
      fieldMasks.push('updateMask.fieldPaths=purchaseDate');
      fields.purchaseDate = { stringValue: record.purchaseDate };
    }

    if (record.lastVerifiedAt) {
      fieldMasks.push('updateMask.fieldPaths=lastVerifiedAt');
      fields.lastVerifiedAt = { stringValue: record.lastVerifiedAt };
    }

    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}?${fieldMasks.join('&')}`;
    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Firestore User Sync] Failed updating /users/${userId} (${res.status}):`, errText);
      return false;
    }

    console.log(`[Firestore User Sync] Successfully updated /users/${userId} in Firestore with status "${record.subscriptionStatus}".`);
    return true;
  } catch (err) {
    console.warn(`[Firestore User Sync] Error updating /users/${userId}:`, err);
    return false;
  }
}

export interface FirestoreFetchResult {
  status: 'FOUND' | 'NOT_FOUND' | 'ERROR';
  record: UserSubscriptionRecord | null;
}

async function fetchSubscriptionFromFirestore(userId: string, idToken?: string): Promise<FirestoreFetchResult> {
  try {
    const token = await getFirestoreReadToken(idToken);
    if (!token) {
      return { status: 'NOT_FOUND', record: null };
    }

    const docUrl = `${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(userId)}`;
    const res = await fetch(docUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 404) {
      return { status: 'NOT_FOUND', record: null };
    }

    if (!res.ok) {
      console.warn(`[Firestore Persistence] Firestore returned HTTP status ${res.status}`);
      return { status: 'ERROR', record: null };
    }

    const docData = await res.json();
    const parsed = fromFirestoreFields(docData.fields);
    if (parsed) {
      return { status: 'FOUND', record: parsed };
    }
    return { status: 'NOT_FOUND', record: null };
  } catch (err) {
    console.warn('[Firestore Persistence] Error reading subscription from Firestore:', err);
    return { status: 'ERROR', record: null };
  }
}

async function fetchUserProfileFromFirestore(userId: string, idToken?: string): Promise<{
  trialEndDate?: string;
  trialStartDate?: string;
  createdAt?: string;
  subscriptionStatus?: string;
} | null> {
  try {
    const token = await getFirestoreReadToken(idToken);
    if (!token) return null;
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}`;
    const res = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const docData = await res.json();
    const fields = docData.fields || {};
    return {
      trialEndDate: fields.trialEndDate?.stringValue,
      trialStartDate: fields.trialStartDate?.stringValue,
      createdAt: fields.createdAt?.stringValue || fields.updatedAt?.stringValue,
      subscriptionStatus: fields.subscriptionStatus?.stringValue,
    };
  } catch (err) {
    console.warn(`[Firestore User] Could not fetch profile for user ${userId}:`, err);
    return null;
  }
}

export interface GetSubscriptionResult {
  record: UserSubscriptionRecord | null;
  unavailable?: boolean;
}

export async function getSubscriptionRecord(
  userId: string,
  idToken?: string
): Promise<GetSubscriptionResult> {
  // 1. Authoritatively check Firestore
  const remote = await fetchSubscriptionFromFirestore(userId, idToken);

  if (remote.status === 'FOUND' && remote.record) {
    subscriptionStore.set(userId, remote.record);
    persistSubscriptionStoreToDisk();
    return { record: remote.record, unavailable: false };
  }

  // 2. If cached in durable disk store, return it
  if (subscriptionStore.has(userId)) {
    return { record: subscriptionStore.get(userId)!, unavailable: false };
  }

  // 3. remote.status === 'NOT_FOUND' or remote store unconfigured:
  // User does not yet have a record in /subscriptions/{userId}
  // Check if user already had an existing account in /users/{userId} to preserve authoritative trialEndDate
  const userProfile = await fetchUserProfileFromFirestore(userId, idToken);

  const serverNow = new Date();
  let trialStart: Date;
  let trialEnd: Date;
  let isExpired = false;

  if (userProfile?.trialEndDate) {
    // Authoritative trialEndDate found in Firestore
    const parsedEnd = new Date(userProfile.trialEndDate);
    if (!isNaN(parsedEnd.getTime())) {
      trialEnd = parsedEnd;
      if (userProfile.trialStartDate) {
        const parsedStart = new Date(userProfile.trialStartDate);
        trialStart = !isNaN(parsedStart.getTime()) ? parsedStart : new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      } else {
        trialStart = new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      }
      // Ensure trialEnd never exceeds TRIAL_DURATION_DAYS (7 days) from trialStart
      const maxAllowedEnd = new Date(trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      if (trialEnd.getTime() > maxAllowedEnd.getTime()) {
        trialEnd = maxAllowedEnd;
      }
      if (serverNow.getTime() >= trialEnd.getTime()) {
        isExpired = true;
      }
    } else {
      console.warn(`[Subscription Record] Invalid trialEndDate in /users/${userId}:`, userProfile.trialEndDate);
      isExpired = true;
      trialStart = serverNow;
      trialEnd = serverNow;
    }
  } else if (userProfile?.trialStartDate || userProfile?.createdAt) {
    const accountDate = new Date(userProfile.trialStartDate || userProfile.createdAt!);
    if (!isNaN(accountDate.getTime())) {
      trialStart = accountDate;
      trialEnd = new Date(accountDate.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      if (serverNow.getTime() >= trialEnd.getTime()) {
        isExpired = true;
      }
    } else {
      isExpired = true;
      trialStart = serverNow;
      trialEnd = serverNow;
    }
  } else {
    // New trial initialization only if user has never existed
    trialStart = serverNow;
    trialEnd = new Date(serverNow.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  }

  const defaultRecord: UserSubscriptionRecord = {
    userId,
    subscriptionStatus: isExpired ? 'EXPIRED' : 'TRIAL',
    trialStartDate: trialStart.toISOString(),
    trialEndDate: trialEnd.toISOString(),
    subscriptionExpiryDate: null,
    subscriptionProductId: 'property_agent_pro',
    subscriptionBasePlan: 'monthly',
    autoRenewing: false,
    acknowledged: false,
    updatedAt: serverNow.toISOString(),
  };

  subscriptionStore.set(userId, defaultRecord);
  persistSubscriptionStoreToDisk();
  syncSubscriptionToFirestore(defaultRecord, idToken).catch(() => {});

  return { record: defaultRecord, unavailable: false };
}

async function saveSubscriptionRecord(
  record: UserSubscriptionRecord,
  idToken?: string
): Promise<{ subscriptionsCollectionSynced: boolean; userProfileSynced: boolean }> {
  record.updatedAt = new Date().toISOString();
  subscriptionStore.set(record.userId, record);
  persistSubscriptionStoreToDisk();

  // 1. Sync to /subscriptions/{userId}
  const subOk = await syncSubscriptionToFirestore(record, idToken);

  // 2. Sync to /users/{userId} to immediately unlock Pro capabilities for the client
  const isSub = record.subscriptionStatus === 'ACTIVE' || record.subscriptionStatus === 'CANCELED_BUT_ACTIVE';
  const userOk = await syncUserProfileSubscriptionToFirestore(
    record.userId,
    {
      isSubscribed: isSub,
      subscriptionStatus: record.subscriptionStatus,
      subscriptionExpiryDate: record.subscriptionExpiryDate,
      subscriptionProductId: record.subscriptionProductId || 'property_agent_pro',
      subscriptionBasePlan: record.subscriptionBasePlan || record.planId || 'quarterly',
      planId: record.planId || record.subscriptionBasePlan || 'quarterly',
      purchaseDate: record.purchaseDate,
      expiryDate: record.expiryDate || record.subscriptionExpiryDate,
      lastVerifiedAt: record.lastVerifiedAt,
      autoRenewing: Boolean(record.autoRenewing),
    },
    idToken
  );

  return {
    subscriptionsCollectionSynced: subOk,
    userProfileSynced: userOk,
  };
}

// Subscription product & 2 paid base plans matching Google Play Console setup
const GOOGLE_PLAY_PRODUCT = {
  productId: 'property_agent_pro',
  title: 'Choose Your Plan',
  subtitle: 'Unlock all PropLead features',
  description: 'Keep your property leads, customers, follow-ups and property matching organized.',
  plans: {
    monthly: {
      id: 'monthly',
      basePlanId: 'monthly',
      name: 'Monthly',
      durationLabel: '1 Month',
      price: 79,
      priceFormatted: '₹79',
      billingPeriod: 'P1M',
      billingText: '₹79 every month',
      shortText: 'Flexible monthly plan',
      ctaText: 'Continue with ₹79 Monthly',
      durationMonths: 1,
    },
    quarterly: {
      id: 'quarterly',
      basePlanId: 'quarterly',
      name: '3 Months',
      durationLabel: '3 Months',
      price: 199,
      priceFormatted: '₹199',
      billingPeriod: 'P3M',
      billingText: '₹199 every 3 months',
      perMonthText: '₹66.33/month',
      badge: 'BEST VALUE',
      savingsText: 'Save ₹38',
      shortText: 'Best value for active agents',
      ctaText: 'Continue with ₹199 / 3 Months',
      durationMonths: 3,
    },
  },
  features: [
    'Unlimited leads',
    'Property management',
    'Follow-up reminders',
    'Property visit reminders',
    'Calendar',
    'Analytics',
    'WhatsApp and call shortcuts',
    'Property matching',
    'Cloud backup',
    'Multi-device access',
    'All future Pro improvements',
  ],
};

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.proplead.tracker';

// =========================================================================
// GOOGLE PLAY DEVELOPER API SERVICE INITIALIZATION (ANDROID PUBLISHER V3)
// =========================================================================
let androidPublisherClient: any = null;

function getAndroidPublisherClient() {
  if (androidPublisherClient) return androidPublisherClient;

  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY);

  // In Cloud Run (K_SERVICE is set) or production, Application Default Credentials are provided by the container
  // In local development, credentials must be provided or we fall back to sandbox mode
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  if (!credentials && !isCloudRun && process.env.NODE_ENV !== 'production') {
    return null;
  }

  try {
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    };
    if (credentials) {
      authOptions.credentials = credentials;
    }
    const auth = new google.auth.GoogleAuth(authOptions);

    androidPublisherClient = google.androidpublisher({
      version: 'v3',
      auth,
    });

    console.log('[Google Play Developer API] Android Publisher v3 client initialized.');
    return androidPublisherClient;
  } catch (err) {
    console.error('[Google Play Developer API] Error initializing Google Auth client:', err);
    return null;
  }
}

/**
 * Authoritatively verifies purchaseToken with Google Play Developer API
 * Uses Google Play Developer API as the sole authoritative source of truth.
 * Parses and returns the exact expiry timestamp returned by Google Play (never calculating locally).
 */
async function verifyGooglePlaySubscriptionToken(
  purchaseToken: string,
  productId: string = 'property_agent_pro',
  basePlanId: string = 'quarterly',
  packageName: string = PACKAGE_NAME
): Promise<{
  isValid: boolean;
  orderId: string;
  subscriptionStatus: 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD' | 'PENDING';
  subscriptionExpiryDate: string; // Authoritative ISO timestamp string directly from Google Play
  autoRenewing: boolean;
  acknowledged: boolean;
  verificationPending?: boolean;
  error?: string;
  message?: string;
  basePlanId?: string;
}> {
  const effectivePackage = packageName || PACKAGE_NAME || 'com.proplead.tracker';
  const client = getAndroidPublisherClient();

  if (!client) {
    console.warn('[Google Play Developer API] Android Publisher API client is not initialized or credentials missing.');
    return {
      isValid: false,
      orderId: '',
      subscriptionStatus: 'PENDING',
      subscriptionExpiryDate: '',
      autoRenewing: false,
      acknowledged: false,
      verificationPending: true,
      error: 'SUBSCRIPTION_VERIFICATION_PENDING',
      message: 'Purchase completed but verification is temporarily unavailable.',
    };
  }

  try {
    console.log(`[Google Play API] Authoritatively querying Google Play Developer API for package "${effectivePackage}", plan "${basePlanId}", token prefix: "${purchaseToken.substring(0, 10)}..."`);

    let subData: any = null;
    try {
      const resV2 = await client.purchases.subscriptionsv2.get({
        packageName: effectivePackage,
        token: purchaseToken,
      });
      subData = resV2.data;
    } catch (v2Err: any) {
      console.warn(`[Google Play API] subscriptionsv2.get notice (${v2Err?.message}), checking subscriptions.get v1 API...`);
      try {
        const resV1 = await client.purchases.subscriptions.get({
          packageName: effectivePackage,
          subscriptionId: productId,
          token: purchaseToken,
        });
        const v1Data = resV1.data;
        subData = {
          latestOrderId: v1Data.orderId,
          lineItems: [
            {
              expiryTime: v1Data.expiryTimeMillis ? new Date(Number(v1Data.expiryTimeMillis)).toISOString() : null,
              autoRenewingPlan: v1Data.autoRenewing ? {} : undefined,
              offerDetails: {
                basePlanId: basePlanId,
              },
            },
          ],
          acknowledgementState: v1Data.acknowledgementState === 1 ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
          subscriptionState: v1Data.paymentState === 1 ? 'SUBSCRIPTION_STATE_ACTIVE' : (v1Data.paymentState === 0 ? 'SUBSCRIPTION_STATE_PENDING' : 'SUBSCRIPTION_STATE_ACTIVE'),
        };
      } catch {
        throw v2Err;
      }
    }

    console.log('[Google Play API Authoritative Response]', JSON.stringify(subData));

    const lineItem = subData.lineItems?.[0];
    const expiryTime: string | null = lineItem?.expiryTime || null;

    // Strict Expiry Rule: Do not calculate local days. Expiry must come directly from Google Play.
    if (!expiryTime) {
      console.error('[Google Play API] Google Play response does not contain an authoritative expiry timestamp.');
      return {
        isValid: false,
        orderId: subData.latestOrderId || '',
        subscriptionStatus: 'PENDING',
        subscriptionExpiryDate: '',
        autoRenewing: false,
        acknowledged: false,
        verificationPending: true,
        error: 'SUBSCRIPTION_VERIFICATION_PENDING',
        message: 'Purchase completed but verification is temporarily unavailable.',
      };
    }

    const expiryMs = new Date(expiryTime).getTime();
    if (isNaN(expiryMs) || expiryMs <= Date.now()) {
      return {
        isValid: false,
        orderId: subData.latestOrderId || '',
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: true,
        error: 'Subscription has expired in Google Play.',
      };
    }

    const orderId = subData.latestOrderId || `GPA.${Date.now()}`;
    const autoRenewing = lineItem?.autoRenewingPlan != null;
    const subState = subData.subscriptionState;

    if (subState === 'SUBSCRIPTION_STATE_EXPIRED') {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: true,
        error: 'Subscription has expired in Google Play.',
      };
    }

    if (
      subState === 'SUBSCRIPTION_STATE_ON_HOLD' ||
      subState === 'SUBSCRIPTION_STATE_PAUSED' ||
      subState === 'SUBSCRIPTION_STATE_PENDING'
    ) {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: 'PENDING',
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: false,
        error: `Google Play subscription is not in an active paid state (${subState}).`,
      };
    }

    // Check base plan match if returned by Google Play
    const playBasePlanId = lineItem?.offerDetails?.basePlanId;
    if (playBasePlanId && playBasePlanId !== 'monthly' && playBasePlanId !== 'quarterly') {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: false,
        error: `Unrecognized Google Play base plan: ${playBasePlanId}. Expected monthly or quarterly.`,
      };
    }

    let subscriptionStatus: 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' = 'ACTIVE';
    if (subState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
      subscriptionStatus = 'PAYMENT_ISSUE';
    } else if (subState === 'SUBSCRIPTION_STATE_CANCELED') {
      subscriptionStatus = 'CANCELED_BUT_ACTIVE';
    }

    // Acknowledge if pending
    if (subData.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      try {
        await client.purchases.subscriptions.acknowledge({
          packageName: effectivePackage,
          subscriptionId: productId,
          token: purchaseToken,
          requestBody: {},
        });
        console.log('[Google Play API] Acknowledged purchase with Google Play.');
      } catch (ackErr) {
        console.warn('[Google Play API] Acknowledge call non-fatal notice:', ackErr);
      }
    }

    return {
      isValid: true,
      orderId,
      subscriptionStatus,
      subscriptionExpiryDate: expiryTime,
      autoRenewing,
      acknowledged: true,
      basePlanId: playBasePlanId || basePlanId,
    };
  } catch (apiErr: any) {
    console.error('[Google Play Developer API Error]', apiErr?.message || apiErr);

    const errMessage = String(apiErr?.message || '');
    const statusCode = apiErr?.code || apiErr?.status;

    // Definite 404 from Google Play: token does not exist on Google Play
    if (statusCode === 404 || errMessage.includes('Requested entity was not found') || errMessage.includes('not found')) {
      return {
        isValid: false,
        orderId: '',
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiryDate: '',
        autoRenewing: false,
        acknowledged: false,
        error: 'Google Play reported that this purchase token was not found.',
      };
    }

    // For all other errors (permissions, service-account unlinked, credentials, network, timeout, 5xx):
    // Never trust client purchase token and never grant 30/90 days of Pro access.
    // Return structured pending verification.
    return {
      isValid: false,
      orderId: '',
      subscriptionStatus: 'PENDING',
      subscriptionExpiryDate: '',
      autoRenewing: false,
      acknowledged: false,
      verificationPending: true,
      error: 'SUBSCRIPTION_VERIFICATION_PENDING',
      message: 'Purchase completed but verification is temporarily unavailable.',
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // CORS middleware for API endpoints (critical for Android Capacitor requests)
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Helper to extract bearer token from headers
  const extractIdToken = (req: express.Request): string | undefined => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return undefined;
  };

  // Helper to cryptographically authenticate Firebase ID token and verify UID ownership
  const authenticateRequest = async (
    req: express.Request,
    res: express.Response
  ): Promise<string | null> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Bearer token.',
      });
      return null;
    }

    const token = authHeader.substring(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (!verified) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired Firebase ID token.',
      });
      return null;
    }

    // Verify client-supplied userId matches the cryptographically verified UID
    const requestedUserId = (req.query.userId as string) || req.body?.userId;
    if (requestedUserId && requestedUserId !== verified.uid) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Access denied for requested user ID.',
      });
      return null;
    }

    return verified.uid;
  };

  // ==========================================
  // GOOGLE PLAY BILLING API ENDPOINTS
  // ==========================================

  // 1. Health check
  app.get('/api/health', (req, res) => {
    const rawKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || '';
    const trimmed = rawKey.trim();
    const isApiKey = trimmed.startsWith('AIza');
    const saCredentials = parseServiceAccountCredentials(rawKey);

    res.json({
      status: 'ok',
      service: 'proplead-billing-server',
      googlePlayApiConfigured: Boolean(saCredentials),
      serviceAccountEmail: saCredentials?.client_email || null,
      serviceAccountStatus: isApiKey
        ? 'INVALID_API_KEY_AIza (Service account JSON required, not API key)'
        : (saCredentials ? 'CONFIGURED' : (trimmed ? 'INVALID_FORMAT' : 'NOT_CONFIGURED')),
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Query subscription product details from Google Play catalog
  app.get('/api/billing/product-details', (req, res) => {
    res.json({
      success: true,
      product: GOOGLE_PLAY_PRODUCT,
    });
  });

  // 3. Get server-authoritative subscription & trial status
  app.get('/api/billing/subscription-status', async (req, res) => {
    try {
      const verifiedUid = await authenticateRequest(req, res);
      if (!verifiedUid) return;

      const idToken = extractIdToken(req);
      const subResult = await getSubscriptionRecord(verifiedUid, idToken);

      if (subResult.unavailable || !subResult.record) {
        return res.status(503).json({
          success: false,
          error: 'Subscription service is temporarily unavailable. Please retry shortly.',
        });
      }

      const record = subResult.record;

      // Compute live state based on authoritative expiration timestamps
      const now = Date.now();
      let currentStatus = record.subscriptionStatus;

      if (currentStatus === 'TRIAL') {
        const trialEndTime = new Date(record.trialEndDate).getTime();
        if (isNaN(trialEndTime) || now > trialEndTime) {
          currentStatus = 'EXPIRED';
          record.subscriptionStatus = 'EXPIRED';
          await saveSubscriptionRecord(record, idToken);
        }
      } else if (currentStatus === 'CANCELED_BUT_ACTIVE') {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime) {
            currentStatus = 'EXPIRED';
            record.subscriptionStatus = 'EXPIRED';
            await saveSubscriptionRecord(record, idToken);
          }
        }
      } else if (currentStatus === 'ACTIVE') {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime && !record.autoRenewing) {
            currentStatus = 'EXPIRED';
            record.subscriptionStatus = 'EXPIRED';
            await saveSubscriptionRecord(record, idToken);
          }
        }
      }

      const trialEndTime = new Date(record.trialEndDate).getTime();
      const trialDaysRemaining = isNaN(trialEndTime)
        ? 0
        : Math.max(0, Math.ceil((trialEndTime - now) / (1000 * 60 * 60 * 24)));

      const serverTimestamp = new Date(now).toISOString();

      res.json({
        success: true,
        userId: record.userId,
        subscriptionStatus: currentStatus,
        trialStartDate: record.trialStartDate,
        trialEndDate: record.trialEndDate,
        serverTimestamp,
        serverNow: serverTimestamp,
        currentServerTimestamp: serverTimestamp,
        trialDaysRemaining,
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        expiryDate: record.expiryDate || record.subscriptionExpiryDate,
        subscriptionProductId: record.subscriptionProductId,
        subscriptionBasePlan: record.subscriptionBasePlan,
        planId: record.planId || record.subscriptionBasePlan || 'quarterly',
        purchaseDate: record.purchaseDate,
        lastVerifiedAt: record.lastVerifiedAt,
        autoRenewing: record.autoRenewing,
        paymentIssueMessage: record.paymentIssueMessage,
        isSubscribed: currentStatus === 'ACTIVE' || currentStatus === 'CANCELED_BUT_ACTIVE',
        isFeatureLocked: currentStatus === 'EXPIRED',
      });
    } catch (err: any) {
      console.error('[Subscription Status Error]:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to retrieve subscription status' });
    }
  });

  // 4. Verify Google Play Purchase using Google Play Developer API as sole Source of Truth
  const handleVerifyPurchase = async (req: express.Request, res: express.Response) => {
    // Ensure all responses are strictly JSON
    res.setHeader('Content-Type', 'application/json');

    try {
      // 1. FIREBASE UID SECURITY
      // Require Authorization: Bearer <Firebase ID token>
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[Google Play Verification] Rejected: Missing Authorization Bearer token.');
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing Bearer token.',
          message: 'Please sign in to verify your purchase.',
        });
      }

      const idToken = authHeader.substring(7).trim();
      if (!idToken) {
        console.warn('[Google Play Verification] Rejected: Empty Bearer token.');
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing Bearer token.',
          message: 'Please sign in to verify your purchase.',
        });
      }

      // Verify token server-side via Google public certificates
      const verifiedToken = await verifyFirebaseIdToken(idToken);
      if (!verifiedToken || !verifiedToken.uid) {
        console.warn('[Google Play Verification] Rejected: Firebase ID token is invalid or expired.');
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired Firebase ID token.',
          message: 'Your session has expired. Please sign in again.',
        });
      }

      // Derive UID EXCLUSIVELY from verifiedToken.uid - NEVER trust client-supplied userId
      const verifiedUid = verifiedToken.uid;

      const {
        purchaseToken,
        productId = 'property_agent_pro',
        basePlanId = 'quarterly',
        packageName: bodyPackageName,
        userId: bodyUserId,
      } = req.body || {};

      // If client supplied a userId in the body, reject if it does not match verified UID
      if (bodyUserId && String(bodyUserId) !== verifiedUid) {
        console.warn(`[Google Play Verification] Rejected: Client body userId "${bodyUserId}" does not match token UID "${verifiedUid}".`);
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Authenticated UID does not match requested userId.',
        });
      }

      // 4. PURCHASE OWNERSHIP VALIDATIONS (HTTP 400 for malformed purchase data)
      const REQUIRED_PACKAGE_NAME = 'com.proplead.tracker';
      const REQUIRED_PRODUCT_ID = 'property_agent_pro';

      // Log request details
      console.log(`[Google Play Verification] Request received: ${req.method} ${req.originalUrl || req.path}`);
      console.log(`[Google Play Verification] Authenticated UID: ${verifiedUid}`);
      console.log(`[Google Play Verification] Product ID: ${productId}`);
      console.log(`[Google Play Verification] Base Plan ID: ${basePlanId}`);
      console.log(`[Google Play Verification] Purchase token present: ${purchaseToken ? 'YES' : 'NO'} (length: ${purchaseToken ? String(purchaseToken).length : 0})`);

      if (!purchaseToken || typeof purchaseToken !== 'string' || purchaseToken.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid purchaseToken for server verification.',
        });
      }

      if (bodyPackageName && bodyPackageName !== REQUIRED_PACKAGE_NAME) {
        return res.status(400).json({
          success: false,
          error: `Invalid package name: "${bodyPackageName}". Expected "${REQUIRED_PACKAGE_NAME}".`,
        });
      }

      if (productId !== REQUIRED_PRODUCT_ID) {
        return res.status(400).json({
          success: false,
          error: `Invalid product ID: "${productId}". Expected "${REQUIRED_PRODUCT_ID}".`,
        });
      }

      if (basePlanId !== 'monthly' && basePlanId !== 'quarterly') {
        return res.status(400).json({
          success: false,
          error: `Invalid base plan ID: "${basePlanId}". Expected "monthly" or "quarterly".`,
        });
      }

      // Ensure purchase token is not already registered to a different account (prevent token theft/replay)
      for (const [existingUid, existingRec] of subscriptionStore.entries()) {
        if (existingRec.purchaseToken === purchaseToken && existingUid !== verifiedUid) {
          console.error(`[Google Play Verification Security Alert] Token already registered to UID "${existingUid}". Rejecting UID "${verifiedUid}".`);
          return res.status(403).json({
            success: false,
            error: 'This purchase token is already registered to a different account.',
          });
        }
      }

      // 2. Query Google Play Developer API as the sole authoritative source of truth
      const verification = await verifyGooglePlaySubscriptionToken(
        purchaseToken,
        REQUIRED_PRODUCT_ID,
        basePlanId,
        REQUIRED_PACKAGE_NAME
      );

      console.log(`[Google Play Verification] Google Play verification result: ${verification.isValid ? 'SUCCESS' : 'FAILED'} (status: "${verification.subscriptionStatus}", pending: ${Boolean(verification.verificationPending)})`);

      // 2 & 6. If Google Play verification cannot be completed: HTTP 503 JSON
      if (verification.verificationPending) {
        return res.status(503).json({
          success: false,
          error: 'SUBSCRIPTION_VERIFICATION_PENDING',
          message: 'Purchase completed but verification is temporarily unavailable.',
        });
      }

      // If Google Play returned invalid or expired purchase: HTTP 400
      if (!verification.isValid) {
        console.error(`[Google Play Verification] Token validation rejected for user ${verifiedUid}:`, verification.error);
        return res.status(400).json({
          success: false,
          error: verification.error || 'Google Play purchase token verification failed.',
        });
      }

      // 3. EXPIRY DATE: Authoritative expiry timestamp must be present from Google Play
      if (!verification.subscriptionExpiryDate) {
        console.error('[Google Play Verification] Missing authoritative expiry date from Google Play.');
        return res.status(503).json({
          success: false,
          error: 'SUBSCRIPTION_VERIFICATION_PENDING',
          message: 'Purchase completed but verification is temporarily unavailable.',
        });
      }

      const effectiveBasePlan = verification.basePlanId || basePlanId;
      const nowIso = new Date().toISOString();

      // Retrieve or initialize subscription record for verified UID
      let record: UserSubscriptionRecord;
      try {
        const subResult = await getSubscriptionRecord(verifiedUid, idToken);
        if (subResult.record) {
          record = subResult.record;
        } else {
          record = {
            userId: verifiedUid,
            subscriptionStatus: 'ACTIVE',
            trialStartDate: nowIso,
            trialEndDate: nowIso,
            subscriptionExpiryDate: verification.subscriptionExpiryDate,
            expiryDate: verification.subscriptionExpiryDate,
            subscriptionProductId: REQUIRED_PRODUCT_ID,
            subscriptionBasePlan: effectiveBasePlan,
            planId: effectiveBasePlan,
            purchaseDate: nowIso,
            autoRenewing: verification.autoRenewing,
            acknowledged: true,
            updatedAt: nowIso,
          };
        }
      } catch {
        record = {
          userId: verifiedUid,
          subscriptionStatus: 'ACTIVE',
          trialStartDate: nowIso,
          trialEndDate: nowIso,
          subscriptionExpiryDate: verification.subscriptionExpiryDate,
          expiryDate: verification.subscriptionExpiryDate,
          subscriptionProductId: REQUIRED_PRODUCT_ID,
          subscriptionBasePlan: effectiveBasePlan,
          planId: effectiveBasePlan,
          purchaseDate: nowIso,
          autoRenewing: verification.autoRenewing,
          acknowledged: true,
          updatedAt: nowIso,
        };
      }

      // 5. FIRESTORE: Authoritatively update record ONLY after successful Google Play verification
      record.userId = verifiedUid;
      record.subscriptionStatus = verification.subscriptionStatus === 'CANCELED_BUT_ACTIVE' ? 'CANCELED_BUT_ACTIVE' : 'ACTIVE';
      record.subscriptionProductId = REQUIRED_PRODUCT_ID;
      record.subscriptionBasePlan = effectiveBasePlan;
      record.planId = effectiveBasePlan;
      record.purchaseDate = record.purchaseDate || nowIso;
      record.purchaseToken = purchaseToken;
      record.orderId = verification.orderId;
      record.subscriptionExpiryDate = verification.subscriptionExpiryDate; // Strictly authoritative from Google Play
      record.expiryDate = verification.subscriptionExpiryDate;
      record.autoRenewing = verification.autoRenewing;
      record.acknowledged = verification.acknowledged;
      record.paymentIssueMessage = undefined;
      record.lastVerifiedAt = nowIso;

      // 5. Persist to Firestore:
      // /subscriptions/{verifiedUid}: subscriptionStatus = ACTIVE
      // /users/{verifiedUid}: isSubscribed = true, subscriptionStatus = ACTIVE
      let firestoreResult = { subscriptionsCollectionSynced: false, userProfileSynced: false };
      try {
        firestoreResult = await saveSubscriptionRecord(record, idToken);
      } catch (saveErr) {
        console.error('[Google Play Verification] Error persisting verified record to Firestore:', saveErr);
      }

      const firestoreStatusString = `subscriptions: ${firestoreResult.subscriptionsCollectionSynced ? 'UPDATED' : 'SKIPPED/FAILED'}, user profile: ${firestoreResult.userProfileSynced ? 'UPDATED' : 'SKIPPED/FAILED'}`;
      console.log(`[Google Play Verification] Firestore update result: ${firestoreStatusString}`);
      console.log(`[Google Play Billing] Subscription verified and activated for ${verifiedUid}. Plan: ${effectiveBasePlan}, Expiry: ${record.subscriptionExpiryDate}, OrderId: ${verification.orderId}`);

      // 6. HTTP 200 ONLY after successful verification
      return res.status(200).json({
        success: true,
        subscriptionStatus: 'active',
        plan: effectiveBasePlan,
        planId: effectiveBasePlan,
        subscriptionBasePlan: effectiveBasePlan,
        subscriptionProductId: REQUIRED_PRODUCT_ID,
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        expiryDate: record.subscriptionExpiryDate,
        orderId: verification.orderId,
        purchaseDate: record.purchaseDate,
        lastVerifiedAt: record.lastVerifiedAt,
        autoRenewing: record.autoRenewing,
        verified: true,
        message: 'Google Play subscription verified and activated successfully.',
      });
    } catch (unexpectedErr: any) {
      console.error('[Google Play Billing Verification Exception]:', unexpectedErr);
      return res.status(500).json({
        success: false,
        error: unexpectedErr?.message || 'Unexpected error occurred during purchase verification.',
      });
    }
  };

  // Mount primary verification route and aliases
  app.post('/api/billing/verify-purchase', handleVerifyPurchase);
  app.post('/api/billing/verify', handleVerifyPurchase);
  app.post('/api/verify-purchase', handleVerifyPurchase);
  app.post('/api/verify', handleVerifyPurchase);

  // Reject non-POST requests to verification endpoints with clear JSON (never HTML fallback)
  app.all(['/api/billing/verify-purchase', '/api/billing/verify', '/api/verify-purchase', '/api/verify'], (req, res) => {
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed on verification endpoint. Please use POST.`,
    });
  });

  // 5. Restore purchases for returning or multi-device user
  app.post('/api/billing/restore-purchases', async (req, res) => {
    const verifiedUid = await authenticateRequest(req, res);
    if (!verifiedUid) return;

    const { purchaseToken, isBridgeAvailable = false, productId = 'property_agent_pro' } = req.body;
    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(verifiedUid, idToken);

    if (subResult.unavailable || !subResult.record) {
      return res.status(503).json({
        success: false,
        error: 'Subscription service temporarily unavailable. Please retry shortly.',
      });
    }

    const record = subResult.record;
    const client = getAndroidPublisherClient();
    const tokenToVerify = purchaseToken || record.purchaseToken;

    if (tokenToVerify) {
      const verification = await verifyGooglePlaySubscriptionToken(tokenToVerify, productId);

      if (verification.verificationPending) {
        return res.status(503).json({
          success: false,
          error: 'SUBSCRIPTION_VERIFICATION_PENDING',
          message: 'Google Play verification is temporarily unavailable. Please retry shortly.',
        });
      }

      if (
        verification.isValid &&
        (verification.subscriptionStatus === 'ACTIVE' || verification.subscriptionStatus === 'CANCELED_BUT_ACTIVE')
      ) {
        record.subscriptionStatus = verification.subscriptionStatus;
        record.subscriptionExpiryDate = verification.subscriptionExpiryDate;
        record.autoRenewing = verification.autoRenewing;
        record.purchaseToken = tokenToVerify;

        await saveSubscriptionRecord(record, idToken);

        return res.json({
          success: true,
          restored: true,
          hasLiveGooglePlayAuth: Boolean(client),
          subscriptionStatus: record.subscriptionStatus,
          subscriptionExpiryDate: record.subscriptionExpiryDate,
          subscriptionProductId: record.subscriptionProductId,
          autoRenewing: record.autoRenewing,
          purchaseToken: tokenToVerify,
          message: 'Active PropLead subscription restored via Google Play!',
        });
      } else {
        return res.json({
          success: true,
          restored: false,
          hasLiveGooglePlayAuth: Boolean(client),
          subscriptionStatus: record.subscriptionStatus,
          message: 'No active PropLead subscription was found for this Google Play account.',
        });
      }
    }

    // If no purchase token exists and running in web preview without live Google Play auth or native bridge:
    if (!client && !isBridgeAvailable) {
      return res.json({
        success: false,
        restored: false,
        billingUnavailable: true,
        hasLiveGooglePlayAuth: false,
        message: 'Google Play billing is currently unavailable. Please try again.',
      });
    }

    // In a live environment where Google Play connected but no active subscription was found
    return res.json({
      success: true,
      restored: false,
      hasLiveGooglePlayAuth: Boolean(client),
      subscriptionStatus: record.subscriptionStatus,
      message: 'No active PropLead subscription was found for this Google Play account.',
    });
  });

  // 6. Handle Google Play Real-Time Developer Notifications (RTDN Pub/Sub Webhook)
  app.post('/api/billing/google-play-webhook', async (req, res) => {
    // Pub/Sub Push Authentication:
    // Requires GOOGLE_PLAY_WEBHOOK_SECRET verification token in query/header or Google Bearer token
    const webhookSecret = process.env.GOOGLE_PLAY_WEBHOOK_SECRET;
    const providedSecret = (req.query.secret as string) || (req.headers['x-webhook-secret'] as string);
    const authHeader = req.headers.authorization;

    if (webhookSecret) {
      if (providedSecret !== webhookSecret) {
        return res.status(401).json({ error: 'Unauthorized webhook call. Secret mismatch.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      if (!authHeader && !providedSecret) {
        return res.status(401).json({ error: 'Unauthorized. Pub/Sub authentication required in production.' });
      }
    }

    try {
      const message = req.body.message;
      if (!message || !message.data) {
        return res.status(200).send('No message data');
      }

      const decodedData = Buffer.from(message.data, 'base64').toString('utf8');
      const rtdnPayload = JSON.parse(decodedData);
      console.log('[Google Play RTDN Notification Received]:', rtdnPayload);

      const subNotification = rtdnPayload.subscriptionNotification;
      if (subNotification) {
        const { notificationType, purchaseToken, subscriptionId } = subNotification;
        // notificationType: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 4=PURCHASED, 5=ON_HOLD, 6=IN_GRACE_PERIOD, 7=RESTARTED, 12=REVOKED, 13=EXPIRED
        console.log(`[Google Play RTDN] Processing type ${notificationType} for subscription ${subscriptionId}`);

        // Re-verify with Google Play to get authoritative new expiry date
        const verification = await verifyGooglePlaySubscriptionToken(purchaseToken, subscriptionId);

        // Find matching record by purchaseToken in persistent store
        for (const rec of subscriptionStore.values()) {
          if (rec.purchaseToken === purchaseToken) {
            if (verification.isValid) {
              rec.subscriptionStatus =
                verification.subscriptionStatus === 'CANCELED_BUT_ACTIVE'
                  ? 'CANCELED_BUT_ACTIVE'
                  : (verification.subscriptionStatus === 'PAYMENT_ISSUE' ? 'PAYMENT_ISSUE' : 'ACTIVE');
              rec.subscriptionExpiryDate = verification.subscriptionExpiryDate;
              rec.autoRenewing = verification.autoRenewing;
              await saveSubscriptionRecord(rec);
              console.log(`[Google Play RTDN] Updated subscription for user ${rec.userId} to ${rec.subscriptionStatus}`);
            } else if (verification.subscriptionStatus === 'EXPIRED') {
              rec.subscriptionStatus = 'EXPIRED';
              await saveSubscriptionRecord(rec);
            }
            break;
          }
        }
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[Google Play RTDN Error]:', err);
      return res.status(200).send('Error processing RTDN');
    }
  });

  // 7. Handle Cancellation sync from client
  app.post('/api/billing/cancel-sync', async (req, res) => {
    const verifiedUid = await authenticateRequest(req, res);
    if (!verifiedUid) return;

    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(verifiedUid, idToken);
    if (subResult.unavailable || !subResult.record) {
      return res.status(503).json({
        success: false,
        error: 'Subscription service temporarily unavailable. Please retry shortly.',
      });
    }

    const record = subResult.record;
    if (record.subscriptionStatus === 'ACTIVE') {
      // User cancelled auto-renew, but retains access until Play Store expiry date
      record.subscriptionStatus = 'CANCELED_BUT_ACTIVE';
      record.autoRenewing = false;
      await saveSubscriptionRecord(record, idToken);

      return res.json({
        success: true,
        subscriptionStatus: 'CANCELED_BUT_ACTIVE',
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        message: `Subscription cancelled. Access remains active until ${new Date(record.subscriptionExpiryDate!).toLocaleDateString('en-IN')}.`,
      });
    }

    return res.json({
      success: true,
      subscriptionStatus: record.subscriptionStatus,
    });
  });

  // 8. Testing & Sandbox simulation endpoint for testing states
  app.post('/api/billing/simulate', async (req, res) => {
    // In production, this endpoint must NOT exist or work
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { userId = 'usr_001', targetState, customDaysRemaining } = req.body;
    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(userId, idToken);
    const record: UserSubscriptionRecord = subResult.record || {
      userId,
      subscriptionStatus: 'TRIAL',
      trialStartDate: new Date().toISOString(),
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionExpiryDate: null,
      subscriptionProductId: 'property_agent_pro',
      subscriptionBasePlan: 'monthly',
      autoRenewing: false,
      acknowledged: false,
      paymentIssueMessage: undefined,
      updatedAt: new Date().toISOString(),
    };

    const now = new Date();

    if (targetState === 'TRIAL') {
      const days = typeof customDaysRemaining === 'number' ? customDaysRemaining : 7;
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + days);

      record.subscriptionStatus = 'TRIAL';
      record.trialEndDate = trialEnd.toISOString();
      record.subscriptionExpiryDate = null;
      record.autoRenewing = false;
      record.paymentIssueMessage = undefined;
    } else if (targetState === 'ACTIVE') {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 30);

      record.subscriptionStatus = 'ACTIVE';
      record.subscriptionExpiryDate = expiry.toISOString();
      record.autoRenewing = true;
      record.paymentIssueMessage = undefined;
    } else if (targetState === 'CANCELED_BUT_ACTIVE') {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 14); // 14 days remaining in cycle

      record.subscriptionStatus = 'CANCELED_BUT_ACTIVE';
      record.subscriptionExpiryDate = expiry.toISOString();
      record.autoRenewing = false;
      record.paymentIssueMessage = undefined;
    } else if (targetState === 'PAYMENT_ISSUE') {
      record.subscriptionStatus = 'PAYMENT_ISSUE';
      record.paymentIssueMessage = 'Google Play could not renew your ₹49/month subscription. Please update your payment method.';
      record.autoRenewing = true;
    } else if (targetState === 'EXPIRED') {
      const pastEnd = new Date(now);
      pastEnd.setDate(pastEnd.getDate() - 1);

      record.subscriptionStatus = 'EXPIRED';
      record.trialEndDate = pastEnd.toISOString();
      record.subscriptionExpiryDate = pastEnd.toISOString();
      record.autoRenewing = false;
    }

    await saveSubscriptionRecord(record, idToken);

    const trialDaysRemaining = Math.max(
      0,
      Math.ceil((new Date(record.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const simNow = new Date().toISOString();

    res.json({
      success: true,
      userId: record.userId,
      subscriptionStatus: record.subscriptionStatus,
      trialStartDate: record.trialStartDate,
      trialEndDate: record.trialEndDate,
      serverTimestamp: simNow,
      serverNow: simNow,
      trialDaysRemaining,
      subscriptionExpiryDate: record.subscriptionExpiryDate,
      autoRenewing: record.autoRenewing,
      paymentIssueMessage: record.paymentIssueMessage,
      isSubscribed: record.subscriptionStatus === 'ACTIVE' || record.subscriptionStatus === 'CANCELED_BUT_ACTIVE',
      isFeatureLocked: record.subscriptionStatus === 'EXPIRED',
    });
  });

  // 404 handler for any unhandled /api/* routes to prevent falling through to Vite or index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route ${req.method} ${req.path} not found.`,
    });
  });

  // Global error handler for /api/* routes to guarantee JSON response even on unhandled errors
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Express API Error Handler]', err);
    res.status(err.status || 500).json({
      success: false,
      error: err?.message || 'Internal API server error',
    });
  });

  // ==========================================
  // VITE MIDDLEWARE (DEVELOPMENT) OR STATIC (PRODUCTION)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : path.resolve(__dirname, '.');

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`PropLead Full-Stack Server running on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Error]', err);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
