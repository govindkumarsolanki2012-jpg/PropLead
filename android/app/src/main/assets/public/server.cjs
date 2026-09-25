var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  TRIAL_DURATION_DAYS: () => TRIAL_DURATION_DAYS,
  getSubscriptionRecord: () => getSubscriptionRecord,
  verifyFirebaseIdToken: () => verifyFirebaseIdToken
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_googleapis = require("googleapis");
var import_genai = require("@google/genai");
var TRIAL_DURATION_DAYS = 7;
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var SUBSCRIPTIONS_FILE = import_path.default.join(DATA_DIR, "subscriptions.json");
var FIRESTORE_PROJECT_ID = "proplead-e5c6a";
var FIRESTORE_DATABASE_ID = "ai-studio-proplead-10ea62d1-3291-4f7b-9549-788cd49f881d";
var FIREBASE_STORAGE_BUCKET = "proplead-e5c6a.firebasestorage.app";
try {
  const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_fs.default.existsSync(configPath)) {
    const rawCfg = JSON.parse(import_fs.default.readFileSync(configPath, "utf8"));
    if (rawCfg.projectId) FIRESTORE_PROJECT_ID = rawCfg.projectId;
    if (rawCfg.firestoreDatabaseId) FIRESTORE_DATABASE_ID = rawCfg.firestoreDatabaseId;
    if (rawCfg.storageBucket) FIREBASE_STORAGE_BUCKET = rawCfg.storageBucket;
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json in server.ts:", e);
}
var FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
function initLocalSubscriptionStore() {
  const store = /* @__PURE__ */ new Map();
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (import_fs.default.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = import_fs.default.readFileSync(SUBSCRIPTIONS_FILE, "utf8");
      const parsed = JSON.parse(data);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [uid, item] of Object.entries(parsed)) {
          if (item && item.userId) {
            store.set(uid, item);
          }
        }
      }
      console.log(`[Subscription Persistence] Restored ${store.size} subscription records from durable disk storage.`);
    }
  } catch (err) {
    console.warn("[Subscription Persistence] Failed to initialize local subscriptions cache:", err);
  }
  return store;
}
var subscriptionStore = initLocalSubscriptionStore();
function persistSubscriptionStoreToDisk() {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = Object.fromEntries(subscriptionStore.entries());
    import_fs.default.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(serialized, null, 2), "utf8");
  } catch (err) {
    console.error("[Subscription Persistence] Error writing subscriptions to disk:", err);
  }
}
function toFirestoreFields(record) {
  const effectiveBasePlan = record.subscriptionBasePlanId || record.subscriptionBasePlan || record.planId || "quarterly";
  const effectivePlanId = record.planId || record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly";
  const rawStatus = String(record.subscriptionStatus || "NOT_STARTED");
  const fields = {
    userId: { stringValue: record.userId },
    subscriptionStatus: { stringValue: rawStatus },
    trialStatus: { stringValue: record.trialStatus || (record.subscriptionStatus === "TRIAL" ? "active" : record.trialStartDate ? "expired" : "not_started") },
    trialEverStarted: { booleanValue: Boolean(record.trialEverStarted || record.trialStartDate || record.subscriptionStatus === "TRIAL") },
    subscriptionProductId: { stringValue: record.subscriptionProductId || "property_agent_pro" },
    subscriptionBasePlan: { stringValue: effectiveBasePlan },
    subscriptionBasePlanId: { stringValue: effectiveBasePlan },
    planId: { stringValue: effectivePlanId },
    autoRenewing: { booleanValue: Boolean(record.autoRenewing) },
    acknowledged: { booleanValue: Boolean(record.acknowledged) },
    updatedAt: { stringValue: record.updatedAt || (/* @__PURE__ */ new Date()).toISOString() }
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
  fields.lastVerifiedAt = { stringValue: record.lastVerifiedAt || (/* @__PURE__ */ new Date()).toISOString() };
  return fields;
}
function fromFirestoreFields(fields) {
  if (!fields || !fields.userId) return null;
  const resolvedExpiry = fields.subscriptionExpiryTime?.stringValue || fields.subscriptionExpiryDate?.stringValue || fields.expiryDate?.stringValue || null;
  const basePlan = fields.subscriptionBasePlanId?.stringValue || fields.subscriptionBasePlan?.stringValue || fields.planId?.stringValue || "quarterly";
  const planId = fields.planId?.stringValue || fields.subscriptionBasePlanId?.stringValue || fields.subscriptionBasePlan?.stringValue || "quarterly";
  let rawStatus = fields.subscriptionStatus?.stringValue || "NOT_STARTED";
  const upper = rawStatus.toUpperCase();
  if (upper === "ACTIVE" || upper === "SUBSCRIBED") {
    rawStatus = "ACTIVE";
  } else if (upper === "CANCELED_BUT_ACTIVE") {
    rawStatus = "CANCELED_BUT_ACTIVE";
  } else if (upper === "PAYMENT_ISSUE") {
    rawStatus = "PAYMENT_ISSUE";
  } else if (upper === "EXPIRED") {
    rawStatus = "EXPIRED";
  } else if (upper === "TRIAL") {
    rawStatus = "TRIAL";
  } else if (upper === "NOT_STARTED") {
    rawStatus = "NOT_STARTED";
  } else {
    rawStatus = "NOT_STARTED";
  }
  const trialStart = fields.trialStartDate?.stringValue || null;
  const trialEnd = fields.trialEndDate?.stringValue || null;
  const trialEverStarted = fields.trialEverStarted?.booleanValue ?? Boolean(trialStart || trialEnd || rawStatus === "TRIAL");
  const trialStatus = fields.trialStatus?.stringValue || (rawStatus === "TRIAL" ? "active" : trialEverStarted ? "expired" : "not_started");
  return {
    userId: fields.userId.stringValue || "",
    subscriptionStatus: rawStatus,
    trialStatus,
    trialEverStarted,
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
    subscriptionExpiryDate: resolvedExpiry,
    subscriptionExpiryTime: resolvedExpiry,
    expiryDate: resolvedExpiry,
    subscriptionProductId: fields.subscriptionProductId?.stringValue || "property_agent_pro",
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
    updatedAt: fields.updatedAt?.stringValue || (/* @__PURE__ */ new Date()).toISOString()
  };
}
var cachedGoogleCerts = null;
var certsExpiryTime = 0;
async function getGooglePublicCerts() {
  const now = Date.now();
  if (cachedGoogleCerts && now < certsExpiryTime) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    if (!res.ok) {
      throw new Error(`Failed to fetch Google public certs: HTTP ${res.status}`);
    }
    const cacheControl = res.headers.get("cache-control") || "";
    const match = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
    certsExpiryTime = now + maxAgeSeconds * 1e3;
    cachedGoogleCerts = await res.json();
    return cachedGoogleCerts;
  } catch (err) {
    if (cachedGoogleCerts) return cachedGoogleCerts;
    throw err;
  }
}
async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const signature = Buffer.from(parts[2], "base64url");
    if (header.alg !== "RS256" || !header.kid) {
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
    const verifier = import_crypto.default.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isValid = verifier.verify(cert, signature);
    if (!isValid) return null;
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.exp <= nowSec) return null;
    if (payload.aud !== FIRESTORE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIRESTORE_PROJECT_ID}`) return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return {
      uid: payload.sub,
      email: payload.email,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
function parseServiceAccountCredentials(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("AIza")) {
    console.warn('[Google Play Auth] GOOGLE_PLAY_SERVICE_ACCOUNT_KEY starts with "AIza" (Google API Key). Google Play Developer API requires a Google Cloud Service Account JSON credentials object with private_key.');
    return null;
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && (parsed.client_email || parsed.type === "service_account")) {
        return parsed;
      }
    } catch {
    }
  }
  if ((trimmed.endsWith(".json") || trimmed.startsWith("/") || trimmed.startsWith("./")) && import_fs.default.existsSync(trimmed)) {
    try {
      const content = import_fs.default.readFileSync(trimmed, "utf8").trim();
      if (content.startsWith("{")) {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && (parsed.client_email || parsed.type === "service_account")) {
          return parsed;
        }
      }
    } catch {
    }
  }
  if (trimmed.startsWith("ey")) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === "object" && (parsed.client_email || parsed.type === "service_account")) {
          return parsed;
        }
      }
    } catch {
    }
  }
  return null;
}
var cachedDatastoreToken = null;
async function getFirestoreServiceAccountToken() {
  const now = Date.now();
  if (cachedDatastoreToken && now < cachedDatastoreToken.expiresAt) {
    return cachedDatastoreToken.token;
  }
  const credentials = parseServiceAccountCredentials(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);
  try {
    const authOptions = {
      scopes: ["https://www.googleapis.com/auth/datastore"]
    };
    if (credentials) {
      authOptions.credentials = credentials;
    }
    const auth = new import_googleapis.google.auth.GoogleAuth(authOptions);
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (tokenResponse?.token) {
      cachedDatastoreToken = {
        token: tokenResponse.token,
        expiresAt: now + 50 * 60 * 1e3
      };
      return tokenResponse.token;
    }
  } catch (err) {
    console.warn("[Firestore Persistence] Service account / ADC auth warning:", err);
  }
  return null;
}
var cachedFirebaseAdminToken = null;
async function getFirebaseAdminAccessToken() {
  const now = Date.now();
  if (cachedFirebaseAdminToken && now < cachedFirebaseAdminToken.expiresAt) {
    return cachedFirebaseAdminToken.token;
  }
  const credentials = parseServiceAccountCredentials(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);
  const authOptions = {
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  };
  if (credentials) {
    authOptions.credentials = credentials;
  }
  const auth = new import_googleapis.google.auth.GoogleAuth(authOptions);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse?.token) return null;
  cachedFirebaseAdminToken = {
    token: tokenResponse.token,
    expiresAt: now + 50 * 60 * 1e3
  };
  return tokenResponse.token;
}
function encodeFirestorePath(documentPath) {
  return documentPath.split("/").map(encodeURIComponent).join("/");
}
async function readDeletionApiError(res) {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
var revokedUids = /* @__PURE__ */ new Set();
async function createOrUpdateDeletionJob(job, accessToken) {
  try {
    const docUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs/${encodeURIComponent(job.uid)}`;
    const fields = {
      uid: { stringValue: job.uid },
      status: { stringValue: job.status },
      requestedAt: { stringValue: job.requestedAt },
      retryCount: { integerValue: String(job.retryCount) },
      updatedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
    };
    if (job.trialEverStarted !== void 0) {
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
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (err) {
    console.warn("[DeletionJob] Error writing deletion job to Firestore:", err);
    return false;
  }
}
async function markUserAccountDeletedInFirestore(uid, accessToken) {
  try {
    const fieldMasks = [
      "updateMask.fieldPaths=isDeleted",
      "updateMask.fieldPaths=accountStatus",
      "updateMask.fieldPaths=disabled",
      "updateMask.fieldPaths=deletionRequestedAt",
      "updateMask.fieldPaths=updatedAt"
    ];
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(uid)}?${fieldMasks.join("&")}`;
    const fields = {
      isDeleted: { booleanValue: true },
      accountStatus: { stringValue: "deleted" },
      disabled: { booleanValue: true },
      deletionRequestedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() },
      updatedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
    };
    const res = await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (err) {
    console.warn(`[Account Deletion Phase 1] Error marking user ${uid} deleted:`, err);
    return false;
  }
}
async function listFirestoreDocumentNames(collectionPath, accessToken) {
  const documentNames = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const res = await fetch(
      `${FIRESTORE_REST_BASE}/${encodeFirestorePath(collectionPath)}?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) break;
    const payload = await res.json();
    for (const doc of payload.documents || []) {
      if (doc.name) documentNames.push(doc.name);
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documentNames;
}
async function batchDeleteFirestoreDocuments(documentNames, accessToken) {
  if (documentNames.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < documentNames.length; i += CHUNK_SIZE) {
    const chunk = documentNames.slice(i, i + CHUNK_SIZE);
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:commit`;
    const res = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        writes: chunk.map((name) => ({ delete: name }))
      })
    });
    if (!res.ok) {
      console.warn(`[Background Cleanup] Batch delete notice (${res.status}):`, await res.text());
    }
  }
}
async function deleteUserStorageObjectsFast(uid, accessToken) {
  const prefix = `users/${uid}/`;
  let pageToken = "";
  do {
    const query = new URLSearchParams({ prefix, maxResults: "500" });
    if (pageToken) query.set("pageToken", pageToken);
    const listRes = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(FIREBASE_STORAGE_BUCKET)}/o?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (listRes.status === 404 || !listRes.ok) break;
    const payload = await listRes.json();
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
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` }
              }
            );
          })
        );
      }
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
}
async function deleteFirebaseAuthUser(uid, accessToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(FIRESTORE_PROJECT_ID)}/accounts:delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ localId: uid })
    }
  );
  if (!res.ok && res.status !== 400 && res.status !== 404) {
    throw new Error(`Could not delete Firebase Authentication user: ${await readDeletionApiError(res)}`);
  }
}
async function processAccountDeletionJob(uid) {
  const adminAccessToken = await getFirebaseAdminAccessToken();
  if (!adminAccessToken) {
    console.warn(`[Background Cleanup] No admin access token available for deletion job ${uid}`);
    return;
  }
  await createOrUpdateDeletionJob({
    uid,
    status: "processing",
    requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    retryCount: 0
  }, adminAccessToken);
  try {
    const [leads, properties, templates, notifs] = await Promise.all([
      listFirestoreDocumentNames(`users/${uid}/leads`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/properties`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/templates`, adminAccessToken),
      listFirestoreDocumentNames(`users/${uid}/notifications`, adminAccessToken)
    ]);
    const allDocs = [...leads, ...properties, ...templates, ...notifs];
    if (allDocs.length > 0) {
      await batchDeleteFirestoreDocuments(allDocs, adminAccessToken);
    }
    await deleteUserStorageObjectsFast(uid, adminAccessToken);
    await Promise.allSettled([
      fetch(`${FIRESTORE_REST_BASE}/users/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminAccessToken}` }
      }),
      fetch(`${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminAccessToken}` }
      })
    ]);
    await deleteFirebaseAuthUser(uid, adminAccessToken).catch(() => {
    });
    await createOrUpdateDeletionJob({
      uid,
      status: "completed",
      requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      retryCount: 0,
      lastError: null
    }, adminAccessToken);
    revokedUids.delete(uid);
    console.log(`[Background Cleanup] Successfully completed purge for user ${uid}.`);
  } catch (err) {
    console.warn(`[Background Cleanup] Notice during cleanup for user ${uid}:`, err);
    await createOrUpdateDeletionJob({
      uid,
      status: "failed",
      requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
      retryCount: 1,
      lastError: err?.message || String(err)
    }, adminAccessToken);
  }
}
var isDeletionWorkerRunning = false;
async function runDeletionWorkerCycle() {
  if (isDeletionWorkerRunning) return;
  isDeletionWorkerRunning = true;
  try {
    const adminAccessToken = await getFirebaseAdminAccessToken();
    if (!adminAccessToken) return;
    const listUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs?pageSize=50`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${adminAccessToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    const docs = data.documents || [];
    for (const doc of docs) {
      const uid = doc.fields?.uid?.stringValue;
      const status = doc.fields?.status?.stringValue;
      const retryCount = parseInt(doc.fields?.retryCount?.integerValue || "0", 10);
      const updatedAtStr = doc.fields?.updatedAt?.stringValue || doc.fields?.requestedAt?.stringValue;
      const updatedMs = updatedAtStr ? new Date(updatedAtStr).getTime() : 0;
      const isStaleProcessing = status === "processing" && Date.now() - updatedMs > 10 * 60 * 1e3;
      if (uid) {
        if (status === "pending" || status === "processing" || status === "failed" && retryCount < 5 || isStaleProcessing) {
          revokedUids.add(uid);
        } else if (status === "completed") {
          revokedUids.delete(uid);
        }
        if (status === "pending" || status === "failed" && retryCount < 5 || isStaleProcessing) {
          await processAccountDeletionJob(uid);
        }
      }
    }
  } catch (err) {
    console.warn("[Deletion Worker Cycle] Notice:", err);
  } finally {
    isDeletionWorkerRunning = false;
  }
}
setTimeout(() => {
  runDeletionWorkerCycle().catch(() => {
  });
  setInterval(() => {
    runDeletionWorkerCycle().catch(() => {
    });
  }, 60 * 1e3);
}, 5e3);
async function getFirestoreWriteToken(_idToken) {
  return getFirestoreServiceAccountToken();
}
async function getFirestoreReadToken(idToken) {
  if (idToken) {
    return idToken;
  }
  return getFirestoreServiceAccountToken();
}
async function syncSubscriptionToFirestore(record, idToken) {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      return false;
    }
    const docUrl = `${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(record.userId)}`;
    const res = await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: toFirestoreFields(record)
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Firestore Persistence] Write to /subscriptions failed (${res.status}):`, errText);
      return false;
    }
    console.log(`[Firestore Persistence] Persisted subscription for user ${record.userId} to /subscriptions.`);
    return true;
  } catch (err) {
    console.warn("[Firestore Persistence] Network error writing subscription:", err);
    return false;
  }
}
async function syncUserProfileSubscriptionToFirestore(userId, record, idToken) {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      console.warn(`[Firestore User Sync] No auth token available to update /users/${userId}`);
      return false;
    }
    const fieldMasks = [
      "updateMask.fieldPaths=isSubscribed",
      "updateMask.fieldPaths=subscriptionStatus",
      "updateMask.fieldPaths=subscriptionProductId",
      "updateMask.fieldPaths=subscriptionBasePlan",
      "updateMask.fieldPaths=subscriptionBasePlanId",
      "updateMask.fieldPaths=planId",
      "updateMask.fieldPaths=autoRenewing",
      "updateMask.fieldPaths=updatedAt"
    ];
    const effectiveBasePlan = record.subscriptionBasePlanId || record.subscriptionBasePlan || record.planId || "quarterly";
    const effectivePlanId = record.planId || record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly";
    const fields = {
      isSubscribed: { booleanValue: record.isSubscribed },
      subscriptionStatus: { stringValue: record.subscriptionStatus },
      subscriptionProductId: { stringValue: record.subscriptionProductId },
      subscriptionBasePlan: { stringValue: effectiveBasePlan },
      subscriptionBasePlanId: { stringValue: effectiveBasePlan },
      planId: { stringValue: effectivePlanId },
      autoRenewing: { booleanValue: record.autoRenewing },
      updatedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
    };
    const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate || record.expiryDate;
    if (resolvedExpiry) {
      fieldMasks.push("updateMask.fieldPaths=subscriptionExpiryDate");
      fields.subscriptionExpiryDate = { stringValue: resolvedExpiry };
      fieldMasks.push("updateMask.fieldPaths=subscriptionExpiryTime");
      fields.subscriptionExpiryTime = { stringValue: resolvedExpiry };
      fieldMasks.push("updateMask.fieldPaths=expiryDate");
      fields.expiryDate = { stringValue: resolvedExpiry };
    }
    if (record.purchaseDate) {
      fieldMasks.push("updateMask.fieldPaths=purchaseDate");
      fields.purchaseDate = { stringValue: record.purchaseDate };
    }
    if (record.lastVerifiedAt) {
      fieldMasks.push("updateMask.fieldPaths=lastVerifiedAt");
      fields.lastVerifiedAt = { stringValue: record.lastVerifiedAt };
    }
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}?${fieldMasks.join("&")}`;
    const res = await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fields })
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
async function fetchSubscriptionFromFirestore(userId, idToken) {
  try {
    const token = await getFirestoreReadToken(idToken);
    if (!token) {
      return { status: "NOT_FOUND", record: null };
    }
    const docUrl = `${FIRESTORE_REST_BASE}/subscriptions/${encodeURIComponent(userId)}`;
    const res = await fetch(docUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.status === 404) {
      return { status: "NOT_FOUND", record: null };
    }
    if (!res.ok) {
      console.warn(`[Firestore Persistence] Firestore returned HTTP status ${res.status}`);
      return { status: "ERROR", record: null };
    }
    const docData = await res.json();
    const parsed = fromFirestoreFields(docData.fields);
    if (parsed) {
      return { status: "FOUND", record: parsed };
    }
    return { status: "NOT_FOUND", record: null };
  } catch (err) {
    console.warn("[Firestore Persistence] Error reading subscription from Firestore:", err);
    return { status: "ERROR", record: null };
  }
}
async function findSubscriptionRecordByPurchaseToken(purchaseToken) {
  if (!purchaseToken) return null;
  for (const rec of subscriptionStore.values()) {
    if (rec.purchaseToken === purchaseToken) {
      return rec;
    }
  }
  try {
    const token = await getFirestoreServiceAccountToken();
    if (!token) return null;
    const queryUrl = `${FIRESTORE_REST_BASE}:runQuery`;
    const res = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "subscriptions" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "purchaseToken" },
              op: "EQUAL",
              value: { stringValue: purchaseToken }
            }
          },
          limit: 1
        }
      })
    });
    if (!res.ok) {
      return null;
    }
    const results = await res.json();
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
    console.warn("[Firestore Search] Error finding subscription by purchaseToken:", err);
  }
  return null;
}
async function fetchDeletionJobFromFirestore(uid) {
  try {
    const adminToken = await getFirebaseAdminAccessToken();
    if (!adminToken) return null;
    const docUrl = `${FIRESTORE_REST_BASE}/accountDeletionJobs/${encodeURIComponent(uid)}`;
    const res = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) return null;
    const docData = await res.json();
    const fields = docData.fields || {};
    return {
      uid: fields.uid?.stringValue || uid,
      email: fields.email?.stringValue,
      status: fields.status?.stringValue || "completed",
      requestedAt: fields.requestedAt?.stringValue || "",
      retryCount: parseInt(fields.retryCount?.integerValue || "0", 10),
      trialEverStarted: fields.trialEverStarted?.booleanValue ?? false
    };
  } catch {
    return null;
  }
}
async function fetchUserProfileFromFirestore(userId, idToken) {
  try {
    const token = await getFirestoreReadToken(idToken);
    if (!token) return null;
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}`;
    const res = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${token}` }
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
      lastVerifiedAt: fields.lastVerifiedAt?.stringValue
    };
  } catch (err) {
    console.warn(`[Firestore User] Could not fetch profile for user ${userId}:`, err);
    return null;
  }
}
async function syncUserProfileTrialToFirestore(userId, trial, idToken) {
  try {
    const token = await getFirestoreWriteToken(idToken);
    if (!token) {
      console.warn(`[Firestore User Trial Sync] No auth token available to update /users/${userId}`);
      return false;
    }
    const fieldMasks = [
      "updateMask.fieldPaths=trialStatus",
      "updateMask.fieldPaths=trialEverStarted",
      "updateMask.fieldPaths=subscriptionStatus",
      "updateMask.fieldPaths=updatedAt"
    ];
    const fields = {
      trialStatus: { stringValue: trial.trialStatus },
      trialEverStarted: { booleanValue: trial.trialEverStarted },
      subscriptionStatus: { stringValue: trial.subscriptionStatus },
      updatedAt: { stringValue: (/* @__PURE__ */ new Date()).toISOString() }
    };
    if (trial.trialStartDate) {
      fieldMasks.push("updateMask.fieldPaths=trialStartDate");
      fields.trialStartDate = { stringValue: trial.trialStartDate };
    } else {
      fieldMasks.push("updateMask.fieldPaths=trialStartDate");
      fields.trialStartDate = { nullValue: null };
    }
    if (trial.trialEndDate) {
      fieldMasks.push("updateMask.fieldPaths=trialEndDate");
      fields.trialEndDate = { stringValue: trial.trialEndDate };
    } else {
      fieldMasks.push("updateMask.fieldPaths=trialEndDate");
      fields.trialEndDate = { nullValue: null };
    }
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}?${fieldMasks.join("&")}`;
    const res = await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fields })
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
async function getSubscriptionRecord(userId, idToken) {
  const serverNow = /* @__PURE__ */ new Date();
  const remote = await fetchSubscriptionFromFirestore(userId, idToken);
  if (remote.status === "FOUND" && remote.record) {
    const record = remote.record;
    const resolvedExpiry = record.subscriptionExpiryTime || record.subscriptionExpiryDate;
    if (resolvedExpiry && (record.subscriptionStatus === "ACTIVE" || record.subscriptionStatus === "CANCELED_BUT_ACTIVE")) {
      const expTime = new Date(resolvedExpiry).getTime();
      if (!isNaN(expTime) && serverNow.getTime() > expTime) {
        record.subscriptionStatus = "EXPIRED";
        saveSubscriptionRecord(record, idToken).catch(() => {
        });
      }
    } else if (record.subscriptionStatus === "TRIAL" && record.trialEndDate) {
      const trialEndTime = new Date(record.trialEndDate).getTime();
      if (!isNaN(trialEndTime) && serverNow.getTime() > trialEndTime) {
        record.subscriptionStatus = "EXPIRED";
        record.trialStatus = "expired";
        saveSubscriptionRecord(record, idToken).catch(() => {
        });
      }
    }
    subscriptionStore.set(userId, record);
    persistSubscriptionStoreToDisk();
    return { record, unavailable: false };
  }
  const userProfile = await fetchUserProfileFromFirestore(userId, idToken);
  if (userProfile) {
    const rawSubStatus = userProfile.subscriptionStatus || "";
    const isSubActive = userProfile.isSubscribed === true || rawSubStatus.toUpperCase() === "ACTIVE" || rawSubStatus.toLowerCase() === "active" || rawSubStatus.toUpperCase() === "CANCELED_BUT_ACTIVE";
    const resolvedExpiry = userProfile.subscriptionExpiryTime || userProfile.subscriptionExpiryDate;
    if (isSubActive && resolvedExpiry) {
      const expTime = new Date(resolvedExpiry).getTime();
      const isExpiredNow = !isNaN(expTime) && serverNow.getTime() > expTime;
      const restoredRecord = {
        userId,
        subscriptionStatus: isExpiredNow ? "EXPIRED" : rawSubStatus.toUpperCase() === "CANCELED_BUT_ACTIVE" ? "CANCELED_BUT_ACTIVE" : "ACTIVE",
        trialStatus: userProfile.trialStatus || (userProfile.trialEverStarted ? "expired" : "not_started"),
        trialEverStarted: Boolean(userProfile.trialEverStarted),
        trialStartDate: userProfile.trialStartDate || null,
        trialEndDate: userProfile.trialEndDate || null,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        subscriptionProductId: userProfile.subscriptionProductId || "property_agent_pro",
        subscriptionBasePlan: userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || "quarterly",
        subscriptionBasePlanId: userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || "quarterly",
        planId: userProfile.planId || userProfile.subscriptionBasePlanId || userProfile.subscriptionBasePlan || "quarterly",
        autoRenewing: userProfile.autoRenewing ?? true,
        acknowledged: true,
        purchaseToken: userProfile.purchaseToken,
        lastVerifiedAt: userProfile.lastVerifiedAt || serverNow.toISOString(),
        updatedAt: serverNow.toISOString()
      };
      subscriptionStore.set(userId, restoredRecord);
      persistSubscriptionStoreToDisk();
      syncSubscriptionToFirestore(restoredRecord, idToken).catch(() => {
      });
      return { record: restoredRecord, unavailable: false };
    }
    const hasGenuineTrial = Boolean(
      userProfile.trialStartDate && userProfile.trialStartDate !== "null" || userProfile.trialEndDate && userProfile.trialEndDate !== "null" || userProfile.trialEverStarted === true || rawSubStatus.toUpperCase() === "TRIAL"
    );
    if (hasGenuineTrial) {
      let trialStart = serverNow;
      let trialEnd = serverNow;
      let isExpired = false;
      if (userProfile?.trialEndDate) {
        const parsedEnd = new Date(userProfile.trialEndDate);
        if (!isNaN(parsedEnd.getTime())) {
          trialEnd = parsedEnd;
          if (userProfile.trialStartDate) {
            const parsedStart = new Date(userProfile.trialStartDate);
            trialStart = !isNaN(parsedStart.getTime()) ? parsedStart : new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
          } else {
            trialStart = new Date(parsedEnd.getTime() - TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
          }
          const maxAllowedEnd = new Date(trialStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
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
          trialEnd = new Date(parsedStart.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
          if (serverNow.getTime() >= trialEnd.getTime()) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }
      } else {
        isExpired = true;
      }
      const existingTrialRecord = {
        userId,
        subscriptionStatus: isExpired ? "EXPIRED" : "TRIAL",
        trialStatus: isExpired ? "expired" : "active",
        trialEverStarted: true,
        trialStartDate: trialStart.toISOString(),
        trialEndDate: trialEnd.toISOString(),
        subscriptionExpiryDate: null,
        subscriptionExpiryTime: null,
        expiryDate: null,
        subscriptionProductId: "property_agent_pro",
        subscriptionBasePlan: "monthly",
        subscriptionBasePlanId: "monthly",
        planId: "monthly",
        autoRenewing: false,
        acknowledged: false,
        updatedAt: serverNow.toISOString()
      };
      subscriptionStore.set(userId, existingTrialRecord);
      persistSubscriptionStoreToDisk();
      syncSubscriptionToFirestore(existingTrialRecord, idToken).catch(() => {
      });
      return { record: existingTrialRecord, unavailable: false };
    }
  }
  if (subscriptionStore.has(userId)) {
    const cached = subscriptionStore.get(userId);
    if (cached.subscriptionStatus === "TRIAL" && !cached.trialEverStarted && !cached.trialStartDate) {
      cached.subscriptionStatus = "NOT_STARTED";
      cached.trialStatus = "not_started";
      cached.trialEverStarted = false;
      cached.trialStartDate = null;
      cached.trialEndDate = null;
      persistSubscriptionStoreToDisk();
    }
    return { record: cached, unavailable: false };
  }
  const defaultRecord = {
    userId,
    subscriptionStatus: "NOT_STARTED",
    trialStatus: "not_started",
    trialEverStarted: false,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionExpiryDate: null,
    subscriptionExpiryTime: null,
    expiryDate: null,
    subscriptionProductId: "property_agent_pro",
    subscriptionBasePlan: "monthly",
    subscriptionBasePlanId: "monthly",
    planId: "monthly",
    autoRenewing: false,
    acknowledged: false,
    updatedAt: serverNow.toISOString()
  };
  subscriptionStore.set(userId, defaultRecord);
  persistSubscriptionStoreToDisk();
  syncSubscriptionToFirestore(defaultRecord, idToken).catch(() => {
  });
  return { record: defaultRecord, unavailable: false };
}
async function saveSubscriptionRecord(record, idToken) {
  record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  subscriptionStore.set(record.userId, record);
  persistSubscriptionStoreToDisk();
  const subOk = await syncSubscriptionToFirestore(record, idToken);
  const isSub = record.subscriptionStatus === "ACTIVE" || record.subscriptionStatus === "CANCELED_BUT_ACTIVE";
  const userOk = await syncUserProfileSubscriptionToFirestore(
    record.userId,
    {
      isSubscribed: isSub,
      subscriptionStatus: record.subscriptionStatus,
      subscriptionExpiryDate: record.subscriptionExpiryDate,
      subscriptionProductId: record.subscriptionProductId || "property_agent_pro",
      subscriptionBasePlan: record.subscriptionBasePlan || record.planId || "quarterly",
      planId: record.planId || record.subscriptionBasePlan || "quarterly",
      purchaseDate: record.purchaseDate,
      expiryDate: record.expiryDate || record.subscriptionExpiryDate,
      lastVerifiedAt: record.lastVerifiedAt,
      autoRenewing: Boolean(record.autoRenewing)
    },
    idToken
  );
  return {
    subscriptionsCollectionSynced: subOk,
    userProfileSynced: userOk
  };
}
var GOOGLE_PLAY_PRODUCT = {
  productId: "property_agent_pro",
  title: "Choose Your Plan",
  subtitle: "Unlock all PropLead features",
  description: "Keep your property leads, customers, follow-ups and property matching organized.",
  plans: {
    monthly: {
      id: "monthly",
      basePlanId: "monthly",
      name: "Monthly",
      durationLabel: "1 Month",
      price: 79,
      priceFormatted: "\u20B979",
      billingPeriod: "P1M",
      billingText: "\u20B979 every month",
      shortText: "Flexible monthly plan",
      ctaText: "Continue with \u20B979 Monthly",
      durationMonths: 1
    },
    quarterly: {
      id: "quarterly",
      basePlanId: "quarterly",
      name: "3 Months",
      durationLabel: "3 Months",
      price: 199,
      priceFormatted: "\u20B9199",
      billingPeriod: "P3M",
      billingText: "\u20B9199 every 3 months",
      perMonthText: "\u20B966.33/month",
      badge: "BEST VALUE",
      savingsText: "Save \u20B938",
      shortText: "Best value for active agents",
      ctaText: "Continue with \u20B9199 / 3 Months",
      durationMonths: 3
    }
  },
  features: [
    "Unlimited leads",
    "Property management",
    "Follow-up reminders",
    "Property visit reminders",
    "Calendar",
    "Analytics",
    "WhatsApp and call shortcuts",
    "Property matching",
    "Cloud backup",
    "Multi-device access",
    "All future Pro improvements"
  ]
};
var PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.proplead.tracker";
var androidPublisherClient = null;
function getAndroidPublisherClient() {
  if (androidPublisherClient) return androidPublisherClient;
  const credentials = parseServiceAccountCredentials(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY);
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  if (!credentials && !isCloudRun && process.env.NODE_ENV !== "production") {
    return null;
  }
  try {
    const authOptions = {
      scopes: ["https://www.googleapis.com/auth/androidpublisher"]
    };
    if (credentials) {
      authOptions.credentials = credentials;
    }
    const auth = new import_googleapis.google.auth.GoogleAuth(authOptions);
    androidPublisherClient = import_googleapis.google.androidpublisher({
      version: "v3",
      auth
    });
    console.log("[Google Play Developer API] Android Publisher v3 client initialized.");
    return androidPublisherClient;
  } catch (err) {
    console.error("[Google Play Developer API] Error initializing Google Auth client:", err);
    return null;
  }
}
async function verifyGooglePlaySubscriptionToken(purchaseToken, productId = "property_agent_pro", basePlanId = "quarterly", packageName = PACKAGE_NAME) {
  const effectivePackage = packageName || PACKAGE_NAME || "com.proplead.tracker";
  const client = getAndroidPublisherClient();
  if (!client) {
    console.warn("[Google Play Developer API] Android Publisher API client is not initialized or credentials missing.");
    return {
      isValid: false,
      orderId: "",
      subscriptionStatus: "PENDING",
      subscriptionExpiryDate: "",
      autoRenewing: false,
      acknowledged: false,
      verificationPending: true,
      error: "SUBSCRIPTION_VERIFICATION_PENDING",
      message: "Purchase completed but verification is temporarily unavailable."
    };
  }
  try {
    console.log(`[Google Play API] Authoritatively querying Google Play Developer API for package "${effectivePackage}", plan "${basePlanId}", token prefix: "${purchaseToken.substring(0, 10)}..."`);
    let subData = null;
    try {
      const resV2 = await client.purchases.subscriptionsv2.get({
        packageName: effectivePackage,
        token: purchaseToken
      });
      subData = resV2.data;
    } catch (v2Err) {
      console.warn(`[Google Play API] subscriptionsv2.get notice (${v2Err?.message}), checking subscriptions.get v1 API...`);
      try {
        const resV1 = await client.purchases.subscriptions.get({
          packageName: effectivePackage,
          subscriptionId: productId,
          token: purchaseToken
        });
        const v1Data = resV1.data;
        subData = {
          latestOrderId: v1Data.orderId,
          lineItems: [
            {
              expiryTime: v1Data.expiryTimeMillis ? new Date(Number(v1Data.expiryTimeMillis)).toISOString() : null,
              autoRenewingPlan: v1Data.autoRenewing ? {} : void 0,
              offerDetails: {
                basePlanId
              }
            }
          ],
          acknowledgementState: v1Data.acknowledgementState === 1 ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
          subscriptionState: v1Data.paymentState === 1 ? "SUBSCRIPTION_STATE_ACTIVE" : v1Data.paymentState === 0 ? "SUBSCRIPTION_STATE_PENDING" : "SUBSCRIPTION_STATE_ACTIVE"
        };
      } catch {
        throw v2Err;
      }
    }
    console.log("[Google Play API Authoritative Response]", JSON.stringify(subData));
    const lineItem = subData.lineItems?.[0];
    const expiryTime = lineItem?.expiryTime || null;
    if (!expiryTime) {
      console.error("[Google Play API] Google Play response does not contain an authoritative expiry timestamp.");
      return {
        isValid: false,
        orderId: subData.latestOrderId || "",
        subscriptionStatus: "PENDING",
        subscriptionExpiryDate: "",
        autoRenewing: false,
        acknowledged: false,
        verificationPending: true,
        error: "SUBSCRIPTION_VERIFICATION_PENDING",
        message: "Purchase completed but verification is temporarily unavailable."
      };
    }
    const expiryMs = new Date(expiryTime).getTime();
    if (isNaN(expiryMs) || expiryMs <= Date.now()) {
      return {
        isValid: false,
        orderId: subData.latestOrderId || "",
        subscriptionStatus: "EXPIRED",
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: true,
        error: "Subscription has expired in Google Play."
      };
    }
    const orderId = subData.latestOrderId || `GPA.${Date.now()}`;
    const autoRenewing = lineItem?.autoRenewingPlan != null;
    const subState = subData.subscriptionState;
    if (subState === "SUBSCRIPTION_STATE_EXPIRED") {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: "EXPIRED",
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: true,
        error: "Subscription has expired in Google Play."
      };
    }
    if (subState === "SUBSCRIPTION_STATE_ON_HOLD" || subState === "SUBSCRIPTION_STATE_PAUSED" || subState === "SUBSCRIPTION_STATE_PENDING") {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: "PENDING",
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: false,
        error: `Google Play subscription is not in an active paid state (${subState}).`
      };
    }
    const playBasePlanId = lineItem?.offerDetails?.basePlanId;
    if (playBasePlanId && playBasePlanId !== "monthly" && playBasePlanId !== "quarterly") {
      return {
        isValid: false,
        orderId,
        subscriptionStatus: "EXPIRED",
        subscriptionExpiryDate: expiryTime,
        autoRenewing: false,
        acknowledged: false,
        error: `Unrecognized Google Play base plan: ${playBasePlanId}. Expected monthly or quarterly.`
      };
    }
    let subscriptionStatus = "ACTIVE";
    if (subState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") {
      subscriptionStatus = "PAYMENT_ISSUE";
    } else if (subState === "SUBSCRIPTION_STATE_CANCELED") {
      subscriptionStatus = "CANCELED_BUT_ACTIVE";
    }
    if (subData.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      try {
        await client.purchases.subscriptions.acknowledge({
          packageName: effectivePackage,
          subscriptionId: productId,
          token: purchaseToken,
          requestBody: {}
        });
        console.log("[Google Play API] Acknowledged purchase with Google Play.");
      } catch (ackErr) {
        console.warn("[Google Play API] Acknowledge call non-fatal notice:", ackErr);
      }
    }
    return {
      isValid: true,
      orderId,
      subscriptionStatus,
      subscriptionExpiryDate: expiryTime,
      autoRenewing,
      acknowledged: true,
      basePlanId: playBasePlanId || basePlanId
    };
  } catch (apiErr) {
    console.error("[Google Play Developer API Error]", apiErr?.message || apiErr);
    const errMessage = String(apiErr?.message || "");
    const statusCode = apiErr?.code || apiErr?.status;
    if (statusCode === 404 || errMessage.includes("Requested entity was not found") || errMessage.includes("not found")) {
      return {
        isValid: false,
        orderId: "",
        subscriptionStatus: "EXPIRED",
        subscriptionExpiryDate: "",
        autoRenewing: false,
        acknowledged: false,
        error: "Google Play reported that this purchase token was not found."
      };
    }
    return {
      isValid: false,
      orderId: "",
      subscriptionStatus: "PENDING",
      subscriptionExpiryDate: "",
      autoRenewing: false,
      acknowledged: false,
      verificationPending: true,
      error: "SUBSCRIPTION_VERIFICATION_PENDING",
      message: "Purchase completed but verification is temporarily unavailable."
    };
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(import_express.default.json());
  app.use("/api", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });
  const extractIdToken = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    return void 0;
  };
  const authenticateRequest = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Missing Bearer token."
      });
      return null;
    }
    const token = authHeader.substring(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (!verified) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired Firebase ID token."
      });
      return null;
    }
    if (revokedUids.has(verified.uid)) {
      res.status(403).json({
        success: false,
        error: "ACCOUNT_DELETED",
        message: "Account has been deleted."
      });
      return null;
    }
    const requestedUserId = req.query.userId || req.body?.userId;
    if (requestedUserId && requestedUserId !== verified.uid) {
      res.status(403).json({
        success: false,
        error: "Forbidden: Access denied for requested user ID."
      });
      return null;
    }
    return verified.uid;
  };
  app.get("/api/health", (req, res) => {
    const rawKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || "";
    const trimmed = rawKey.trim();
    const isApiKey = trimmed.startsWith("AIza");
    const saCredentials = parseServiceAccountCredentials(rawKey);
    res.json({
      status: "ok",
      service: "proplead-billing-server",
      googlePlayApiConfigured: Boolean(saCredentials),
      serviceAccountEmail: saCredentials?.client_email || null,
      serviceAccountStatus: isApiKey ? "INVALID_API_KEY_AIza (Service account JSON required, not API key)" : saCredentials ? "CONFIGURED" : trimmed ? "INVALID_FORMAT" : "NOT_CONFIGURED",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/billing/product-details", (req, res) => {
    res.json({
      success: true,
      product: GOOGLE_PLAY_PRODUCT
    });
  });
  app.get("/api/billing/subscription-status", async (req, res) => {
    try {
      const verifiedUid = await authenticateRequest(req, res);
      if (!verifiedUid) return;
      const idToken = extractIdToken(req);
      const subResult = await getSubscriptionRecord(verifiedUid, idToken);
      if (subResult.unavailable || !subResult.record) {
        return res.status(503).json({
          success: false,
          error: "Subscription service is temporarily unavailable. Please retry shortly."
        });
      }
      const record = subResult.record;
      const now = Date.now();
      let currentStatus = record.subscriptionStatus;
      if (currentStatus === "TRIAL") {
        const trialEndTime2 = new Date(record.trialEndDate).getTime();
        if (isNaN(trialEndTime2) || now > trialEndTime2) {
          currentStatus = "EXPIRED";
          record.subscriptionStatus = "EXPIRED";
          await saveSubscriptionRecord(record, idToken);
        }
      } else if (currentStatus === "CANCELED_BUT_ACTIVE") {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime) {
            currentStatus = "EXPIRED";
            record.subscriptionStatus = "EXPIRED";
            await saveSubscriptionRecord(record, idToken);
          }
        }
      } else if (currentStatus === "ACTIVE" || currentStatus === "PAYMENT_ISSUE") {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime) {
            if (record.purchaseToken) {
              try {
                const refreshed = await verifyGooglePlaySubscriptionToken(
                  record.purchaseToken,
                  record.subscriptionProductId || "property_agent_pro",
                  record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly",
                  "com.proplead.tracker"
                );
                if (refreshed.isValid && refreshed.subscriptionExpiryDate) {
                  const newExpTime = new Date(refreshed.subscriptionExpiryDate).getTime();
                  if (newExpTime > now) {
                    record.subscriptionExpiryDate = refreshed.subscriptionExpiryDate;
                    record.subscriptionExpiryTime = refreshed.subscriptionExpiryDate;
                    record.expiryDate = refreshed.subscriptionExpiryDate;
                    record.autoRenewing = refreshed.autoRenewing;
                    record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
                    currentStatus = refreshed.subscriptionStatus === "PAYMENT_ISSUE" ? "PAYMENT_ISSUE" : refreshed.subscriptionStatus === "CANCELED_BUT_ACTIVE" ? "CANCELED_BUT_ACTIVE" : "ACTIVE";
                    record.subscriptionStatus = currentStatus;
                    if (refreshed.subscriptionStatus === "PAYMENT_ISSUE") {
                      record.paymentIssueMessage = "Google Play grace period: Payment issue detected. Please update payment method to avoid suspension.";
                    } else {
                      record.paymentIssueMessage = void 0;
                    }
                    await saveSubscriptionRecord(record, idToken);
                  } else {
                    currentStatus = "EXPIRED";
                    record.subscriptionStatus = "EXPIRED";
                    record.autoRenewing = false;
                    await saveSubscriptionRecord(record, idToken);
                  }
                } else if (refreshed.subscriptionStatus === "PENDING") {
                  currentStatus = "EXPIRED";
                  record.subscriptionStatus = "EXPIRED";
                  record.paymentIssueMessage = refreshed.error || "Google Play account is on hold. Subscription benefits are paused.";
                  record.autoRenewing = false;
                  await saveSubscriptionRecord(record, idToken);
                } else if (refreshed.subscriptionStatus === "EXPIRED") {
                  currentStatus = "EXPIRED";
                  record.subscriptionStatus = "EXPIRED";
                  record.autoRenewing = false;
                  await saveSubscriptionRecord(record, idToken);
                } else if (refreshed.verificationPending) {
                  currentStatus = "EXPIRED";
                  record.subscriptionStatus = "EXPIRED";
                  await saveSubscriptionRecord(record, idToken);
                } else {
                  currentStatus = "EXPIRED";
                  record.subscriptionStatus = "EXPIRED";
                  await saveSubscriptionRecord(record, idToken);
                }
              } catch (refreshErr) {
                console.warn("[Subscription Status] Failed to refresh expired token with Google Play:", refreshErr);
                currentStatus = "EXPIRED";
                record.subscriptionStatus = "EXPIRED";
                await saveSubscriptionRecord(record, idToken);
              }
            } else {
              currentStatus = "EXPIRED";
              record.subscriptionStatus = "EXPIRED";
              await saveSubscriptionRecord(record, idToken);
            }
          }
        }
      }
      const trialEndTime = record.trialEndDate ? new Date(record.trialEndDate).getTime() : NaN;
      const trialDaysRemaining = currentStatus === "TRIAL" && !isNaN(trialEndTime) ? Math.max(0, Math.ceil((trialEndTime - now) / (1e3 * 60 * 60 * 24))) : 0;
      const serverTimestamp = new Date(now).toISOString();
      const trialStatus = record.trialStatus || (currentStatus === "TRIAL" ? "active" : record.trialEverStarted ? "expired" : "not_started");
      const isTrialActive = currentStatus === "TRIAL" && trialStatus === "active";
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
        subscriptionBasePlanId: record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly",
        planId: record.planId || record.subscriptionBasePlan || "quarterly",
        purchaseDate: record.purchaseDate,
        lastVerifiedAt: record.lastVerifiedAt,
        autoRenewing: record.autoRenewing,
        paymentIssueMessage: record.paymentIssueMessage,
        isSubscribed: currentStatus === "ACTIVE" || currentStatus === "CANCELED_BUT_ACTIVE",
        isFeatureLocked: currentStatus === "EXPIRED"
      });
    } catch (err) {
      console.error("[Subscription Status Error]:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to retrieve subscription status" });
    }
  });
  app.post("/api/billing/start-trial", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required. Missing Bearer token."
        });
      }
      const idToken = authHeader.substring(7).trim();
      const verified = await verifyFirebaseIdToken(idToken);
      if (!verified || !verified.uid) {
        return res.status(401).json({
          success: false,
          error: "INVALID_TOKEN",
          message: "Invalid or expired authentication session. Please sign in again."
        });
      }
      const verifiedUid = verified.uid;
      if (req.body?.userId && req.body.userId !== verifiedUid) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN_USER_MISMATCH",
          message: "Cannot activate trial for a different user account."
        });
      }
      const subResult = await getSubscriptionRecord(verifiedUid, idToken);
      const currentRecord = subResult.record;
      const userProfile = await fetchUserProfileFromFirestore(verifiedUid, idToken);
      const isPaidActive = currentRecord && (currentRecord.subscriptionStatus === "ACTIVE" || currentRecord.subscriptionStatus === "CANCELED_BUT_ACTIVE") || userProfile && (userProfile.isSubscribed || userProfile.subscriptionStatus === "ACTIVE" || userProfile.subscriptionStatus === "CANCELED_BUT_ACTIVE");
      if (isPaidActive) {
        return res.status(400).json({
          success: false,
          error: "PAID_SUBSCRIPTION_ACTIVE",
          message: "You already have an active Pro subscription."
        });
      }
      const pastJob = await fetchDeletionJobFromFirestore(verifiedUid);
      const trialAlreadyUsed = Boolean(
        pastJob?.trialEverStarted || currentRecord?.trialEverStarted || currentRecord?.trialStartDate || currentRecord?.trialEndDate || currentRecord?.subscriptionStatus === "TRIAL" || currentRecord?.subscriptionStatus === "EXPIRED" || userProfile?.trialEverStarted || userProfile?.trialStartDate || userProfile?.trialEndDate || userProfile?.subscriptionStatus === "TRIAL" || userProfile?.subscriptionStatus === "EXPIRED"
      );
      if (trialAlreadyUsed) {
        return res.status(400).json({
          success: false,
          error: "TRIAL_ALREADY_USED",
          message: "The 7-day free trial has already been activated for this account."
        });
      }
      const serverNow = /* @__PURE__ */ new Date();
      const trialStartDate = serverNow.toISOString();
      const trialEndDate = new Date(serverNow.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3).toISOString();
      const updatedRecord = {
        ...currentRecord || {},
        userId: verifiedUid,
        subscriptionStatus: "TRIAL",
        trialStatus: "active",
        trialEverStarted: true,
        trialStartDate,
        trialEndDate,
        subscriptionExpiryDate: null,
        subscriptionExpiryTime: null,
        expiryDate: null,
        subscriptionProductId: "property_agent_pro",
        subscriptionBasePlan: "monthly",
        subscriptionBasePlanId: "monthly",
        planId: "monthly",
        autoRenewing: false,
        acknowledged: true,
        updatedAt: trialStartDate,
        lastVerifiedAt: trialStartDate
      };
      subscriptionStore.set(verifiedUid, updatedRecord);
      persistSubscriptionStoreToDisk();
      await syncSubscriptionToFirestore(updatedRecord, idToken);
      await syncUserProfileTrialToFirestore(
        verifiedUid,
        {
          trialStatus: "active",
          trialStartDate,
          trialEndDate,
          trialEverStarted: true,
          subscriptionStatus: "TRIAL"
        },
        idToken
      );
      console.log(`[Trial Activation] 7-Day free trial started for ${verifiedUid} until ${trialEndDate}`);
      return res.status(200).json({
        success: true,
        subscriptionStatus: "TRIAL",
        trialStatus: "active",
        trialStartDate,
        trialEndDate,
        trialEverStarted: true,
        serverNow: trialStartDate,
        serverTimestamp: trialStartDate,
        trialDaysRemaining: TRIAL_DURATION_DAYS,
        message: "Your 7-day free trial is active"
      });
    } catch (err) {
      console.warn("[Trial Activation Notice]:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to start free trial",
        message: "Unable to start trial right now. Please try again."
      });
    }
  });
  const handleVerifyPurchase = async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("[Google Play Verification] Rejected: Missing Authorization Bearer token.");
        return res.status(401).json({
          success: false,
          error: "Authentication required. Missing Bearer token.",
          message: "Please sign in to verify your purchase."
        });
      }
      const idToken = authHeader.substring(7).trim();
      if (!idToken) {
        console.warn("[Google Play Verification] Rejected: Empty Bearer token.");
        return res.status(401).json({
          success: false,
          error: "Authentication required. Missing Bearer token.",
          message: "Please sign in to verify your purchase."
        });
      }
      const verifiedToken = await verifyFirebaseIdToken(idToken);
      if (!verifiedToken || !verifiedToken.uid) {
        console.warn("[Google Play Verification] Rejected: Firebase ID token is invalid or expired.");
        return res.status(401).json({
          success: false,
          error: "Invalid or expired Firebase ID token.",
          message: "Your session has expired. Please sign in again."
        });
      }
      const verifiedUid = verifiedToken.uid;
      const {
        purchaseToken,
        productId = "property_agent_pro",
        basePlanId = "quarterly",
        packageName: bodyPackageName,
        userId: bodyUserId
      } = req.body || {};
      if (bodyUserId && String(bodyUserId) !== verifiedUid) {
        console.warn(`[Google Play Verification] Rejected: Client body userId "${bodyUserId}" does not match token UID "${verifiedUid}".`);
        return res.status(403).json({
          success: false,
          error: "Forbidden: Authenticated UID does not match requested userId."
        });
      }
      const REQUIRED_PACKAGE_NAME = "com.proplead.tracker";
      const REQUIRED_PRODUCT_ID = "property_agent_pro";
      console.log(`[Google Play Verification] Request received: ${req.method} ${req.originalUrl || req.path}`);
      console.log(`[Google Play Verification] Authenticated UID: ${verifiedUid}`);
      console.log(`[Google Play Verification] Product ID: ${productId}`);
      console.log(`[Google Play Verification] Base Plan ID: ${basePlanId}`);
      console.log(`[Google Play Verification] Purchase token present: ${purchaseToken ? "YES" : "NO"} (length: ${purchaseToken ? String(purchaseToken).length : 0})`);
      if (!purchaseToken || typeof purchaseToken !== "string" || purchaseToken.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Missing or invalid purchaseToken for server verification."
        });
      }
      if (bodyPackageName && bodyPackageName !== REQUIRED_PACKAGE_NAME) {
        return res.status(400).json({
          success: false,
          error: `Invalid package name: "${bodyPackageName}". Expected "${REQUIRED_PACKAGE_NAME}".`
        });
      }
      if (productId !== REQUIRED_PRODUCT_ID) {
        return res.status(400).json({
          success: false,
          error: `Invalid product ID: "${productId}". Expected "${REQUIRED_PRODUCT_ID}".`
        });
      }
      if (basePlanId !== "monthly" && basePlanId !== "quarterly") {
        return res.status(400).json({
          success: false,
          error: `Invalid base plan ID: "${basePlanId}". Expected "monthly" or "quarterly".`
        });
      }
      const existingTokenOwner = await findSubscriptionRecordByPurchaseToken(purchaseToken);
      if (existingTokenOwner && existingTokenOwner.userId !== verifiedUid) {
        console.error(`[Google Play Verification Security Alert] Token already registered to UID "${existingTokenOwner.userId}". Rejecting UID "${verifiedUid}".`);
        return res.status(403).json({
          success: false,
          error: "This purchase token is already registered to a different account."
        });
      }
      const verification = await verifyGooglePlaySubscriptionToken(
        purchaseToken,
        REQUIRED_PRODUCT_ID,
        basePlanId,
        REQUIRED_PACKAGE_NAME
      );
      console.log(`[Google Play Verification] Google Play verification result: ${verification.isValid ? "SUCCESS" : "FAILED"} (status: "${verification.subscriptionStatus}", pending: ${Boolean(verification.verificationPending)})`);
      if (verification.verificationPending) {
        return res.status(503).json({
          success: false,
          error: "SUBSCRIPTION_VERIFICATION_PENDING",
          message: "Purchase completed but verification is temporarily unavailable."
        });
      }
      if (!verification.isValid) {
        console.error(`[Google Play Verification] Token validation rejected for user ${verifiedUid}:`, verification.error);
        return res.status(400).json({
          success: false,
          error: verification.error || "Google Play purchase token verification failed."
        });
      }
      if (!verification.subscriptionExpiryDate) {
        console.error("[Google Play Verification] Missing authoritative expiry date from Google Play.");
        return res.status(503).json({
          success: false,
          error: "SUBSCRIPTION_VERIFICATION_PENDING",
          message: "Purchase completed but verification is temporarily unavailable."
        });
      }
      const effectiveBasePlan = verification.basePlanId || basePlanId;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let record;
      try {
        const subResult = await getSubscriptionRecord(verifiedUid, idToken);
        if (subResult.record) {
          record = subResult.record;
        } else {
          record = {
            userId: verifiedUid,
            subscriptionStatus: "ACTIVE",
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
            updatedAt: nowIso
          };
        }
      } catch {
        record = {
          userId: verifiedUid,
          subscriptionStatus: "ACTIVE",
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
          updatedAt: nowIso
        };
      }
      record.userId = verifiedUid;
      record.subscriptionStatus = verification.subscriptionStatus === "CANCELED_BUT_ACTIVE" ? "CANCELED_BUT_ACTIVE" : "ACTIVE";
      record.subscriptionProductId = REQUIRED_PRODUCT_ID;
      record.subscriptionBasePlan = effectiveBasePlan;
      record.subscriptionBasePlanId = effectiveBasePlan;
      record.planId = effectiveBasePlan;
      record.purchaseDate = record.purchaseDate || nowIso;
      record.purchaseToken = purchaseToken;
      record.orderId = verification.orderId;
      record.subscriptionExpiryDate = verification.subscriptionExpiryDate;
      record.subscriptionExpiryTime = verification.subscriptionExpiryDate;
      record.expiryDate = verification.subscriptionExpiryDate;
      record.autoRenewing = verification.autoRenewing;
      record.acknowledged = verification.acknowledged;
      record.paymentIssueMessage = void 0;
      record.lastVerifiedAt = nowIso;
      let firestoreResult = { subscriptionsCollectionSynced: false, userProfileSynced: false };
      try {
        firestoreResult = await saveSubscriptionRecord(record, idToken);
      } catch (saveErr) {
        console.error("[Google Play Verification] Error persisting verified record to Firestore:", saveErr);
      }
      const firestoreStatusString = `subscriptions: ${firestoreResult.subscriptionsCollectionSynced ? "UPDATED" : "SKIPPED/FAILED"}, user profile: ${firestoreResult.userProfileSynced ? "UPDATED" : "SKIPPED/FAILED"}`;
      console.log(`[Google Play Verification] Firestore update result: ${firestoreStatusString}`);
      console.log(`[Google Play Billing] Subscription verified and activated for ${verifiedUid}. Plan: ${effectiveBasePlan}, Expiry: ${record.subscriptionExpiryDate}, OrderId: ${verification.orderId}`);
      return res.status(200).json({
        success: true,
        subscriptionStatus: "active",
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
        message: "Google Play subscription verified and activated successfully."
      });
    } catch (unexpectedErr) {
      console.error("[Google Play Billing Verification Exception]:", unexpectedErr);
      return res.status(500).json({
        success: false,
        error: unexpectedErr?.message || "Unexpected error occurred during purchase verification."
      });
    }
  };
  app.post("/api/billing/verify-purchase", handleVerifyPurchase);
  app.post("/api/billing/verify", handleVerifyPurchase);
  app.post("/api/verify-purchase", handleVerifyPurchase);
  app.post("/api/verify", handleVerifyPurchase);
  app.all(["/api/billing/verify-purchase", "/api/billing/verify", "/api/verify-purchase", "/api/verify"], (req, res) => {
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed on verification endpoint. Please use POST.`
    });
  });
  app.post("/api/billing/restore-purchases", async (req, res) => {
    const verifiedUid = await authenticateRequest(req, res);
    if (!verifiedUid) return;
    const { purchaseToken, isBridgeAvailable = false, productId = "property_agent_pro" } = req.body;
    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(verifiedUid, idToken);
    if (subResult.unavailable || !subResult.record) {
      return res.status(503).json({
        success: false,
        error: "Subscription service temporarily unavailable. Please retry shortly."
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
          error: "SUBSCRIPTION_VERIFICATION_PENDING",
          message: "Google Play verification is temporarily unavailable. Please retry shortly."
        });
      }
      if (verification.isValid && (verification.subscriptionStatus === "ACTIVE" || verification.subscriptionStatus === "CANCELED_BUT_ACTIVE")) {
        record.subscriptionStatus = verification.subscriptionStatus;
        record.subscriptionExpiryDate = verification.subscriptionExpiryDate;
        record.subscriptionExpiryTime = verification.subscriptionExpiryDate;
        record.subscriptionBasePlanId = verification.basePlanId || record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly";
        record.subscriptionBasePlan = record.subscriptionBasePlanId;
        record.planId = record.subscriptionBasePlanId;
        record.autoRenewing = verification.autoRenewing;
        record.purchaseToken = tokenToVerify;
        record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
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
          message: "Active PropLead subscription restored via Google Play!"
        });
      } else {
        return res.json({
          success: true,
          restored: false,
          hasLiveGooglePlayAuth: Boolean(client),
          subscriptionStatus: record.subscriptionStatus,
          message: "No active PropLead subscription was found for this Google Play account."
        });
      }
    }
    if (record.subscriptionStatus === "ACTIVE" || record.subscriptionStatus === "CANCELED_BUT_ACTIVE") {
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
          subscriptionBasePlanId: record.subscriptionBasePlanId || record.subscriptionBasePlan || "quarterly",
          planId: record.planId || record.subscriptionBasePlan || "quarterly",
          autoRenewing: record.autoRenewing,
          purchaseToken: record.purchaseToken,
          message: "Active PropLead subscription restored from verified account record!"
        });
      }
    }
    if (!client && !isBridgeAvailable) {
      return res.json({
        success: false,
        restored: false,
        billingUnavailable: true,
        hasLiveGooglePlayAuth: false,
        message: "Google Play billing is currently unavailable. Please try again."
      });
    }
    return res.json({
      success: true,
      restored: false,
      hasLiveGooglePlayAuth: Boolean(client),
      subscriptionStatus: record.subscriptionStatus,
      message: "No active PropLead subscription was found for this Google Play account."
    });
  });
  app.post("/api/billing/google-play-webhook", async (req, res) => {
    const webhookSecret = process.env.GOOGLE_PLAY_WEBHOOK_SECRET;
    const providedSecret = req.query.secret || req.headers["x-webhook-secret"];
    const authHeader = req.headers.authorization;
    if (webhookSecret) {
      if (providedSecret !== webhookSecret) {
        return res.status(401).json({ error: "Unauthorized webhook call. Secret mismatch." });
      }
    } else if (process.env.NODE_ENV === "production") {
      if (!authHeader && !providedSecret) {
        return res.status(401).json({ error: "Unauthorized. Pub/Sub authentication required in production." });
      }
    }
    try {
      const message = req.body.message;
      if (!message || !message.data) {
        return res.status(200).send("No message data");
      }
      const decodedData = Buffer.from(message.data, "base64").toString("utf8");
      const rtdnPayload = JSON.parse(decodedData);
      console.log("[Google Play RTDN Notification Received]:", rtdnPayload);
      const subNotification = rtdnPayload.subscriptionNotification;
      if (subNotification) {
        const { notificationType, purchaseToken, subscriptionId } = subNotification;
        console.log(`[Google Play RTDN] Processing type ${notificationType} for subscription ${subscriptionId}`);
        const verification = await verifyGooglePlaySubscriptionToken(purchaseToken, subscriptionId);
        const matchingRecord = await findSubscriptionRecordByPurchaseToken(purchaseToken);
        if (matchingRecord) {
          if (verification.isValid && verification.subscriptionExpiryDate) {
            matchingRecord.subscriptionStatus = verification.subscriptionStatus === "CANCELED_BUT_ACTIVE" ? "CANCELED_BUT_ACTIVE" : verification.subscriptionStatus === "PAYMENT_ISSUE" ? "PAYMENT_ISSUE" : "ACTIVE";
            matchingRecord.subscriptionExpiryDate = verification.subscriptionExpiryDate;
            matchingRecord.subscriptionExpiryTime = verification.subscriptionExpiryDate;
            matchingRecord.expiryDate = verification.subscriptionExpiryDate;
            matchingRecord.autoRenewing = verification.autoRenewing;
            matchingRecord.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
            if (verification.subscriptionStatus === "PAYMENT_ISSUE") {
              matchingRecord.paymentIssueMessage = "Google Play grace period: Payment issue detected. Please update payment method to avoid suspension.";
            } else {
              matchingRecord.paymentIssueMessage = void 0;
            }
            await saveSubscriptionRecord(matchingRecord);
            console.log(`[Google Play RTDN] Updated subscription for user ${matchingRecord.userId} to ${matchingRecord.subscriptionStatus}`);
          } else {
            matchingRecord.subscriptionStatus = "EXPIRED";
            matchingRecord.autoRenewing = false;
            matchingRecord.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
            if (notificationType === 5 || verification.subscriptionStatus === "PENDING") {
              matchingRecord.paymentIssueMessage = "Google Play account is on hold. Subscription benefits are paused.";
            }
            await saveSubscriptionRecord(matchingRecord);
            console.log(`[Google Play RTDN] Marked subscription EXPIRED for user ${matchingRecord.userId} (type ${notificationType})`);
          }
        }
      }
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Google Play RTDN Error]:", err);
      return res.status(200).send("Error processing RTDN");
    }
  });
  app.post("/api/billing/cancel-sync", async (req, res) => {
    const verifiedUid = await authenticateRequest(req, res);
    if (!verifiedUid) return;
    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(verifiedUid, idToken);
    if (subResult.unavailable || !subResult.record) {
      return res.status(503).json({
        success: false,
        error: "Subscription service temporarily unavailable. Please retry shortly."
      });
    }
    const record = subResult.record;
    if (record.subscriptionStatus === "ACTIVE") {
      record.subscriptionStatus = "CANCELED_BUT_ACTIVE";
      record.autoRenewing = false;
      await saveSubscriptionRecord(record, idToken);
      return res.json({
        success: true,
        subscriptionStatus: "CANCELED_BUT_ACTIVE",
        subscriptionExpiryDate: record.subscriptionExpiryDate,
        message: `Subscription cancelled. Access remains active until ${new Date(record.subscriptionExpiryDate).toLocaleDateString("en-IN")}.`
      });
    }
    return res.json({
      success: true,
      subscriptionStatus: record.subscriptionStatus
    });
  });
  app.post("/api/account/delete", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authentication required. Missing Bearer token."
        });
      }
      const token = authHeader.substring(7).trim();
      const verified = await verifyFirebaseIdToken(token);
      if (!verified) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired Firebase ID token."
        });
      }
      const verifiedUid = verified.uid;
      const adminAccessToken = await getFirebaseAdminAccessToken();
      if (!adminAccessToken) {
        return res.status(503).json({
          success: false,
          error: "Account deletion service is temporarily unavailable. Please contact PropLead support."
        });
      }
      const existingSub = subscriptionStore.get(verifiedUid) || (await fetchSubscriptionFromFirestore(verifiedUid)).record;
      const hadTrial = Boolean(
        existingSub?.trialEverStarted || existingSub?.trialStartDate || existingSub?.trialEndDate || existingSub?.subscriptionStatus === "TRIAL"
      );
      revokedUids.add(verifiedUid);
      subscriptionStore.delete(verifiedUid);
      persistSubscriptionStoreToDisk();
      await markUserAccountDeletedInFirestore(verifiedUid, adminAccessToken);
      await createOrUpdateDeletionJob({
        uid: verifiedUid,
        email: typeof req.body?.email === "string" ? req.body.email : verified.email,
        status: "pending",
        requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
        retryCount: 0,
        lastError: null,
        completedAt: null,
        trialEverStarted: hadTrial
      }, adminAccessToken);
      let authDeletedOnServer = false;
      try {
        await deleteFirebaseAuthUser(verifiedUid, adminAccessToken);
        authDeletedOnServer = true;
      } catch (authErr) {
        console.warn("[Account Deletion Phase 1] Server-side Firebase Auth delete notice:", authErr?.message || authErr);
      }
      setImmediate(() => {
        processAccountDeletionJob(verifiedUid).catch((err) => {
          console.warn("[Account Deletion Phase 2 Background Error]", err);
        });
      });
      return res.status(200).json({
        success: true,
        phase1Complete: true,
        authDeleted: authDeletedOnServer
      });
    } catch (err) {
      console.warn("[Account Deletion Phase 1] Failed:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Account deletion failed. Please try again."
      });
    }
  });
  app.get("/privacy-policy", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
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
    <p>Dedicated CRM for Real Estate Agents & Brokers \u2022 Effective: September 2026</p>
  </div>
  <div class="container">
    <div class="pledge">
      <h3>\u{1F512} Broker Client Data Protection Guarantee</h3>
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
  app.get(["/account-deletion", "/delete-account"], (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
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
      <h3>\u26A0\uFE0F Permanent &amp; Irreversible Data Deletion</h3>
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
      <p>If you no longer have access to the mobile app, you can submit a deletion request below using your registered Google account email. Requests are processed within 24\u201348 hours.</p>
      
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
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route ${req.method} ${req.path} not found.`
    });
  });
  app.use("/api", (err, req, res, next) => {
    console.error("[Express API Error Handler]", err);
    res.status(err.status || 500).json({
      success: false,
      error: err?.message || "Internal API server error"
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_fs.default.existsSync(import_path.default.join(process.cwd(), "dist")) ? import_path.default.join(process.cwd(), "dist") : import_path.default.resolve(__dirname, ".");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Not Found");
      }
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`PropLead Full-Stack Server running on port ${PORT}`);
  });
  server.on("error", (err) => {
    console.error("[Server Error]", err);
  });
}
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TRIAL_DURATION_DAYS,
  getSubscriptionRecord,
  verifyFirebaseIdToken
});
//# sourceMappingURL=server.cjs.map
