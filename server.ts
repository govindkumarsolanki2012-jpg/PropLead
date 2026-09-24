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
  subscriptionStatus: 'NOT_STARTED' | 'TRIAL' | 'ACTIVE' | 'CANCELED_BUT_ACTIVE' | 'PAYMENT_ISSUE' | 'EXPIRED' | 'ON_HOLD';
  trialStatus?: 'not_started' | 'active' | 'expired';
  trialEverStarted?: boolean;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  subscriptionExpiryDate: string | null;
  subscriptionExpiryTime?: string | null;
  subscriptionProductId: string;
  subscriptionBasePlan: string;
  subscriptionBasePlanId?: string;
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
  const effectiveBasePlan = record.subscriptionBasePlanId || record.subscriptionBasePlan || record.planId || 'quarterly';
  const effectivePlanId = record.planId || record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly';
  const rawStatus = String(record.subscriptionStatus || 'NOT_STARTED');

  const fields: Record<string, any> = {
    userId: { stringValue: record.userId },
    subscriptionStatus: { stringValue: rawStatus },
    trialStatus: { stringValue: record.trialStatus || (record.subscriptionStatus === 'TRIAL' ? 'active' : (record.trialStartDate ? 'expired' : 'not_started')) },
    trialEverStarted: { booleanValue: Boolean(record.trialEverStarted || record.trialStartDate || record.subscriptionStatus === 'TRIAL') },
    subscriptionProductId: { stringValue: record.subscriptionProductId || 'property_agent_pro' },
    subscriptionBasePlan: { stringValue: effectiveBasePlan },
    subscriptionBasePlanId: { stringValue: effectiveBasePlan },
    planId: { stringValue: effectivePlanId },
    autoRenewing: { booleanValue: Boolean(record.autoRenewing) },
    acknowledged: { booleanValue: Boolean(record.acknowledged) },
    updatedAt: { stringValue: record.updatedAt || new Date().toISOString() },
  };

  if (record.trialStartDate) {
    fields.trialStartDate = { stringValue: record.trialStartDate };
  } else {
    fields.trialStartDate = { nullValue: null };
  }

  if (record.trialEndDate) {
    fields.trialEndDate = { stringValue: record.trialEndDate };
  } else {
    fields.trialEndDate = { nullValue: null };
  }

  const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate || record.expiryDate;
  if (resolvedExpiry) {
    fields.subscriptionExpiryDate = { stringValue: resolvedExpiry };
    fields.subscriptionExpiryTime = { stringValue: resolvedExpiry };
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
  fields.lastVerifiedAt = { stringValue: record.lastVerifiedAt || new Date().toISOString() };

  return fields;
}

function fromFirestoreFields(fields: Record<string, any>): UserSubscriptionRecord | null {
  if (!fields || !fields.userId) return null;

  const resolvedExpiry = fields.subscriptionExpiryTime?.stringValue || fields.subscriptionExpiryDate?.stringValue || fields.expiryDate?.stringValue || null;
  const basePlan = fields.subscriptionBasePlanId?.stringValue || fields.subscriptionBasePlan?.stringValue || fields.planId?.stringValue || 'quarterly';
  const planId = fields.planId?.stringValue || fields.subscriptionBasePlanId?.stringValue || fields.subscriptionBasePlan?.stringValue || 'quarterly';

  let rawStatus = fields.subscriptionStatus?.stringValue || 'NOT_STARTED';
  const upper = rawStatus.toUpperCase();
  if (upper === 'ACTIVE' || upper === 'SUBSCRIBED') {
    rawStatus = 'ACTIVE';
  } else if (upper === 'CANCELED_BUT_ACTIVE') {
    rawStatus = 'CANCELED_BUT_ACTIVE';
  } else if (upper === 'PAYMENT_ISSUE') {
    rawStatus = 'PAYMENT_ISSUE';
  } else if (upper === 'EXPIRED') {
    rawStatus = 'EXPIRED';
  } else if (upper === 'TRIAL') {
    rawStatus = 'TRIAL';
  } else if (upper === 'NOT_STARTED') {
    rawStatus = 'NOT_STARTED';
  } else {
    rawStatus = 'NOT_STARTED';
  }

  const trialStart = fields.trialStartDate?.stringValue || null;
  const trialEnd = fields.trialEndDate?.stringValue || null;
  const trialEverStarted = fields.trialEverStarted?.booleanValue ?? Boolean(trialStart || trialEnd || rawStatus === 'TRIAL');
  const trialStatus = (fields.trialStatus?.stringValue as any) || (rawStatus === 'TRIAL' ? 'active' : (trialEverStarted ? 'expired' : 'not_started'));

  return {
    userId: fields.userId.stringValue || '',
    subscriptionStatus: rawStatus as any,
    trialStatus,
    trialEverStarted,
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
    subscriptionExpiryDate: resolvedExpiry,
    subscriptionExpiryTime: resolvedExpiry,
    expiryDate: resolvedExpiry,
    subscriptionProductId: fields.subscriptionProductId?.stringValue || 'property_agent_pro',
    subscriptionBasePlan: basePlan,
    subscriptionBasePlanId: basePlan,
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

  const credentials = parseServiceAccountCredentials(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);

  try {
    // Prefer a dedicated Firebase admin credential when explicitly configured.
    // Otherwise use the Cloud Run runtime service account through ADC.
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

let cachedFirebaseAdminToken: { token: string; expiresAt: number } | null = null;

async function getFirebaseAdminAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedFirebaseAdminToken && now < cachedFirebaseAdminToken.expiresAt) {
    return cachedFirebaseAdminToken.token;
  }

  const credentials = parseServiceAccountCredentials(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);
  const authOptions: any = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };
  if (credentials) {
    authOptions.credentials = credentials;
  }

  const auth = new google.auth.GoogleAuth(authOptions);
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

async function readDeletionApiError(res: Response): Promise<string> {
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
    const res = await fetch(
      `${FIRESTORE_REST_BASE}/${encodeFirestorePath(documentPath)}:listCollectionIds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageSize: 100, ...(pageToken ? { pageToken } : {}) }),
      }
    );
    if (!res.ok) {
      throw new Error(`Could not enumerate Firestore user data: ${await readDeletionApiError(res)}`);
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
    const res = await fetch(
      `${FIRESTORE_REST_BASE}/${encodeFirestorePath(collectionPath)}?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      throw new Error(`Could not enumerate Firestore user data: ${await readDeletionApiError(res)}`);
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

export interface AccountDeletionJob {
  uid: string;
  email?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  retryCount: number;
  lastError?: string | null;
  trialEverStarted?: boolean;
}

// In-memory set of revoked UIDs whose accounts have been deleted
const revokedUids = new Set<string>();

async function createOrUpdateDeletionJob(job: AccountDeletionJob, accessToken: string): Promise<boolean> {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs/${encodeURIComponent(job.uid)}`;
    const fields: Record<string, any> = {
      uid: { stringValue: job.uid },
      status: { stringValue: job.status },
      requestedAt: { stringValue: job.requestedAt },
      retryCount: { integerValue: String(job.retryCount) },
      updatedAt: { stringValue: new Date().toISOString() },
    };
    if (job.trialEverStarted !== undefined) {
      fields.trialEverStarted = { booleanValue: Boolean(job.trialEverStarted) };
    }
    if (job.email) {
      fields.email = { stringValue: job.email };
    }
    if (job.completedAt) {
      fields.completedAt = { stringValue: job.completedAt };
    } else {
      fields.completedAt = { nullValue: null };
    }
    if (job.lastError) {
      fields.lastError = { stringValue: String(job.lastError).slice(0, 500) };
    } else {
      fields.lastError = { nullValue: null };
    }

    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[DeletionJob] Error writing deletion job to Firestore:', err);
    return false;
  }
}

async function markUserAccountDeletedInFirestore(uid: string, accessToken: string): Promise<boolean> {
  try {
    const fieldMasks = [
      'updateMask.fieldPaths=isDeleted',
      'updateMask.fieldPaths=accountStatus',
      'updateMask.fieldPaths=disabled',
      'updateMask.fieldPaths=deletionRequestedAt',
      'updateMask.fieldPaths=updatedAt',
    ];
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(uid)}?${fieldMasks.join('&')}`;
    const fields: Record<string, any> = {
      isDeleted: { booleanValue: true },
      accountStatus: { stringValue: 'deleted' },
      disabled: { booleanValue: true },
      deletionRequestedAt: { stringValue: new Date().toISOString() },
      updatedAt: { stringValue: new Date().toISOString() },
    };
    const res = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[Account Deletion Phase 1] Error marking user ${uid} deleted:`, err);
    return false;
  }
}

async function listFirestoreDocumentNames(collectionPath: string, accessToken: string): Promise<string[]> {
  const documentNames: string[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300' });
    if (pageToken) query.set('pageToken', pageToken);
    const res = await fetch(
      `${FIRESTORE_REST_BASE}/${encodeFirestorePath(collectionPath)}?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) break;
    const payload = (await res.json()) as { documents?: Array<{ name?: string }>; nextPageToken?: string };
    for (const doc of payload.documents || []) {
      if (doc.name) documentNames.push(doc.name);
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return documentNames;
}

async function batchDeleteFirestoreDocuments(documentNames: string[], accessToken: string): Promise<void> {
  if (documentNames.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < documentNames.length; i += CHUNK_SIZE) {
    const chunk = documentNames.slice(i, i + CHUNK_SIZE);
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:commit`;
    const res = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        writes: chunk.map((name) => ({ delete: name })),
      }),
    });
    if (!res.ok) {
      console.warn(`[Background Cleanup] Batch delete notice (${res.status}):`, await res.text());
    }
  }
}

async function deleteUserStorageObjectsFast(uid: string, accessToken: string): Promise<void> {
  const prefix = `users/${uid}/`;
  let pageToken = '';
  do {
    const query = new URLSearchParams({ prefix, maxResults: '500' });
    if (pageToken) query.set('pageToken', pageToken);
    const listRes = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(FIREBASE_STORAGE_BUCKET)}/o?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (listRes.status === 404 || !listRes.ok) break;
    const payload = (await listRes.json()) as { items?: Array<{ name?: string }>; nextPageToken?: string };
    const items = payload.items || [];
    if (items.length > 0) {
      const BATCH_SIZE = 20;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map((item) => {
            if (!item.name || !item.name.startsWith(prefix)) return Promise.resolve();
            return fetch(
              `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(FIREBASE_STORAGE_BUCKET)}/o/${encodeURIComponent(item.name)}`,
              {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
          })
        );
      }
    }
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
}

async function deleteFirebaseAuthUser(uid: string, accessToken: string): Promise<void> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIRESTORE_PROJECT_ID)}/accounts:delete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid }),
    }
  );
  if (!res.ok && res.status !== 400 && res.status !== 404) {
    throw new Error(`Could not delete Firebase Authentication user: ${await readDeletionApiError(res)}`);
  }
}

async function processAccountDeletionJob(uid: string): Promise<void> {
  const adminAccessToken = await getFirebaseAdminAccessToken();
  if (!adminAccessToken) {
    console.warn(`[Background Cleanup] No admin access token available for deletion job ${uid}`);
    return;
  }

  // 1. Mark status as processing
  await createOrUpdateDeletionJob({
    uid,
    status: 'processing',
    requestedAt: new Date().toISOString(),
    retryCount: 0,
  }, adminAccessToken);

  try {
    // 2. Discover and batch-delete all Firestore subcollections in parallel
    const [leads, properties, templates, notifs] = await Promise.all([
      listFirestoreDocumentNames(`users/${uid}/leads`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/properties`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/templates`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/notifications`, adminAccessToken),
    ]);

    const allDocs = [...leads, ...properties, ...templates, ...notifs];
    if (allDocs.length > 0) {
      await batchDeleteFirestoreDocuments(allDocs, adminAccessToken);
    }

    // 3. Delete user Cloud Storage objects fast with parallel batches
    await deleteUserStorageObjectsFast(uid, adminAccessToken);

    // 4. Delete root user document & subscriptions document
    await Promise.allSettled([
      fetch(`${FIRESTORE_REST_BASE}/users/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminAccessToken}` },
      }),
      fetch(`${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminAccessToken}` },
      }),
    ]);

    // 5. Delete Firebase Auth user if still present
    await deleteFirebaseAuthUser(uid, adminAccessToken).catch(() => {});

    // 6. Mark job completed
    await createOrUpdateDeletionJob({
      uid,
      status: 'completed',
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      retryCount: 0,
      lastError: null,
    }, adminAccessToken);
    revokedUids.delete(uid);

    console.log(`[Background Cleanup] Successfully completed purge for user ${uid}.`);
  } catch (err: any) {
    console.warn(`[Background Cleanup] Notice during cleanup for user ${uid}:`, err);
    await createOrUpdateDeletionJob({
      uid,
      status: 'failed',
      requestedAt: new Date().toISOString(),
      retryCount: 1,
      lastError: err?.message || String(err),
    }, adminAccessToken);
  }
}

let isDeletionWorkerRunning = false;

async function runDeletionWorkerCycle(): Promise<void> {
  if (isDeletionWorkerRunning) return;
  isDeletionWorkerRunning = true;

  try {
    const adminAccessToken = await getFirebaseAdminAccessToken();
    if (!adminAccessToken) return;

    const listUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs?pageSize=50`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    if (!res.ok) return;

    const data = (await res.json()) as { documents?: Array<{ name: string; fields?: Record<string, any> }> };
    const docs = data.documents || [];

    for (const doc of docs) {
      const uid = doc.fields?.uid?.stringValue;
      const status = doc.fields?.status?.stringValue;
      const retryCount = parseInt(doc.fields?.retryCount?.integerValue || '0', 10);
      const updatedAtStr = doc.fields?.updatedAt?.stringValue || doc.fields?.requestedAt?.stringValue;
      const updatedMs = updatedAtStr ? new Date(updatedAtStr).getTime() : 0;
      const isStaleProcessing = status === 'processing' && Date.now() - updatedMs > 10 * 60 * 1000;

      if (uid) {
        if (status === 'pending' || status === 'processing' || (status === 'failed' && retryCount < 5) || isStaleProcessing) {
          revokedUids.add(uid);
        } else if (status === 'completed') {
          revokedUids.delete(uid);
        }

        if (status === 'pending' || (status === 'failed' && retryCount < 5) || isStaleProcessing) {
          await processAccountDeletionJob(uid);
        }
      }
    }
  } catch (err) {
    console.warn('[Deletion Worker Cycle] Notice:', err);
  } finally {
    isDeletionWorkerRunning = false;
  }
}

// Background cleanup worker: runs 5 seconds after startup, then every 60 seconds
setTimeout(() => {
  runDeletionWorkerCycle().catch(() => {});
  setInterval(() => {
    runDeletionWorkerCycle().catch(() => {});
  }, 60 * 1000);
}, 5000);

async function getFirestoreWriteToken(_idToken?: string): Promise<string | null> {
  // Authoritative writes must always use a trusted backend identity.
  // Never fall back to an end-user Firebase ID token.
  return getFirestoreServiceAccountToken();
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
    subscriptionExpiryTime?: string | null;
    subscriptionProductId: string;
    subscriptionBasePlan: string;
    subscriptionBasePlanId?: string;
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
      'updateMask.fieldPaths=subscriptionBasePlanId',
      'updateMask.fieldPaths=planId',
      'updateMask.fieldPaths=autoRenewing',
      'updateMask.fieldPaths=updatedAt',
    ];

    const effectiveBasePlan = record.subscriptionBasePlanId || record.subscriptionBasePlan || record.planId || 'quarterly';
    const effectivePlanId = record.planId || record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly';

    const fields: Record<string, any> = {
      isSubscribed: { booleanValue: record.isSubscribed },
      subscriptionStatus: { stringValue: record.subscriptionStatus },
      subscriptionProductId: { stringValue: record.subscriptionProductId },
      subscriptionBasePlan: { stringValue: effectiveBasePlan },
      subscriptionBasePlanId: { stringValue: effectiveBasePlan },
      planId: { stringValue: effectivePlanId },
      autoRenewing: { booleanValue: record.autoRenewing },
      updatedAt: { stringValue: new Date().toISOString() },
    };

    const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate || record.expiryDate;
    if (resolvedExpiry) {
      fieldMasks.push('updateMask.fieldPaths=subscriptionExpiryDate');
      fields.subscriptionExpiryDate = { stringValue: resolvedExpiry };
      fieldMasks.push('updateMask.fieldPaths=subscriptionExpiryTime');
      fields.subscriptionExpiryTime = { stringValue: resolvedExpiry };
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

/**
 * Searches for a subscription record by purchaseToken.
 * Checks in-memory cache first, then authoritatively queries Firestore /subscriptions.
 * This guarantees RTDN webhooks and verify-purchase checks work reliably across Cloud Run restarts and multi-instances.
 */
async function findSubscriptionRecordByPurchaseToken(purchaseToken: string): Promise<UserSubscriptionRecord | null> {
  if (!purchaseToken) return null;

  // 1. Check in-memory subscription store first
  for (const rec of subscriptionStore.values()) {
    if (rec.purchaseToken === purchaseToken) {
      return rec;
    }
  }

  // 2. Query Firestore /subscriptions collection by purchaseToken
  try {
    const token = await getFirestoreServiceAccountToken();
    if (!token) return null;

    const queryUrl = `${FIRESTORE_REST_BASE}:runQuery`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'subscriptions' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'purchaseToken' },
              op: 'EQUAL',
              value: { stringValue: purchaseToken },
            },
          },
          limit: 1,
        },
      }),
    });

    if (!res.ok) {
      return null;
    }

    const results = (await res.json()) as any[];
    if (Array.isArray(results) && results.length > 0) {
      for (const item of results) {
        if (item.document && item.document.fields) {
          const parsed = fromFirestoreFields(item.document.fields);
          if (parsed) {
            subscriptionStore.set(parsed.userId, parsed);
            persistSubscriptionStoreToDisk();
            return parsed;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Firestore Search] Error finding subscription by purchaseToken:', err);
  }

  return null;
}

/**
 * Reads an existing AccountDeletionJob document from Firestore /accountDeletionJobs/{uid}
 * Used to verify if a returning user previously consumed their 7-day free trial on an earlier account.
 */
async function fetchDeletionJobFromFirestore(uid: string): Promise<AccountDeletionJob | null> {
  try {
    const adminToken = await getFirebaseAdminAccessToken();
    if (!adminToken) return null;
    const docUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs/${encodeURIComponent(uid)}`;
    const res = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) return null;
    const docData = await res.json();
    const fields = docData.fields || {};
    return {
      uid: fields.uid?.stringValue || uid,
      email: fields.email?.stringValue,
      status: fields.status?.stringValue || 'completed',
      requestedAt: fields.requestedAt?.stringValue || '',
      retryCount: parseInt(fields.retryCount?.integerValue || '0', 10),
      trialEverStarted: fields.trialEverStarted?.booleanValue ?? false,
    };
  } catch {
    return null;
  }
}

async function fetchUserProfileFromFirestore(userId: string, idToken?: string): Promise<{
  trialEndDate?: string;
  trialStartDate?: string;
  trialStatus?: string;
  trialEverStarted?: boolean;
  createdAt?: string;
  subscriptionStatus?: string;
  isSubscribed?: boolean;
  subscriptionExpiryDate?: string;
  subscriptionExpiryTime?: string;
  subscriptionProductId?: string;
  subscriptionBasePlan?: string;
  subscriptionBasePlanId?: string;
  planId?: string;
  autoRenewing?: boolean;
  purchaseToken?: string;
  lastVerifiedAt?: string;
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
      trialStatus: fields.trialStatus?.stringValue,
      trialEverStarted: fields.trialEverStarted?.booleanValue,
      createdAt: fields.createdAt?.stringValue || fields.updatedAt?.stringValue,
      subscriptionStatus: fields.subscriptionStatus?.stringValue,
      isSubscribed: fields.isSubscribed?.booleanValue,
      subscriptionExpiryDate: fields.subscriptionExpiryDate?.stringValue,
      subscriptionExpiryTime: fields.subscriptionExpiryTime?.stringValue,
      subscriptionProductId: fields.subscriptionProductId?.stringValue,
      subscriptionBasePlan: fields.subscriptionBasePlan?.stringValue,
      subscriptionBasePlanId: fields.subscriptionBasePlanId?.stringValue,
      planId: fields.planId?.stringValue,
      autoRenewing: fields.autoRenewing?.booleanValue,
      purchaseToken: fields.purchaseToken?.stringValue,
      lastVerifiedAt: fields.lastVerifiedAt?.stringValue,
    };
  } catch (err) {
    console.warn(`[Firestore User] Could not fetch profile for user ${userId}:`, err);
    return null;
  }
}

/**
 * Synchronizes authoritative free trial state to /users/{userId} in Firestore.
 */
async function syncUserProfileTrialToFirestore(
  userId: string,
  trial: {
    trialStatus: 'active' | 'not_started' | 'expired';
    trialStartDate: string | null;
    trialEndDate: string | null;
    trialEverStarted: boolean;
    subscriptionStatus: string;
  },
  idToken?: string
): Promise<boolean> {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      console.warn(`[Firestore User Trial Sync] No auth token available to update /users/${userId}`);
      return false;
    }

    const fieldMasks = [
      'updateMask.fieldPaths=trialStatus',
      'updateMask.fieldPaths=trialEverStarted',
      'updateMask.fieldPaths=subscriptionStatus',
      'updateMask.fieldPaths=updatedAt',
    ];

    const fields: Record<string, any> = {
      trialStatus: { stringValue: trial.trialStatus },
      trialEverStarted: { booleanValue: trial.trialEverStarted },
      subscriptionStatus: { stringValue: trial.subscriptionStatus },
      updatedAt: { stringValue: new Date().toISOString() },
    };

    if (trial.trialStartDate) {
      fieldMasks.push('updateMask.fieldPaths=trialStartDate');
      fields.trialStartDate = { stringValue: trial.trialStartDate };
    } else {
      fieldMasks.push('updateMask.fieldPaths=trialStartDate');
      fields.trialStartDate = { nullValue: null };
    }
    if (trial.trialEndDate) {
      fieldMasks.push('updateMask.fieldPaths=trialEndDate');
      fields.trialEndDate = { stringValue: trial.trialEndDate };
    } else {
      fieldMasks.push('updateMask.fieldPaths=trialEndDate');
      fields.trialEndDate = { nullValue: null };
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
      console.warn(`[Firestore User Trial Sync] Failed updating /users/${userId} (${res.status}):`, errText);
      return false;
    }

    console.log(`[Firestore User Trial Sync] Successfully updated trial for /users/${userId} with trialStatus "${trial.trialStatus}".`);
    return true;
  } catch (err) {
    console.warn(`[Firestore User Trial Sync] Error updating trial for /users/${userId}:`, err);
    return false;
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
  const serverNow = new Date();

  // 1. Authoritatively check Firestore /subscriptions/{userId}
  const remote = await fetchSubscriptionFromFirestore(userId, idToken);

  if (remote.status === 'FOUND' && remote.record) {
    const record = remote.record;
    const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate;
    if (resolvedExpiry && (record.subscriptionStatus === 'ACTIVE' || record.subscriptionStatus === 'CANCELED_BUT_ACTIVE')) {
      const expTime = new Date(resolvedExpiry).getTime();
      if (!isNaN(expTime) && serverNow.getTime() > expTime) {
        record.subscriptionStatus = 'EXPIRED';
        saveSubscriptionRecord(record, idToken).catch(() => {});
      }
    } else if (record.subscriptionStatus === 'TRIAL' && record.trialEndDate) {
      const trialEndTime = new Date(record.trialEndDate).getTime();
      if (!isNaN(trialEndTime) && serverNow.getTime() > trialEndTime) {
        record.subscriptionStatus = 'EXPIRED';
        record.trialStatus = 'expired';
        saveSubscriptionRecord(record, idToken).catch(() => {});
      }
    }
    subscriptionStore.set(userId, record);
    persistSubscriptionStoreToDisk();
    return { record, unavailable: false };
  }

  // 2. Check if user already had an existing account in /users/{userId} to restore verified subscription
  const userProfile = await fetchUserProfileFromFirestore(userId, idToken);

  if (userProfile) {
    const rawSubStatus = userProfile.subscriptionStatus || '';
    const isSubActive =
      userProfile.isSubscribed === true ||
      rawSubStatus.toUpperCase() === 'ACTIVE' ||
      rawSubStatus.toLowerCase() === 'active' ||
      rawSubStatus.toUpperCase() === 'CANCELED_BUT_ACTIVE';

    const resolvedExpiry = userProfile.subscriptionExpiryTime || userProfile.subscriptionExpiryDate;
    if (isSubActive && resolvedExpiry) {
      const expTime = new Date(resolvedExpiry).getTime();
      const isExpiredNow = !isNaN(expTime) && serverNow.getTime() > expTime;

      const restoredRecord: UserSubscriptionRecord = {
        userId,
        subscriptionStatus: isExpiredNow ? 'EXPIRED' : (rawSubStatus.toUpperCase() === 'CANCELED_BUT_ACTIVE' ? 'CANCELED_BUT_ACTIVE' : 'ACTIVE'),
        trialStatus: (userProfile.trialStatus as any) || (userProfile.trialEverStarted ? 'expired' : 'not_started'),
        trialEverStarted: Boolean(userProfile.trialEverStarted),
        trialStartDate: userProfile.trialStartDate || null,
        trialEndDate: userProfile.trialEndDate || null,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        subscriptionProductId: userProfile.subscriptionProductId || 'property_agent_pro',
        subscriptionBasePlan: userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || 'quarterly',
        subscriptionBasePlanId: userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || 'quarterly',
        planId: userProfile.planId || userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || 'quarterly',
        autoRenewing: userProfile.autoRenewing ?? true,
        acknowledged: true,
        purchaseToken: userProfile.purchaseToken,
        lastVerifiedAt: userProfile.lastVerifiedAt || serverNow.toISOString(),
        updatedAt: serverNow.toISOString(),
      };

      subscriptionStore.set(userId, restoredRecord);
      persistSubscriptionStoreToDisk();
      syncSubscriptionToFirestore(restoredRecord, idToken).catch(() => {});
      return { record: restoredRecord, unavailable: false };
    }

    // Check if older existing user already genuinely started a trial before
    const hasGenuineTrial = Boolean(
      (userProfile.trialStartDate && userProfile.trialStartDate !== 'null') ||
      (userProfile.trialEndDate && userProfile.trialEndDate !== 'null') ||
      userProfile.trialEverStarted === true ||
      rawSubStatus.toUpperCase() === 'TRIAL'
    );

    if (hasGenuineTrial) {
      let trialStart: Date = serverNow;
      let trialEnd: Date = serverNow;
      let isExpired = false;

      if (userProfile?.trialEndDate) {
        const parsedEnd = new Date(userProfile.trialEndDate);
        if (!isNaN(parsedEnd.getTime())) {
          trialEnd = parsedEnd;
          if (userProfile.trialStartDate) {
            const parsedStart = new Date(userProfile.trialStartDate);
            trialStart = !isNaN(parsedStart.getTime()) ? parsedStart : new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
          } else {
            trialStart = new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
          }
          const maxAllowedEnd = new Date(trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
          if (trialEnd.getTime() > maxAllowedEnd.getTime()) {
            trialEnd = maxAllowedEnd;
          }
          if (serverNow.getTime() >= trialEnd.getTime()) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }
      } else if (userProfile?.trialStartDate) {
        const parsedStart = new Date(userProfile.trialStartDate);
        if (!isNaN(parsedStart.getTime())) {
          trialStart = parsedStart;
          trialEnd = new Date(parsedStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
          if (serverNow.getTime() >= trialEnd.getTime()) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }
      } else {
        isExpired = true;
      }

      const existingTrialRecord: UserSubscriptionRecord = {
        userId,
        subscriptionStatus: isExpired ? 'EXPIRED' : 'TRIAL',
        trialStatus: isExpired ? 'expired' : 'active',
        trialEverStarted: true,
        trialStartDate: trialStart.toISOString(),
        trialEndDate: trialEnd.toISOString(),
        subscriptionExpiryDate: null,
        subscriptionExpiryTime: null,
        expiryDate: null,
        subscriptionProductId: 'property_agent_pro',
        subscriptionBasePlan: 'monthly',
        subscriptionBasePlanId: 'monthly',
        planId: 'monthly',
        autoRenewing: false,
        acknowledged: false,
        updatedAt: serverNow.toISOString(),
      };

      subscriptionStore.set(userId, existingTrialRecord);
      persistSubscriptionStoreToDisk();
      syncSubscriptionToFirestore(existingTrialRecord, idToken).catch(() => {});
      return { record: existingTrialRecord, unavailable: false };
    }
  }

  // 3. If cached in durable disk store, return it only if genuinely recorded
  if (subscriptionStore.has(userId)) {
    const cached = subscriptionStore.get(userId)!;
    // Guard against any legacy automated trial activation in cache:
    if (cached.subscriptionStatus === 'TRIAL' && !cached.trialEverStarted && !cached.trialStartDate) {
      cached.subscriptionStatus = 'NOT_STARTED';
      cached.trialStatus = 'not_started';
      cached.trialEverStarted = false;
      cached.trialStartDate = null;
      cached.trialEndDate = null;
      persistSubscriptionStoreToDisk();
    }
    return { record: cached, unavailable: false };
  }

  // 4. Default state for a brand-new user: Trial is NOT STARTED until manually tapped.
  // Missing subscription record means NO PAID SUBSCRIPTION and NOT_STARTED trial.
  const defaultRecord: UserSubscriptionRecord = {
    userId,
    subscriptionStatus: 'NOT_STARTED',
    trialStatus: 'not_started',
    trialEverStarted: false,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionExpiryDate: null,
    subscriptionExpiryTime: null,
    expiryDate: null,
    subscriptionProductId: 'property_agent_pro',
    subscriptionBasePlan: 'monthly',
    subscriptionBasePlanId: 'monthly',
    planId: 'monthly',
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

    // Verify account has not been deleted or revoked
    if (revokedUids.has(verified.uid)) {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_DELETED',
        message: 'Account has been deleted.',
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
      } else if (currentStatus === 'ACTIVE' || currentStatus === 'PAYMENT_ISSUE') {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime) {
            // The stored expiryTime has passed. autoRenewing must NOT by itself grant Pro beyond the last verified expiryTime.
            // If we have a stored purchaseToken, refresh live subscription state from Google Play through the backend.
            if (record.purchaseToken) {
              try {
                const refreshed = await verifyGooglePlaySubscriptionToken(
                  record.purchaseToken,
                  record.subscriptionProductId || 'property_agent_pro',
                  record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly',
                  'com.proplead.tracker'
                );

                if (refreshed.isValid && refreshed.subscriptionExpiryDate) {
                  const newExpTime = new Date(refreshed.subscriptionExpiryDate).getTime();
                  if (newExpTime > now) {
                    // Google Play confirms renewal or active subscription period with a new future expiryTime
                    record.subscriptionExpiryDate = refreshed.subscriptionExpiryDate;
                    record.subscriptionExpiryTime = refreshed.subscriptionExpiryDate;
                    record.expiryDate = refreshed.subscriptionExpiryDate;
                    record.autoRenewing = refreshed.autoRenewing;
                    record.lastVerifiedAt = new Date().toISOString();
                    currentStatus = refreshed.subscriptionStatus === 'PAYMENT_ISSUE' ? 'PAYMENT_ISSUE' : (refreshed.subscriptionStatus === 'CANCELED_BUT_ACTIVE' ? 'CANCELED_BUT_ACTIVE' : 'ACTIVE');
                    record.subscriptionStatus = currentStatus;
                    if (refreshed.subscriptionStatus === 'PAYMENT_ISSUE') {
                      record.paymentIssueMessage = 'Google Play grace period: Payment issue detected. Please update payment method to avoid suspension.';
                    } else {
                      record.paymentIssueMessage = undefined;
                    }
                    await saveSubscriptionRecord(record, idToken);
                  } else {
                    // Refreshed expiryTime from Google Play is still in the past
                    currentStatus = 'EXPIRED';
                    record.subscriptionStatus = 'EXPIRED';
                    record.autoRenewing = false;
                    await saveSubscriptionRecord(record, idToken);
                  }
                } else if (refreshed.subscriptionStatus === 'PENDING') {
                  // SubState is ON_HOLD, PAUSED, or PENDING
                  currentStatus = 'EXPIRED';
                  record.subscriptionStatus = 'EXPIRED';
                  record.paymentIssueMessage = refreshed.error || 'Google Play account is on hold. Subscription benefits are paused.';
                  record.autoRenewing = false;
                  await saveSubscriptionRecord(record, idToken);
                } else if (refreshed.subscriptionStatus === 'EXPIRED') {
                  // Google Play reports expired or token not found
                  currentStatus = 'EXPIRED';
                  record.subscriptionStatus = 'EXPIRED';
                  record.autoRenewing = false;
                  await saveSubscriptionRecord(record, idToken);
                } else if (refreshed.verificationPending) {
                  // Temporary network/API failure while re-verifying an already past-due expiry timestamp.
                  // Since the stored paid expiry has already elapsed and cannot be renewed without Google Play confirmation,
                  // mark as expired to prevent granting unverified Pro access beyond expiryTime.
                  currentStatus = 'EXPIRED';
                  record.subscriptionStatus = 'EXPIRED';
                  await saveSubscriptionRecord(record, idToken);
                } else {
                  currentStatus = 'EXPIRED';
                  record.subscriptionStatus = 'EXPIRED';
                  await saveSubscriptionRecord(record, idToken);
                }
              } catch (refreshErr) {
                console.warn('[Subscription Status] Failed to refresh expired token with Google Play:', refreshErr);
                currentStatus = 'EXPIRED';
                record.subscriptionStatus = 'EXPIRED';
                await saveSubscriptionRecord(record, idToken);
              }
            } else {
              // No purchaseToken available to refresh, expire the subscription
              currentStatus = 'EXPIRED';
              record.subscriptionStatus = 'EXPIRED';
              await saveSubscriptionRecord(record, idToken);
            }
          }
        }
      }

      const trialEndTime = record.trialEndDate ? new Date(record.trialEndDate).getTime() : NaN;
      const trialDaysRemaining = (currentStatus === 'TRIAL' && !isNaN(trialEndTime))
        ? Math.max(0, Math.ceil((trialEndTime - now) / (1000 * 60 * 60 * 24)))
        : 0;

      const serverTimestamp = new Date(now).toISOString();
      const trialStatus = record.trialStatus || (currentStatus === 'TRIAL' ? 'active' : (record.trialEverStarted ? 'expired' : 'not_started'));
      const isTrialActive = currentStatus === 'TRIAL' && trialStatus === 'active';

      res.json({
        success: true,
        userId: record.userId,
        subscriptionStatus: currentStatus,
        trialStatus,
        isTrialActive,
        trialEverStarted: Boolean(record.trialEverStarted),
        trialStartDate: record.trialStartDate || null,
        trialEndDate: record.trialEndDate || null,
        serverTimestamp,
        serverNow: serverTimestamp,
        currentServerTimestamp: serverTimestamp,
        trialDaysRemaining,
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        subscriptionExpiryTime: record.subscriptionExpiryTime || record.subscriptionExpiryDate,
        expiryDate: record.expiryDate || record.subscriptionExpiryDate,
        subscriptionProductId: record.subscriptionProductId,
        subscriptionBasePlan: record.subscriptionBasePlan,
        subscriptionBasePlanId: record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly',
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

  // 3.5. Manual Trial Activation (POST /api/billing/start-trial)
  // Only manual user action via this endpoint may activate the 7-day free trial.
  app.post('/api/billing/start-trial', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required. Missing Bearer token.',
        });
      }

      const idToken = authHeader.substring(7).trim();
      const verified = await verifyFirebaseIdToken(idToken);
      if (!verified || !verified.uid) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication session. Please sign in again.',
        });
      }

      const verifiedUid = verified.uid;

      // Ensure UID matches requested body if provided
      if (req.body?.userId && req.body.userId !== verifiedUid) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_USER_MISMATCH',
          message: 'Cannot activate trial for a different user account.',
        });
      }

      // Check current authoritative record
      const subResult = await getSubscriptionRecord(verifiedUid, idToken);
      const currentRecord = subResult.record;
      const userProfile = await fetchUserProfileFromFirestore(verifiedUid, idToken);

      // Check if user already has an active paid subscription
      const isPaidActive =
        (currentRecord && (currentRecord.subscriptionStatus === 'ACTIVE' || currentRecord.subscriptionStatus === 'CANCELED_BUT_ACTIVE')) ||
        (userProfile && (userProfile.isSubscribed || userProfile.subscriptionStatus === 'ACTIVE' || userProfile.subscriptionStatus === 'CANCELED_BUT_ACTIVE'));

      if (isPaidActive) {
        return res.status(400).json({
          success: false,
          error: 'PAID_SUBSCRIPTION_ACTIVE',
          message: 'You already have an active Pro subscription.',
        });
      }

      // Check if user has already started or completed a free trial (including on an earlier deleted account)
      const pastJob = await fetchDeletionJobFromFirestore(verifiedUid);
      const trialAlreadyUsed = Boolean(
        pastJob?.trialEverStarted ||
        currentRecord?.trialEverStarted ||
        currentRecord?.trialStartDate ||
        currentRecord?.trialEndDate ||
        currentRecord?.subscriptionStatus === 'TRIAL' ||
        currentRecord?.subscriptionStatus === 'EXPIRED' ||
        userProfile?.trialEverStarted ||
        userProfile?.trialStartDate ||
        userProfile?.trialEndDate ||
        userProfile?.subscriptionStatus === 'TRIAL' ||
        userProfile?.subscriptionStatus === 'EXPIRED'
      );

      if (trialAlreadyUsed) {
        return res.status(400).json({
          success: false,
          error: 'TRIAL_ALREADY_USED',
          message: 'The 7-day free trial has already been activated for this account.',
        });
      }

      // Authoritative trusted server time
      const serverNow = new Date();
      const trialStartDate = serverNow.toISOString();
      const trialEndDate = new Date(serverNow.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const updatedRecord: UserSubscriptionRecord = {
        ...(currentRecord || {}),
        userId: verifiedUid,
        subscriptionStatus: 'TRIAL',
        trialStatus: 'active',
        trialEverStarted: true,
        trialStartDate,
        trialEndDate,
        subscriptionExpiryDate: null,
        subscriptionExpiryTime: null,
        expiryDate: null,
        subscriptionProductId: 'property_agent_pro',
        subscriptionBasePlan: 'monthly',
        subscriptionBasePlanId: 'monthly',
        planId: 'monthly',
        autoRenewing: false,
        acknowledged: true,
        updatedAt: trialStartDate,
        lastVerifiedAt: trialStartDate,
      };

      // Persist authoritative state to in-memory store, disk, and Firestore
      subscriptionStore.set(verifiedUid, updatedRecord);
      persistSubscriptionStoreToDisk();

      await syncSubscriptionToFirestore(updatedRecord, idToken);
      await syncUserProfileTrialToFirestore(
        verifiedUid,
        {
          trialStatus: 'active',
          trialStartDate,
          trialEndDate,
          trialEverStarted: true,
          subscriptionStatus: 'TRIAL',
        },
        idToken
      );

      console.log(`[Trial Activation] 7-Day free trial started for ${verifiedUid} until ${trialEndDate}`);

      return res.status(200).json({
        success: true,
        subscriptionStatus: 'TRIAL',
        trialStatus: 'active',
        trialStartDate,
        trialEndDate,
        trialEverStarted: true,
        serverNow: trialStartDate,
        serverTimestamp: trialStartDate,
        trialDaysRemaining: TRIAL_DURATION_DAYS,
        message: 'Your 7-day free trial is active',
      });
    } catch (err: any) {
      console.warn('[Trial Activation Notice]:', err?.message || err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to start free trial',
        message: 'Unable to start trial right now. Please try again.',
      });
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

      // Ensure purchase token is not already registered to a different account (prevent token theft/replay across instances)
      const existingTokenOwner = await findSubscriptionRecordByPurchaseToken(purchaseToken);
      if (existingTokenOwner && existingTokenOwner.userId !== verifiedUid) {
        console.error(`[Google Play Verification Security Alert] Token already registered to UID "${existingTokenOwner.userId}". Rejecting UID "${verifiedUid}".`);
        return res.status(403).json({
          success: false,
          error: 'This purchase token is already registered to a different account.',
        });
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
      record.subscriptionBasePlanId = effectiveBasePlan;
      record.planId = effectiveBasePlan;
      record.purchaseDate = record.purchaseDate || nowIso;
      record.purchaseToken = purchaseToken;
      record.orderId = verification.orderId;
      record.subscriptionExpiryDate = verification.subscriptionExpiryDate; // Strictly authoritative from Google Play
      record.subscriptionExpiryTime = verification.subscriptionExpiryDate;
      record.expiryDate = verification.subscriptionExpiryDate;
      record.autoRenewing = verification.autoRenewing;
      record.acknowledged = verification.acknowledged;
      record.paymentIssueMessage = undefined;
      record.lastVerifiedAt = nowIso;

      // 5. Persist to Firestore:
      // /subscriptions/{verifiedUid}: subscriptionStatus = active
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
        subscriptionBasePlanId: effectiveBasePlan,
        subscriptionProductId: REQUIRED_PRODUCT_ID,
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        subscriptionExpiryTime: record.subscriptionExpiryDate,
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
        record.subscriptionExpiryTime = verification.subscriptionExpiryDate;
        record.subscriptionBasePlanId = verification.basePlanId || record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly';
        record.subscriptionBasePlan = record.subscriptionBasePlanId;
        record.planId = record.subscriptionBasePlanId;
        record.autoRenewing = verification.autoRenewing;
        record.purchaseToken = tokenToVerify;
        record.lastVerifiedAt = new Date().toISOString();

        await saveSubscriptionRecord(record, idToken);

        return res.json({
          success: true,
          restored: true,
          hasLiveGooglePlayAuth: Boolean(client),
          subscriptionStatus: record.subscriptionStatus,
          subscriptionExpiryDate: record.subscriptionExpiryDate,
          subscriptionExpiryTime: record.subscriptionExpiryDate,
          subscriptionProductId: record.subscriptionProductId,
          subscriptionBasePlan: record.subscriptionBasePlan,
          subscriptionBasePlanId: record.subscriptionBasePlanId,
          planId: record.planId,
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

    // Check if user already has an active, unexpired record in Firestore
    if (record.subscriptionStatus === 'ACTIVE' || record.subscriptionStatus === 'CANCELED_BUT_ACTIVE') {
      const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate;
      const expTime = resolvedExpiry ? new Date(resolvedExpiry).getTime() : 0;
      if (expTime > Date.now()) {
        return res.json({
          success: true,
          restored: true,
          hasLiveGooglePlayAuth: Boolean(client),
          subscriptionStatus: record.subscriptionStatus,
          subscriptionExpiryDate: record.subscriptionExpiryDate,
          subscriptionExpiryTime: record.subscriptionExpiryTime || record.subscriptionExpiryDate,
          subscriptionProductId: record.subscriptionProductId,
          subscriptionBasePlan: record.subscriptionBasePlan,
          subscriptionBasePlanId: record.subscriptionBasePlanId || record.subscriptionBasePlan || 'quarterly',
          planId: record.planId || record.subscriptionBasePlan || 'quarterly',
          autoRenewing: record.autoRenewing,
          purchaseToken: record.purchaseToken,
          message: 'Active PropLead subscription restored from verified account record!',
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

        // Find matching record by purchaseToken authoritatively (in-memory + Firestore)
        const matchingRecord = await findSubscriptionRecordByPurchaseToken(purchaseToken);
        if (matchingRecord) {
          if (verification.isValid && verification.subscriptionExpiryDate) {
            matchingRecord.subscriptionStatus =
              verification.subscriptionStatus === 'CANCELED_BUT_ACTIVE'
                ? 'CANCELED_BUT_ACTIVE'
                : (verification.subscriptionStatus === 'PAYMENT_ISSUE' ? 'PAYMENT_ISSUE' : 'ACTIVE');
            matchingRecord.subscriptionExpiryDate = verification.subscriptionExpiryDate;
            matchingRecord.subscriptionExpiryTime = verification.subscriptionExpiryDate;
            matchingRecord.expiryDate = verification.subscriptionExpiryDate;
            matchingRecord.autoRenewing = verification.autoRenewing;
            matchingRecord.lastVerifiedAt = new Date().toISOString();
            if (verification.subscriptionStatus === 'PAYMENT_ISSUE') {
              matchingRecord.paymentIssueMessage = 'Google Play grace period: Payment issue detected. Please update payment method to avoid suspension.';
            } else {
              matchingRecord.paymentIssueMessage = undefined;
            }
            await saveSubscriptionRecord(matchingRecord);
            console.log(`[Google Play RTDN] Updated subscription for user ${matchingRecord.userId} to ${matchingRecord.subscriptionStatus}`);
          } else {
            // Revoked (type 12), expired (type 13), on hold (type 5), or invalid
            matchingRecord.subscriptionStatus = 'EXPIRED';
            matchingRecord.autoRenewing = false;
            matchingRecord.lastVerifiedAt = new Date().toISOString();
            if (notificationType === 5 || verification.subscriptionStatus === 'PENDING') {
              matchingRecord.paymentIssueMessage = 'Google Play account is on hold. Subscription benefits are paused.';
            }
            await saveSubscriptionRecord(matchingRecord);
            console.log(`[Google Play RTDN] Marked subscription EXPIRED for user ${matchingRecord.userId} (type ${notificationType})`);
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

  // ==========================================
  // 9. SECURE ACCOUNT DELETION (PHASE 1: FAST IMMEDIATE REVOCATION)
  // ==========================================
  app.post('/api/account/delete', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      // 1. Verify token & extract cryptographically verified UID
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required. Missing Bearer token.',
        });
      }

      const token = authHeader.substring(7).trim();
      const verified = await verifyFirebaseIdToken(token);
      if (!verified) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired Firebase ID token.',
        });
      }

      const verifiedUid = verified.uid;

      const adminAccessToken = await getFirebaseAdminAccessToken();
      if (!adminAccessToken) {
        return res.status(503).json({
          success: false,
          error: 'Account deletion service is temporarily unavailable. Please contact PropLead support.',
        });
      }

      // 2. Determine if user ever started a trial before deleting
      const existingSub = subscriptionStore.get(verifiedUid) || (await fetchSubscriptionFromFirestore(verifiedUid)).record;
      const hadTrial = Boolean(
        existingSub?.trialEverStarted ||
        existingSub?.trialStartDate ||
        existingSub?.trialEndDate ||
        existingSub?.subscriptionStatus === 'TRIAL'
      );

      // Immediately revoke in-memory access & billing cache
      revokedUids.add(verifiedUid);
      subscriptionStore.delete(verifiedUid);
      persistSubscriptionStoreToDisk();

      // 3. Mark account as deleted/disabled in durable storage (Firestore /users/{uid})
      // This immediately causes Firestore security rules to reject any further reads/writes
      await markUserAccountDeletedInFirestore(verifiedUid, adminAccessToken);

      // 4. Create durable background deletion job in Firestore (/accountDeletionJobs/{uid})
      await createOrUpdateDeletionJob({
        uid: verifiedUid,
        email: typeof req.body?.email === 'string' ? req.body.email : verified.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
        completedAt: null,
        trialEverStarted: hadTrial,
      }, adminAccessToken);

      // 5. Attempt Firebase Auth user deletion on server where safely possible
      let authDeletedOnServer = false;
      try {
        await deleteFirebaseAuthUser(verifiedUid, adminAccessToken);
        authDeletedOnServer = true;
      } catch (authErr: any) {
        console.warn('[Account Deletion Phase 1] Server-side Firebase Auth delete notice:', authErr?.message || authErr);
      }

      // 6. Trigger Phase 2 background server cleanup asynchronously without blocking
      setImmediate(() => {
        processAccountDeletionJob(verifiedUid).catch((err) => {
          console.warn('[Account Deletion Phase 2 Background Error]', err);
        });
      });

      // 7. Phase 1 complete! Return immediately under 500ms
      return res.status(200).json({
        success: true,
        phase1Complete: true,
        authDeleted: authDeletedOnServer,
      });
    } catch (err: any) {
      console.warn('[Account Deletion Phase 1] Failed:', err?.message || err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Account deletion failed. Please try again.',
      });
    }
  });

  // ==========================================
  // PUBLIC WEB PAGES: PRIVACY POLICY & ACCOUNT DELETION
  // (Required for Google Play Console submission)
  // ==========================================

  // Public Privacy Policy Web Page
  app.get('/privacy-policy', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy - PropLead Real Estate CRM</title>
  <meta name="description" content="Official Privacy Policy for PropLead CRM for real estate agents and brokers." />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .header { background: #065f46; color: #ffffff; padding: 2.5rem 1.5rem; text-align: center; }
    .header h1 { margin: 0 0 0.5rem; font-size: 1.85rem; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 0; opacity: 0.9; font-size: 0.95rem; }
    .container { max-width: 820px; margin: -1.5rem auto 3rem; background: #ffffff; padding: 2rem 2.5rem; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .pledge { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; }
    .pledge h3 { margin: 0 0 0.5rem; color: #065f46; font-size: 1.05rem; }
    .pledge p { margin: 0; font-size: 0.92rem; color: #047857; }
    h2 { font-size: 1.2rem; color: #0f172a; margin-top: 1.75rem; margin-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.4rem; }
    p, li { font-size: 0.92rem; color: #334155; }
    ul { padding-left: 1.4rem; margin: 0.5rem 0; }
    li { margin-bottom: 0.35rem; }
    .footer { text-align: center; font-size: 0.82rem; color: #64748b; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
    a { color: #059669; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PropLead Privacy Policy</h1>
    <p>Dedicated CRM for Real Estate Agents & Brokers • Effective: September 2026</p>
  </div>
  <div class="container">
    <div class="pledge">
      <h3>🔒 Broker Client Data Protection Guarantee</h3>
      <p>PropLead strictly respects the privacy of your real estate business. <strong>We NEVER sell, rent, monetize, or share your client contacts, buyer requirements, property inventory, private owner details, or conversation notes with third parties, property portals, or advertisers.</strong> Your business data is exclusively yours.</p>
    </div>

    <h2>1. Information We Collect</h2>
    <p>To provide lead tracking, smart matching, and follow-up reminders, we collect:</p>
    <ul>
      <li><strong>Account Details:</strong> Your name, agency name, phone number, city, RERA number, and registered Google account email.</li>
      <li><strong>Lead & Client Records:</strong> Client names, phone numbers, WhatsApp numbers, property preferences (budget, BHK, localities), and notes entered by you.</li>
      <li><strong>Property Inventory:</strong> Listings, pricing, photos, and confidential owner contact details entered by you.</li>
      <li><strong>Voice Notes & Documents:</strong> Audio memos and document attachments uploaded to lead files.</li>
      <li><strong>Subscription Records:</strong> Google Play subscription purchase status, base plan, and expiry date.</li>
    </ul>

    <h2>2. Purpose of Data Processing</h2>
    <p>Your data is processed solely to provide app functionality:</p>
    <ul>
      <li>Managing your buyer/tenant leads and scheduling follow-up notifications.</li>
      <li>Matching buyer requirements with your active property listings.</li>
      <li>Backing up and synchronizing your records across devices via Google Cloud / Firebase.</li>
      <li>Verifying Pro subscription entitlements via Google Play.</li>
    </ul>

    <h2>3. Device Permissions</h2>
    <ul>
      <li><strong>Contacts (Read):</strong> Used strictly when you explicitly choose to import phone contacts as leads. We never access your contacts in the background or upload them elsewhere.</li>
      <li><strong>Microphone / Record Audio:</strong> Used solely when you record voice notes on a specific lead. Recordings are saved only inside that lead's record.</li>
      <li><strong>Notifications:</strong> Used solely to alert you of scheduled follow-ups and site visits at the times you set.</li>
    </ul>

    <h2>4. Data Storage & Security</h2>
    <p>All data is hosted on Google Cloud infrastructure and Firebase Firestore. Each user's database records are strictly isolated using server-side security rules so that only your verified Google authentication credentials can access your business data. All network communication is encrypted with TLS/HTTPS.</p>

    <h2>5. Data Retention & Deletion Rights</h2>
    <p>You have full ownership of your data at all times. You can export your leads to CSV via Settings. You may also permanently delete your account and erase all leads, properties, and backups directly inside the PropLead app (<em>Settings &gt; Account &gt; Delete Account &amp; Data</em>) or through our <a href="/account-deletion">Account Deletion Web Portal</a>.</p>

    <h2>6. Google Play Subscriptions</h2>
    <p>PropLead Pro subscriptions are billed through Google Play. Deleting your PropLead account or uninstalling the app does not automatically cancel active recurring subscriptions in Google Play. Users can manage or cancel their subscription at any time at: <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer">https://play.google.com/store/account/subscriptions</a>.</p>

    <h2>7. Contact Information</h2>
    <p>For questions or privacy inquiries, please contact the PropLead team at: <a href="mailto:jyothigehlot2025@gmail.com">jyothigehlot2025@gmail.com</a>.</p>

    <div class="footer">
      &copy; 2026 PropLead Real Estate CRM. All rights reserved.
    </div>
  </div>
</body>
</html>`);
  });

  // Public Account Deletion Web Portal (Satisfies Google Play Console Delete Account URL requirement)
  app.get(['/account-deletion', '/delete-account'], (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account and Data Deletion - PropLead</title>
  <meta name="description" content="Request permanent account and data deletion for your PropLead real estate CRM account." />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .header { background: #991b1b; color: #ffffff; padding: 2.5rem 1.5rem; text-align: center; }
    .header h1 { margin: 0 0 0.5rem; font-size: 1.85rem; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 0; opacity: 0.9; font-size: 0.95rem; }
    .container { max-width: 760px; margin: -1.5rem auto 3rem; background: #ffffff; padding: 2rem 2.5rem; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; color: #991b1b; }
    .alert-box h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
    .billing-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; color: #92400e; }
    .billing-box h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
    h2 { font-size: 1.2rem; color: #0f172a; margin-top: 1.75rem; margin-bottom: 0.5rem; }
    p, li { font-size: 0.92rem; color: #334155; }
    ul { padding-left: 1.4rem; margin: 0.5rem 0; }
    li { margin-bottom: 0.35rem; }
    .steps { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem 1.5rem; margin: 1rem 0; }
    .steps ol { padding-left: 1.4rem; margin: 0; }
    .steps li { margin-bottom: 0.5rem; font-size: 0.92rem; }
    .form-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; }
    input[type="email"], textarea { width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border: 1px solid #94a3b8; border-radius: 8px; font-size: 0.95rem; }
    button { background: #dc2626; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #b91c1c; }
    a { color: #059669; font-weight: 600; text-decoration: underline; }
    .footer { text-align: center; font-size: 0.82rem; color: #64748b; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PropLead Account &amp; Data Deletion Portal</h1>
    <p>Permanent Account and Business Data Erasure Request</p>
  </div>
  <div class="container">
    <div class="alert-box">
      <h3>⚠️ Permanent &amp; Irreversible Data Deletion</h3>
      <p>Deleting your PropLead account permanently erases your profile, all leads, client phone numbers, WhatsApp history, property listings, private owner details, voice memos, and cloud backups immediately. This action cannot be undone.</p>
    </div>

    <div class="billing-box">
      <h3>Google Play Subscriptions Important Notice</h3>
      <p>Deleting your PropLead account <strong>does not automatically cancel</strong> your active Google Play subscription. In accordance with Google Play policies, recurring subscriptions must be canceled directly via Google Play to stop future billing cycles.
      <br /><br />
      Manage your subscription here: <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer">https://play.google.com/store/account/subscriptions</a>.</p>
    </div>

    <h2>How to Delete Your Account</h2>
    <div class="steps">
      <p><strong>Option 1: Instant In-App Deletion (Recommended)</strong></p>
      <ol>
        <li>Open the PropLead app on your mobile device.</li>
        <li>Tap the <strong>Settings</strong> gear icon in the top header.</li>
        <li>Scroll down to the <strong>Account &amp; Security</strong> section.</li>
        <li>Tap <strong>Delete Account &amp; All Data</strong>.</li>
        <li>Type <code>DELETE</code> to confirm and tap <strong>Permanently Delete Everything</strong>. All data is deleted immediately.</li>
      </ol>
    </div>

    <div class="steps">
      <p><strong>Option 2: Web Deletion Request Form</strong></p>
      <p>If you no longer have access to the mobile app, you can submit a deletion request below using your registered Google account email. Requests are processed within 24–48 hours.</p>
      
      <form action="mailto:jyothigehlot2025@gmail.com?subject=PropLead%20Account%20and%20Data%20Deletion%20Request" method="POST" enctype="text/plain" class="form-box">
        <div class="form-group">
          <label for="email">Registered Google Email Address *</label>
          <input type="email" id="email" name="RegisteredEmail" required placeholder="e.g. broker@gmail.com" />
        </div>
        <div class="form-group">
          <label for="reason">Optional Reason / Notes</label>
          <textarea id="reason" name="Reason" rows="3" placeholder="I wish to permanently delete my PropLead account and all associated cloud data."></textarea>
        </div>
        <button type="submit">Submit Account Deletion Request via Email</button>
      </form>
    </div>

    <h2>What Data Is Erased vs Retained</h2>
    <ul>
      <li><strong>Erased Immediately:</strong> Agent profile, contact details, leads, client numbers, property inventory, confidential owner contacts, voice notes, document attachments, activity logs, and Firestore cloud documents.</li>
      <li><strong>Data Retention Period:</strong> None. All user data is wiped permanently upon request.</li>
      <li><strong>Billing Records:</strong> Handled by Google Play under Google's standard financial audit policies.</li>
    </ul>

    <h2>Contact Support</h2>
    <p>For immediate assistance with account or data deletion, email our Data Protection Officer at: <a href="mailto:jyothigehlot2025@gmail.com">jyothigehlot2025@gmail.com</a>.</p>

    <div class="footer">
      &copy; 2026 PropLead Real Estate CRM. All rights reserved.
    </div>
  </div>
</body>
</html>`);
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
