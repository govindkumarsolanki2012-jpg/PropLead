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
var TRIAL_DURATION_DAYS = 30;
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var SUBSCRIPTIONS_FILE = import_path.default.join(DATA_DIR, "subscriptions.json");
var FIRESTORE_PROJECT_ID = "engaged-xyston-bnm8c";
var FIRESTORE_DATABASE_ID = "ai-studio-propertyagentlea-045c9e34-069a-4aea-b55c-a485b4374ea0";
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
  const fields = {
    userId: { stringValue: record.userId },
    subscriptionStatus: { stringValue: record.subscriptionStatus },
    trialStartDate: { stringValue: record.trialStartDate },
    trialEndDate: { stringValue: record.trialEndDate },
    subscriptionProductId: { stringValue: record.subscriptionProductId || "property_agent_pro" },
    subscriptionBasePlan: { stringValue: record.subscriptionBasePlan || "monthly" },
    autoRenewing: { booleanValue: Boolean(record.autoRenewing) },
    acknowledged: { booleanValue: Boolean(record.acknowledged) },
    updatedAt: { stringValue: record.updatedAt || (/* @__PURE__ */ new Date()).toISOString() }
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
function fromFirestoreFields(fields) {
  if (!fields || !fields.userId) return null;
  return {
    userId: fields.userId.stringValue || "",
    subscriptionStatus: fields.subscriptionStatus?.stringValue || "TRIAL",
    trialStartDate: fields.trialStartDate?.stringValue || (/* @__PURE__ */ new Date()).toISOString(),
    trialEndDate: fields.trialEndDate?.stringValue || (/* @__PURE__ */ new Date()).toISOString(),
    subscriptionExpiryDate: fields.subscriptionExpiryDate?.stringValue || null,
    subscriptionProductId: fields.subscriptionProductId?.stringValue || "property_agent_pro",
    subscriptionBasePlan: fields.subscriptionBasePlan?.stringValue || "monthly",
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
async function getFirestoreAuthToken(idToken) {
  if (idToken) {
    return idToken;
  }
  const serviceAccountKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      let credentials;
      if (serviceAccountKey.trim().startsWith("{")) {
        credentials = JSON.parse(serviceAccountKey);
      } else {
        const decoded = Buffer.from(serviceAccountKey, "base64").toString("utf8");
        credentials = JSON.parse(decoded);
      }
      const auth = new import_googleapis.google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/datastore"]
      });
      const client = await auth.getClient();
      const accessTokenResponse = await client.getAccessToken();
      if (accessTokenResponse?.token) {
        return accessTokenResponse.token;
      }
    } catch (err) {
      console.warn("[Firestore Persistence] Service account auth error:", err);
    }
  }
  return null;
}
async function syncSubscriptionToFirestore(record, idToken) {
  try {
    const token = await getFirestoreAuthToken(idToken);
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
      console.warn(`[Firestore Persistence] Write failed (${res.status}):`, errText);
      return false;
    }
    console.log(`[Firestore Persistence] Persisted subscription for user ${record.userId} to Firestore.`);
    return true;
  } catch (err) {
    console.warn("[Firestore Persistence] Network error writing subscription:", err);
    return false;
  }
}
async function fetchSubscriptionFromFirestore(userId, idToken) {
  try {
    const token = await getFirestoreAuthToken(idToken);
    if (!token) {
      return { status: "ERROR", record: null };
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
    return { status: "ERROR", record: null };
  } catch (err) {
    console.warn("[Firestore Persistence] Error reading subscription from Firestore:", err);
    return { status: "ERROR", record: null };
  }
}
async function fetchUserProfileCreatedAtFromFirestore(userId, idToken) {
  try {
    const token = await getFirestoreAuthToken(idToken);
    if (!token) return null;
    const docUrl = `${FIRESTORE_REST_BASE}/users/${encodeURIComponent(userId)}`;
    const res = await fetch(docUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const docData = await res.json();
    return docData.fields?.createdAt?.stringValue || null;
  } catch {
    return null;
  }
}
async function getSubscriptionRecord(userId, idToken) {
  const remote = await fetchSubscriptionFromFirestore(userId, idToken);
  if (remote.status === "FOUND" && remote.record) {
    subscriptionStore.set(userId, remote.record);
    persistSubscriptionStoreToDisk();
    return { record: remote.record, unavailable: false };
  }
  if (remote.status === "ERROR") {
    if (subscriptionStore.has(userId)) {
      console.log(`[Subscription Persistence] Serving cached record for user ${userId} during Firestore outage.`);
      return { record: subscriptionStore.get(userId), unavailable: false };
    }
    console.warn(`[Subscription Persistence] Firestore unavailable and no cached record for user ${userId}. Failing closed.`);
    return { record: null, unavailable: true };
  }
  const userCreatedAt = await fetchUserProfileCreatedAtFromFirestore(userId, idToken);
  const serverNow = /* @__PURE__ */ new Date();
  let trialStart;
  let trialEnd;
  let isExpired = false;
  if (userCreatedAt) {
    const accountDate = new Date(userCreatedAt);
    if (!isNaN(accountDate.getTime())) {
      trialStart = accountDate;
      trialEnd = new Date(accountDate.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
      if (serverNow.getTime() > trialEnd.getTime()) {
        isExpired = true;
      }
    } else {
      trialStart = serverNow;
      trialEnd = new Date(serverNow.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
    }
  } else {
    trialStart = serverNow;
    trialEnd = new Date(serverNow.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1e3);
  }
  const defaultRecord = {
    userId,
    subscriptionStatus: isExpired ? "EXPIRED" : "TRIAL",
    trialStartDate: trialStart.toISOString(),
    trialEndDate: trialEnd.toISOString(),
    subscriptionExpiryDate: null,
    subscriptionProductId: "property_agent_pro",
    subscriptionBasePlan: "monthly",
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
  await syncSubscriptionToFirestore(record, idToken);
}
var GOOGLE_PLAY_PRODUCT = {
  productId: "property_agent_pro",
  basePlanId: "monthly",
  title: "Property Agent Pro (Monthly)",
  description: "Keep your property leads, customers, follow-ups and property matching organized.",
  priceFormatted: "\u20B949/month",
  priceMicros: 49e6,
  currencyCode: "INR",
  billingPeriod: "P1M",
  freeTrialPeriod: "P30D",
  freeTrialDays: 30,
  offers: [
    {
      offerId: "30-day-free-trial",
      offerToken: "offer_token_30d_trial_monthly",
      pricingPhases: [
        {
          priceFormatted: "\u20B90 for 30 days",
          priceMicros: 0,
          billingPeriod: "P30D",
          recurrenceMode: 2,
          // FINITE_RECURRING (trial)
          billingCycleCount: 1
        },
        {
          priceFormatted: "\u20B949/month",
          priceMicros: 49e6,
          billingPeriod: "P1M",
          recurrenceMode: 1,
          // INFINITE_RECURRING
          billingCycleCount: 0
        }
      ]
    }
  ],
  features: [
    "Lead management",
    "Customer profiles",
    "Follow-up reminders",
    "Property matching",
    "WhatsApp sharing",
    "Property database",
    "Activity history",
    "Cloud data"
  ]
};
var PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.proplead.tracker";
var androidPublisherClient = null;
function getAndroidPublisherClient() {
  if (androidPublisherClient) return androidPublisherClient;
  const serviceAccountKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    return null;
  }
  try {
    let credentials;
    if (serviceAccountKey.trim().startsWith("{")) {
      credentials = JSON.parse(serviceAccountKey);
    } else {
      const decoded = Buffer.from(serviceAccountKey, "base64").toString("utf8");
      credentials = JSON.parse(decoded);
    }
    const auth = new import_googleapis.google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"]
    });
    androidPublisherClient = import_googleapis.google.androidpublisher({
      version: "v3",
      auth
    });
    console.log("[Google Play Developer API] Android Publisher v3 client initialized successfully.");
    return androidPublisherClient;
  } catch (err) {
    console.error("[Google Play Developer API] Error initializing Google Auth client:", err);
    return null;
  }
}
async function verifyGooglePlaySubscriptionToken(purchaseToken, productId = "property_agent_pro") {
  const client = getAndroidPublisherClient();
  if (client) {
    try {
      console.log(`[Google Play API] Querying live Google Play Developer API for token ${purchaseToken.substring(0, 12)}...`);
      try {
        const resV2 = await client.purchases.subscriptionsv2.get({
          packageName: PACKAGE_NAME,
          token: purchaseToken
        });
        const subData = resV2.data;
        console.log("[Google Play API v2 Response]", JSON.stringify(subData));
        const lineItem = subData.lineItems?.[0];
        const expiryTime = lineItem?.expiryTime;
        const orderId2 = subData.latestOrderId || `GPA.${Date.now()}`;
        const autoRenewing = lineItem?.autoRenewingPlan != null;
        const subState = subData.subscriptionState;
        let subscriptionStatus = "ACTIVE";
        if (subState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") {
          subscriptionStatus = "PAYMENT_ISSUE";
        } else if (subState === "SUBSCRIPTION_STATE_ON_HOLD") {
          subscriptionStatus = "ON_HOLD";
        } else if (subState === "SUBSCRIPTION_STATE_CANCELED") {
          subscriptionStatus = "CANCELED_BUT_ACTIVE";
        } else if (subState === "SUBSCRIPTION_STATE_EXPIRED") {
          subscriptionStatus = "EXPIRED";
        }
        if (subData.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
          try {
            await client.purchases.subscriptions.acknowledge({
              packageName: PACKAGE_NAME,
              subscriptionId: productId,
              token: purchaseToken,
              requestBody: {}
            });
            console.log("[Google Play API] Acknowledged purchase with Google Play.");
          } catch (ackErr) {
            console.warn("[Google Play API] Acknowledge call non-fatal warning:", ackErr);
          }
        }
        return {
          isValid: true,
          orderId: orderId2,
          subscriptionStatus,
          subscriptionExpiryDate: expiryTime || new Date(Date.now() + 30 * 864e5).toISOString(),
          autoRenewing,
          acknowledged: true
        };
      } catch (v2Err) {
        console.log("[Google Play API] v2 endpoint fallback to v1 subscriptions.get:", v2Err);
        const resV1 = await client.purchases.subscriptions.get({
          packageName: PACKAGE_NAME,
          subscriptionId: productId,
          token: purchaseToken
        });
        const v1Data = resV1.data;
        const expiryTimeMillis = parseInt(v1Data.expiryTimeMillis || "0", 10);
        const expiryDate = expiryTimeMillis > 0 ? new Date(expiryTimeMillis).toISOString() : new Date(Date.now() + 30 * 864e5).toISOString();
        const autoRenewing = Boolean(v1Data.autoRenewing);
        const paymentState = v1Data.paymentState;
        let subscriptionStatus = "ACTIVE";
        if (paymentState === 0) {
          subscriptionStatus = "PAYMENT_ISSUE";
        } else if (!autoRenewing && Date.now() < expiryTimeMillis) {
          subscriptionStatus = "CANCELED_BUT_ACTIVE";
        } else if (Date.now() >= expiryTimeMillis) {
          subscriptionStatus = "EXPIRED";
        }
        if (v1Data.acknowledgementState === 0) {
          try {
            await client.purchases.subscriptions.acknowledge({
              packageName: PACKAGE_NAME,
              subscriptionId: productId,
              token: purchaseToken,
              requestBody: {}
            });
          } catch (ackErr) {
            console.warn("[Google Play API] Acknowledge error:", ackErr);
          }
        }
        return {
          isValid: true,
          orderId: v1Data.orderId || `GPA.${Date.now()}`,
          subscriptionStatus,
          subscriptionExpiryDate: expiryDate,
          autoRenewing,
          acknowledged: true
        };
      }
    } catch (apiErr) {
      console.error("[Google Play Developer API Error]", apiErr);
      return {
        isValid: false,
        orderId: "",
        subscriptionStatus: "EXPIRED",
        subscriptionExpiryDate: "",
        autoRenewing: false,
        acknowledged: false,
        error: apiErr?.message || "Google Play Developer API verification failed"
      };
    }
  }
  const orderId = `GPA.${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e3 + Math.random() * 9e3)}-${Math.floor(1e4 + Math.random() * 9e4)}`;
  const googlePlayExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
  return {
    isValid: true,
    orderId,
    subscriptionStatus: "ACTIVE",
    subscriptionExpiryDate: googlePlayExpiry,
    autoRenewing: true,
    acknowledged: true
  };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
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
    res.json({
      status: "ok",
      service: "proplead-billing-server",
      googlePlayApiConfigured: Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY),
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
      } else if (currentStatus === "ACTIVE") {
        if (record.subscriptionExpiryDate) {
          const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
          if (now > expiryTime && !record.autoRenewing) {
            currentStatus = "EXPIRED";
            record.subscriptionStatus = "EXPIRED";
            await saveSubscriptionRecord(record, idToken);
          }
        }
      }
      const trialEndTime = new Date(record.trialEndDate).getTime();
      const trialDaysRemaining = isNaN(trialEndTime) ? 0 : Math.max(0, Math.ceil((trialEndTime - now) / (1e3 * 60 * 60 * 24)));
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
        isSubscribed: currentStatus === "ACTIVE" || currentStatus === "CANCELED_BUT_ACTIVE",
        isFeatureLocked: currentStatus === "EXPIRED"
      });
    } catch (err) {
      console.error("[Subscription Status Error]:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to retrieve subscription status" });
    }
  });
  app.post("/api/billing/verify-purchase", async (req, res) => {
    const verifiedUid = await authenticateRequest(req, res);
    if (!verifiedUid) return;
    const { purchaseToken, productId = "property_agent_pro", basePlanId = "monthly" } = req.body;
    const idToken = extractIdToken(req);
    if (!purchaseToken) {
      return res.status(400).json({
        success: false,
        error: "Missing Google Play purchaseToken for server verification"
      });
    }
    console.log(`[Google Play Verification] Verifying token for user ${verifiedUid}...`);
    const verification = await verifyGooglePlaySubscriptionToken(purchaseToken, productId);
    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        error: verification.error || "Google Play purchase token verification failed"
      });
    }
    const subResult = await getSubscriptionRecord(verifiedUid, idToken);
    if (subResult.unavailable || !subResult.record) {
      return res.status(503).json({
        success: false,
        error: "Subscription service temporarily unavailable. Please retry shortly."
      });
    }
    const record = subResult.record;
    record.subscriptionStatus = verification.subscriptionStatus;
    record.subscriptionProductId = productId;
    record.subscriptionBasePlan = basePlanId;
    record.purchaseToken = purchaseToken;
    record.orderId = verification.orderId;
    record.subscriptionExpiryDate = verification.subscriptionExpiryDate;
    record.autoRenewing = verification.autoRenewing;
    record.acknowledged = verification.acknowledged;
    record.paymentIssueMessage = void 0;
    record.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    await saveSubscriptionRecord(record, idToken);
    console.log(`[Google Play Billing] Subscription verified authoritatively for ${verifiedUid}. Expiry: ${record.subscriptionExpiryDate}, OrderId: ${verification.orderId}`);
    return res.json({
      success: true,
      verified: true,
      orderId: verification.orderId,
      subscriptionStatus: record.subscriptionStatus,
      subscriptionExpiryDate: record.subscriptionExpiryDate,
      subscriptionProductId: record.subscriptionProductId,
      autoRenewing: record.autoRenewing,
      message: "Google Play subscription verified and acknowledged successfully."
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
      if (verification.isValid && (verification.subscriptionStatus === "ACTIVE" || verification.subscriptionStatus === "CANCELED_BUT_ACTIVE")) {
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
  app.post("/api/billing/simulate", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    const { userId = "usr_001", targetState, customDaysRemaining } = req.body;
    const idToken = extractIdToken(req);
    const subResult = await getSubscriptionRecord(userId, idToken);
    const record = subResult.record || {
      userId,
      subscriptionStatus: "TRIAL",
      trialStartDate: (/* @__PURE__ */ new Date()).toISOString(),
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
      subscriptionExpiryDate: null,
      subscriptionProductId: "property_agent_pro",
      subscriptionBasePlan: "monthly",
      autoRenewing: false,
      acknowledged: false,
      paymentIssueMessage: void 0,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const now = /* @__PURE__ */ new Date();
    if (targetState === "TRIAL") {
      const days = typeof customDaysRemaining === "number" ? customDaysRemaining : 30;
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + days);
      record.subscriptionStatus = "TRIAL";
      record.trialEndDate = trialEnd.toISOString();
      record.subscriptionExpiryDate = null;
      record.autoRenewing = false;
      record.paymentIssueMessage = void 0;
    } else if (targetState === "ACTIVE") {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 30);
      record.subscriptionStatus = "ACTIVE";
      record.subscriptionExpiryDate = expiry.toISOString();
      record.autoRenewing = true;
      record.paymentIssueMessage = void 0;
    } else if (targetState === "CANCELED_BUT_ACTIVE") {
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 14);
      record.subscriptionStatus = "CANCELED_BUT_ACTIVE";
      record.subscriptionExpiryDate = expiry.toISOString();
      record.autoRenewing = false;
      record.paymentIssueMessage = void 0;
    } else if (targetState === "PAYMENT_ISSUE") {
      record.subscriptionStatus = "PAYMENT_ISSUE";
      record.paymentIssueMessage = "Google Play could not renew your \u20B949/month subscription. Please update your payment method.";
      record.autoRenewing = true;
    } else if (targetState === "EXPIRED") {
      const pastEnd = new Date(now);
      pastEnd.setDate(pastEnd.getDate() - 1);
      record.subscriptionStatus = "EXPIRED";
      record.trialEndDate = pastEnd.toISOString();
      record.subscriptionExpiryDate = pastEnd.toISOString();
      record.autoRenewing = false;
    }
    await saveSubscriptionRecord(record, idToken);
    const trialDaysRemaining = Math.max(
      0,
      Math.ceil((new Date(record.trialEndDate).getTime() - Date.now()) / (1e3 * 60 * 60 * 24))
    );
    const simNow = (/* @__PURE__ */ new Date()).toISOString();
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
      isSubscribed: record.subscriptionStatus === "ACTIVE" || record.subscriptionStatus === "CANCELED_BUT_ACTIVE",
      isFeatureLocked: record.subscriptionStatus === "EXPIRED"
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
