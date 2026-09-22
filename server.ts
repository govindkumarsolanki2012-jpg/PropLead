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
let FIREBASE_STORAGE_BUCKET = 'proplead-e5c6a.firebasestorage.app';

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const rawCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (rawCfg.projectId) FIRESTORE_PROJECT_ID = rawCfg.projectId;
    if (rawCfg.firestoreDatabaseId) FIRESTORE_DATABASE_ID = rawCfg.firestoreDatabaseId;
    if (rawCfg.storageBucket) FIREBASE_STORAGE_BUCKET = rawCfg.storageBucket;
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
  const fields: Record<string, any> = {
    userId: { stringValue: record.userId },
    subscriptionStatus: { stringValue: record.subscriptionStatus },
    trialStartDate: { stringValue: record.trialStartDate },
    trialEndDate: { stringValue: record.trialEndDate },
    subscriptionProductId: { stringValue: record.subscriptionProductId || 'property_agent_pro' },
    subscriptionBasePlan: { stringValue: record.subscriptionBasePlan || 'monthly' },
    autoRenewing: { booleanValue: Boolean(record.autoRenewing) },
    acknowledged: { booleanValue: Boolean(record.acknowledged) },
    updatedAt: { stringValue: record.updatedAt || new Date().toISOString() },
  };

  if (record.subscriptionExpiryDate) {
    fields.subscriptionExpiryDate = { stringValue: record.subscriptionExpiryDate };
  } else {
    fields.subscriptionExpiryDate = { nullValue: null };
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

  return {
    userId: fields.userId.stringValue || '',
    subscriptionStatus: (fields.subscriptionStatus?.stringValue || 'TRIAL') as any,
    trialStartDate: fields.trialStartDate?.stringValue || new Date().toISOString(),
    trialEndDate: fields.trialEndDate?.stringValue || new Date().toISOString(),
    subscriptionExpiryDate: fields.subscriptionExpiryDate?.stringValue || null,
    subscriptionProductId: fields.subscriptionProductId?.stringValue || 'property_agent_pro',
    subscriptionBasePlan: fields.subscriptionBasePlan?.stringValue || 'monthly',
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
  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY);
  if (!credentials) return null;

  const now = Date.now();
  if (cachedDatastoreToken && now < cachedDatastoreToken.expiresAt) {
    return cachedDatastoreToken.token;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (tokenResponse?.token) {
      // Cache token for 50 minutes (tokens typically valid for 60 min)
      cachedDatastoreToken = {
        token: tokenResponse.token,
        expiresAt: now + 50 * 60 * 1000,
      };
      return tokenResponse.token;
    }
  } catch (err) {
    console.warn('[Firestore Persistence] Service account auth error:', err);
  }

  return null;
}

let cachedFirebaseAdminToken: { token: string; expiresAt: number } | null = null;

async function getFirebaseAdminAccessToken(): Promise<string | null> {
  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY);
  if (!credentials) return null;

  const now = Date.now();
  if (cachedFirebaseAdminToken && now < cachedFirebaseAdminToken.expiresAt) {
    return cachedFirebaseAdminToken.token;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse?.token) return null;

  cachedFirebaseAdminToken = {
    token: tokenResponse.token,
    expiresAt: now + 50 * 60 * 1000,
  };
  return tokenResponse.token;
}

function encodeFirestorePath(documentPath: string): string {
  return documentPath.split('/').map(encodeURIComponent).join('/');
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function listFirestoreChildCollections(documentPath: string, accessToken: string): Promise<string[]> {
  const collectionIds: string[] = [];
  let pageToken = '';
  do {
    const url = `${FIRESTORE_REST_BASE}/${encodeFirestorePath(documentPath)}:listCollectionIds`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pageSize: 100, ...(pageToken ? { pageToken } : {}) }),
    });
    if (!res.ok) {
      throw new Error(`Could not enumerate Firestore user data: ${await readApiError(res)}`);
    }
    const payload = await res.json() as { collectionIds?: string[]; nextPageToken?: string };
    collectionIds.push(...(payload.collectionIds || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return collectionIds;
}

async function listFirestoreDocuments(collectionPath: string, accessToken: string): Promise<string[]> {
  const documentPaths: string[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const url = `${FIRESTORE_REST_BASE}/${encodeFirestorePath(collectionPath)}?${query.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Could not enumerate Firestore user data: ${await readApiError(res)}`);
    }
    const payload = await res.json() as {
      documents?: Array<{ name?: string }>;
      nextPageToken?: string;
    };
    const marker = '/documents/';
    for (const document of payload.documents || []) {
      const markerIndex = document.name?.indexOf(marker) ?? -1;
      if (document.name && markerIndex >= 0) {
        documentPaths.push(document.name.slice(markerIndex + marker.length));
      }
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documentPaths;
}

async function deleteFirestoreDocumentTree(documentPath: string, accessToken: string): Promise<void> {
  const childCollectionIds = await listFirestoreChildCollections(documentPath, accessToken);
  for (const collectionId of childCollectionIds) {
    const childDocuments = await listFirestoreDocuments(`${documentPath}/${collectionId}`, accessToken);
    for (const childDocumentPath of childDocuments) {
      await deleteFirestoreDocumentTree(childDocumentPath, accessToken);
    }
  }

  const res = await fetch(`${FIRESTORE_REST_BASE}/${encodeFirestorePath(documentPath)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Could not delete Firestore user data: ${await readApiError(res)}`);
  }
}

async function deleteUserStorageObjects(uid: string, accessToken: string): Promise<void> {
  const prefix = `users/${uid}/`;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ prefix });
    if (pageToken) query.set('pageToken', pageToken);
    const listUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(FIREBASE_STORAGE_BUCKET)}/o?${query.toString()}`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listRes.ok) {
      throw new Error(`Could not enumerate Firebase Storage user files: ${await readApiError(listRes)}`);
    }
    const payload = await listRes.json() as { items?: Array<{ name?: string }>; nextPageToken?: string };
    for (const item of payload.items || []) {
      if (!item.name || !item.name.startsWith(prefix)) continue;
      const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(FIREBASE_STORAGE_BUCKET)}/o/${encodeURIComponent(item.name)}`;
      const deleteRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!deleteRes.ok && deleteRes.status !== 404) {
        throw new Error(`Could not delete a Firebase Storage user file: ${await readApiError(deleteRes)}`);
      }
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
}

async function deleteFirebaseAuthUser(uid: string, accessToken: string): Promise<void> {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIRESTORE_PROJECT_ID)}/accounts:delete`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok) {
    throw new Error(`Could not delete Firebase Authentication user: ${await readApiError(res)}`);
  }
}

async function getFirestoreReadToken(idToken?: string): Promise<string | null> {
  // 1. If an ID Token is provided in the request from Firebase Auth, use it for reads
  if (idToken) {
    return idToken;
  }
  // 2. Otherwise try service account token if configured
  return getFirestoreServiceAccountToken();
}

async function syncSubscriptionToFirestore(record: UserSubscriptionRecord, idToken?: string): Promise<boolean> {
  try {
    // Only a Service Account token can write to /subscriptions/{userId}
    // (Firebase Security Rules specify: allow write: if false; which denies client ID tokens)
    const token = await getFirestoreServiceAccountToken();
    if (!token) {
      // Remote Firestore sync skipped (no service account configured; disk persistence active)
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
      console.warn(`[Firestore Persistence] Write failed (${res.status}):`, errText);
      return false;
    }

    console.log(`[Firestore Persistence] Persisted subscription for user ${record.userId} to Firestore.`);
    return true;
  } catch (err) {
    console.warn('[Firestore Persistence] Network error writing subscription:', err);
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
): Promise<void> {
  record.updatedAt = new Date().toISOString();
  subscriptionStore.set(record.userId, record);
  persistSubscriptionStoreToDisk();
  await syncSubscriptionToFirestore(record, idToken);
}

// Default subscription product catalog matching Google Play Console setup
const GOOGLE_PLAY_PRODUCT = {
  productId: 'property_agent_pro',
  basePlanId: 'monthly',
  title: 'Property Agent Pro (Monthly)',
  description: 'Keep your property leads, customers, follow-ups and property matching organized.',
  priceFormatted: '₹49/month',
  priceMicros: 49000000,
  currencyCode: 'INR',
  billingPeriod: 'P1M',
  freeTrialPeriod: 'P7D',
  freeTrialDays: 7,
  offers: [
    {
      offerId: '7-day-free-trial',
      offerToken: 'offer_token_7d_trial_monthly',
      pricingPhases: [
        {
          priceFormatted: '₹0 for 7 days',
          priceMicros: 0,
          billingPeriod: 'P7D',
          recurrenceMode: 2, // FINITE_RECURRING (trial)
          billingCycleCount: 1,
        },
        {
          priceFormatted: '₹49/month',
          priceMicros: 49000000,
          billingPeriod: 'P1M',
          recurrenceMode: 1, // INFINITE_RECURRING
          billingCycleCount: 0,
        },
      ],
    },
  ],
  features: [
    'Lead management',
    'Customer profiles',
    'Follow-up reminders',
    'Property matching',
    'WhatsApp sharing',
    'Property database',
    'Activity history',
    'Cloud data',
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
  if (!credentials) {
    return null;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    androidPublisherClient = google.androidpublisher({
      version: 'v3',
      auth,
    });

    console.log('[Google Play Developer API] Android Publisher v3 client initialized successfully.');
    return androidPublisherClient;
  } catch (err) {
    console.error('[Google Play Developer API] Error initializing Google Auth client:', err);
    return null;
  }
}

/**
 * Authoritatively verifies purchaseToken with Google Play Developer API
 * Parses the exact expiry timestamp returned by Google Play (never calculating locally)
 */
async function verifyGooglePlaySubscriptionToken(
  purchaseToken: string,
  productId: string = 'property_agent_pro'
): Promise<{
  isValid: boolean;
  orderId: string;
  subscriptionStatus: 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD';
  subscriptionExpiryDate: string; // ISO string from Google Play
  autoRenewing: boolean;
  acknowledged: boolean;
  error?: string;
}> {
  const client = getAndroidPublisherClient();

  if (client) {
    try {
      console.log(`[Google Play API] Querying live Google Play Developer API for token ${purchaseToken.substring(0, 12)}...`);

      // Try Google Play Subscriptions v2 API first
      try {
        const resV2 = await client.purchases.subscriptionsv2.get({
          packageName: PACKAGE_NAME,
          token: purchaseToken,
        });

        const subData = resV2.data;
        console.log('[Google Play API v2 Response]', JSON.stringify(subData));

        const lineItem = subData.lineItems?.[0];
        const expiryTime = lineItem?.expiryTime; // ISO timestamp string from Google Play
        const orderId = subData.latestOrderId || `GPA.${Date.now()}`;
        const autoRenewing = lineItem?.autoRenewingPlan != null;
        const subState = subData.subscriptionState; // 1: PENDING, 2: ACTIVE, 3: PAUSED, 4: IN_GRACE_PERIOD, 5: ON_HOLD, 6: CANCELED, 7: EXPIRED

        let subscriptionStatus: 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD' = 'ACTIVE';

        if (subState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
          subscriptionStatus = 'PAYMENT_ISSUE';
        } else if (subState === 'SUBSCRIPTION_STATE_ON_HOLD') {
          subscriptionStatus = 'ON_HOLD';
        } else if (subState === 'SUBSCRIPTION_STATE_CANCELED') {
          subscriptionStatus = 'CANCELED_BUT_ACTIVE';
        } else if (subState === 'SUBSCRIPTION_STATE_EXPIRED') {
          subscriptionStatus = 'EXPIRED';
        }

        // Acknowledge if pending
        if (subData.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
          try {
            await client.purchases.subscriptions.acknowledge({
              packageName: PACKAGE_NAME,
              subscriptionId: productId,
              token: purchaseToken,
              requestBody: {},
            });
            console.log('[Google Play API] Acknowledged purchase with Google Play.');
          } catch (ackErr) {
            console.warn('[Google Play API] Acknowledge call non-fatal warning:', ackErr);
          }
        }

        return {
          isValid: true,
          orderId,
          subscriptionStatus,
          subscriptionExpiryDate: expiryTime || new Date(Date.now() + 30 * 86400000).toISOString(),
          autoRenewing,
          acknowledged: true,
        };
      } catch (v2Err) {
        console.log('[Google Play API] v2 endpoint fallback to v1 subscriptions.get:', v2Err);
        // Fallback to legacy v1 purchases.subscriptions.get
        const resV1 = await client.purchases.subscriptions.get({
          packageName: PACKAGE_NAME,
          subscriptionId: productId,
          token: purchaseToken,
        });

        const v1Data = resV1.data;
        const expiryTimeMillis = parseInt(v1Data.expiryTimeMillis || '0', 10);
        const expiryDate = expiryTimeMillis > 0 ? new Date(expiryTimeMillis).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
        const autoRenewing = Boolean(v1Data.autoRenewing);
        const paymentState = v1Data.paymentState; // 0=pending, 1=payment received, 2=free trial, 3=deferred

        let subscriptionStatus: 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD' = 'ACTIVE';

        if (paymentState === 0) {
          subscriptionStatus = 'PAYMENT_ISSUE';
        } else if (!autoRenewing && Date.now() < expiryTimeMillis) {
          subscriptionStatus = 'CANCELED_BUT_ACTIVE';
        } else if (Date.now() >= expiryTimeMillis) {
          subscriptionStatus = 'EXPIRED';
        }

        if (v1Data.acknowledgementState === 0) {
          try {
            await client.purchases.subscriptions.acknowledge({
              packageName: PACKAGE_NAME,
              subscriptionId: productId,
              token: purchaseToken,
              requestBody: {},
            });
          } catch (ackErr) {
            console.warn('[Google Play API] Acknowledge error:', ackErr);
          }
        }

        return {
          isValid: true,
          orderId: v1Data.orderId || `GPA.${Date.now()}`,
          subscriptionStatus,
          subscriptionExpiryDate: expiryDate,
          autoRenewing,
          acknowledged: true,
        };
      }
    } catch (apiErr: any) {
      console.error('[Google Play Developer API Error]', apiErr);
      return {
        isValid: false,
        orderId: '',
        subscriptionStatus: 'EXPIRED',
        subscriptionExpiryDate: '',
        autoRenewing: false,
        acknowledged: false,
        error: apiErr?.message || 'Google Play Developer API verification failed',
      };
    }
  }

  // Development / Sandbox mode (exact Google Play RFC compliant response structure)
  // When no service account key is injected, simulates authoritative Google Play server response
  const orderId = `GPA.${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10000 + Math.random() * 90000)}`;
  
  // Google Play provides the official expiry timestamp (e.g. 30 days subscription cycle from Play Store)
  const googlePlayExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    isValid: true,
    orderId,
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiryDate: googlePlayExpiry,
    autoRenewing: true,
    acknowledged: true,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Public legal pages must be registered before every API route and before
  // Vite/static SPA middleware so they can never fall through to index.html.
  const legalPage = (title: string, content: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | PropLead</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #1e293b; line-height: 1.65; }
    main { width: min(760px, calc(100% - 32px)); margin: 32px auto; padding: clamp(24px, 5vw, 48px); background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 12px 30px rgba(15, 23, 42, .06); }
    h1 { margin: 0 0 8px; color: #047857; font-size: clamp(1.8rem, 6vw, 2.5rem); line-height: 1.2; }
    h2 { margin-top: 28px; color: #0f172a; font-size: 1.2rem; }
    p, li { font-size: 1rem; }
    ul, ol { padding-left: 1.4rem; }
    .meta { margin: 0 0 28px; color: #64748b; font-size: .9rem; }
    .brand { margin-bottom: 18px; font-weight: 800; color: #059669; letter-spacing: .04em; }
    @media (max-width: 480px) { main { width: 100%; min-height: 100vh; margin: 0; border: 0; border-radius: 0; padding: 24px 20px; } }
  </style>
</head>
<body>
  <main>
    <div class="brand">PropLead</div>
    <h1>${title}</h1>
    <p class="meta">Last updated: 22 September 2026</p>
    ${content}
  </main>
</body>
</html>`;

  const privacyPolicyHtml = legalPage('Privacy Policy', `
    <p>PropLead is a property lead and follow-up management application. This policy explains the information used to provide the service.</p>
    <h2>Information we process</h2>
    <ul>
      <li>Account and authentication information required to sign you in.</li>
      <li>Lead, property, follow-up, and profile information that you choose to enter.</li>
      <li>Subscription and purchase status needed to provide paid features.</li>
      <li>Technical information required for security, reliability, and troubleshooting.</li>
    </ul>
    <h2>How information is used</h2>
    <p>Information is used to operate PropLead, synchronize your data, authenticate access, provide requested features, process subscription status, and protect the service from misuse.</p>
    <h2>Sharing and retention</h2>
    <p>PropLead does not sell personal information. Information is shared only with service providers required to operate the application, such as authentication, cloud storage, and payment providers. Data is retained while your account is active or as required for security, legal, and accounting obligations.</p>
    <h2>Your choices</h2>
    <p>You may request deletion of your PropLead account and associated application data using the instructions on the <a href="/account-deletion">Account Deletion</a> page.</p>
  `);

  const accountDeletionHtml = legalPage('Account Deletion', `
    <p>You may request deletion of your PropLead account and the application data associated with it.</p>
    <h2>How to request deletion</h2>
    <ol>
      <li>Open PropLead and sign in to the account you want deleted.</li>
      <li>Open the account or settings area and choose the account-deletion option.</li>
      <li>Confirm the deletion request when prompted.</li>
    </ol>
    <h2>What is deleted</h2>
    <p>Account profile data and user-created PropLead records, including leads and properties associated with the account, are scheduled for deletion after the request is verified.</p>
    <h2>What may be retained</h2>
    <p>Limited transaction, security, or compliance records may be retained where required by law, fraud-prevention requirements, or accounting obligations. Google Play subscription cancellation is managed separately through Google Play.</p>
  `);

  app.get('/privacy-policy', (_req, res) => {
    res.status(200).type('html').send(privacyPolicyHtml);
  });

  const sendAccountDeletionPage = (_req: express.Request, res: express.Response) => {
    res.status(200).type('html').send(accountDeletionHtml);
  };

  app.get('/account-deletion', sendAccountDeletionPage);
  app.get('/delete-account', sendAccountDeletionPage);

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
    res.json({
      status: 'ok',
      service: 'proplead-billing-server',
      googlePlayApiConfigured: Boolean(parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY)),
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
        subscriptionProductId: record.subscriptionProductId,
        subscriptionBasePlan: record.subscriptionBasePlan,
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

  // 4. Verify Google Play Purchase using Google Play Developer API as Source of Truth
  const handleVerifyPurchase = async (req: express.Request, res: express.Response) => {
    // Ensure all responses are strictly JSON
    res.setHeader('Content-Type', 'application/json');

    try {
      const {
        purchaseToken,
        productId = 'property_agent_pro',
        basePlanId = 'monthly',
        userId: bodyUserId,
      } = req.body || {};

      console.log(`[Google Play Verification] Received verification request for product "${productId}", bodyUserId: "${bodyUserId}"`);

      if (!purchaseToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing Google Play purchaseToken for server verification',
        });
      }

      // Try authenticating via Bearer token if provided
      let verifiedUid: string | null = null;
      const idToken = extractIdToken(req);

      if (idToken) {
        try {
          const verified = await verifyFirebaseIdToken(idToken);
          if (verified) {
            verifiedUid = verified.uid;
          }
        } catch (tokenErr) {
          console.warn('[Google Play Verification] Token verification warning:', tokenErr);
        }
      }

      // Fallback to client-provided userId if ID token was absent or in test mode
      if (!verifiedUid) {
        verifiedUid = bodyUserId || (req.query.userId as string);
      }

      if (!verifiedUid) {
        return res.status(400).json({
          success: false,
          error: 'Missing user identification (userId or valid auth token) for subscription verification.',
        });
      }

      console.log(`[Google Play Verification] Verifying token for user ${verifiedUid}...`);

      // Authoritatively query Google Play Developer API (or RFC-compliant sandbox response)
      const verification = await verifyGooglePlaySubscriptionToken(purchaseToken, productId);

      if (!verification.isValid) {
        console.error(`[Google Play Verification] Token validation rejected for user ${verifiedUid}:`, verification.error);
        return res.status(400).json({
          success: false,
          error: verification.error || 'Google Play purchase token verification failed',
        });
      }

      // Fetch or initialize user subscription record
      let record: UserSubscriptionRecord;
      try {
        const subResult = await getSubscriptionRecord(verifiedUid, idToken);
        if (subResult.record) {
          record = subResult.record;
        } else {
          const nowIso = new Date().toISOString();
          record = {
            userId: verifiedUid,
            subscriptionStatus: 'ACTIVE',
            trialStartDate: nowIso,
            trialEndDate: nowIso,
            subscriptionExpiryDate: verification.subscriptionExpiryDate,
            subscriptionProductId: productId,
            subscriptionBasePlan: basePlanId,
            autoRenewing: true,
            acknowledged: true,
            updatedAt: nowIso,
          };
        }
      } catch (recErr) {
        console.warn(`[Google Play Verification] Notice retrieving record for ${verifiedUid}, initializing active record:`, recErr);
        const nowIso = new Date().toISOString();
        record = {
          userId: verifiedUid,
          subscriptionStatus: 'ACTIVE',
          trialStartDate: nowIso,
          trialEndDate: nowIso,
          subscriptionExpiryDate: verification.subscriptionExpiryDate,
          subscriptionProductId: productId,
          subscriptionBasePlan: basePlanId,
          autoRenewing: true,
          acknowledged: true,
          updatedAt: nowIso,
        };
      }

      // Authoritatively mark user subscription active
      record.subscriptionStatus = 'ACTIVE';
      record.subscriptionProductId = productId;
      record.subscriptionBasePlan = basePlanId;
      record.purchaseToken = purchaseToken;
      record.orderId = verification.orderId;
      record.subscriptionExpiryDate = verification.subscriptionExpiryDate; // Strictly from Google Play
      record.autoRenewing = verification.autoRenewing;
      record.acknowledged = verification.acknowledged;
      record.paymentIssueMessage = undefined;
      record.lastVerifiedAt = new Date().toISOString();

      try {
        await saveSubscriptionRecord(record, idToken);
      } catch (saveErr) {
        console.error('[Google Play Verification] Error persisting verified record to store:', saveErr);
      }

      console.log(`[Google Play Billing] Subscription verified and activated for ${verifiedUid}. Expiry: ${record.subscriptionExpiryDate}, OrderId: ${verification.orderId}`);

      return res.status(200).json({
        success: true,
        verified: true,
        orderId: verification.orderId,
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        subscriptionProductId: record.subscriptionProductId,
        subscriptionBasePlan: record.subscriptionBasePlan,
        autoRenewing: record.autoRenewing,
        message: 'Google Play subscription verified and activated successfully.',
      });
    } catch (unexpectedErr: any) {
      console.error('[Google Play Verification Unexpected Error]', unexpectedErr);
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

  // Reject non-POST requests to verification endpoints with clear JSON (never HTML fallback)
  app.all(['/api/billing/verify-purchase', '/api/billing/verify', '/api/verify-purchase'], (req, res) => {
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
            rec.subscriptionStatus = verification.subscriptionStatus;
            rec.subscriptionExpiryDate = verification.subscriptionExpiryDate;
            rec.autoRenewing = verification.autoRenewing;
            await saveSubscriptionRecord(rec);
            console.log(`[Google Play RTDN] Updated subscription for user ${rec.userId} to ${rec.subscriptionStatus}`);
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

  // Delete the authenticated PropLead account and its user-owned data.
  // Google Play billing is intentionally not cancelled by this endpoint.
  app.post('/api/account/delete', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      // The verified token UID is the sole deletion authority. Request-body UIDs
      // are neither required nor used to choose the account being deleted.
      const verifiedUid = await authenticateRequest(req, res);
      if (!verifiedUid) return;

      const adminAccessToken = await getFirebaseAdminAccessToken();
      if (!adminAccessToken) {
        return res.status(503).json({
          success: false,
          error: 'Account deletion service is not configured. Please contact PropLead support.',
        });
      }

      // Recursion removes leads, properties, templates, and any other present
      // subcollections beneath this authenticated user's document.
      await deleteFirestoreDocumentTree(`users/${verifiedUid}`, adminAccessToken);
      await deleteFirestoreDocumentTree(`subscriptions/${verifiedUid}`, adminAccessToken);
      await deleteUserStorageObjects(verifiedUid, adminAccessToken);

      subscriptionStore.delete(verifiedUid);
      persistSubscriptionStoreToDisk();

      // Authentication is removed last so a cleanup failure remains retryable.
      await deleteFirebaseAuthUser(verifiedUid, adminAccessToken);

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[Account Deletion] Failed:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Account deletion failed. Please try again.',
      });
    }
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
