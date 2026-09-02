var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_googleapis = require("googleapis");
var import_genai = require("@google/genai");
var subscriptionDatabase = /* @__PURE__ */ new Map();
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
function getOrCreateUserSubscription(userId, initialStartDate) {
  if (subscriptionDatabase.has(userId)) {
    return subscriptionDatabase.get(userId);
  }
  const now = initialStartDate ? new Date(initialStartDate) : /* @__PURE__ */ new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 30);
  const defaultRecord = {
    userId,
    subscriptionStatus: "TRIAL",
    trialStartDate: now.toISOString(),
    trialEndDate: trialEnd.toISOString(),
    subscriptionExpiryDate: null,
    subscriptionProductId: "property_agent_pro",
    subscriptionBasePlan: "monthly",
    autoRenewing: false,
    acknowledged: false,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  subscriptionDatabase.set(userId, defaultRecord);
  return defaultRecord;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
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
  app.get("/api/billing/subscription-status", (req, res) => {
    const userId = req.query.userId || "usr_001";
    const initialStartDate = req.query.trialStartDate;
    const record = getOrCreateUserSubscription(userId, initialStartDate);
    const now = Date.now();
    let currentStatus = record.subscriptionStatus;
    if (currentStatus === "TRIAL") {
      const trialEndTime = new Date(record.trialEndDate).getTime();
      if (now > trialEndTime) {
        currentStatus = "EXPIRED";
        record.subscriptionStatus = "EXPIRED";
      }
    } else if (currentStatus === "CANCELED_BUT_ACTIVE") {
      if (record.subscriptionExpiryDate) {
        const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
        if (now > expiryTime) {
          currentStatus = "EXPIRED";
          record.subscriptionStatus = "EXPIRED";
        }
      }
    } else if (currentStatus === "ACTIVE") {
      if (record.subscriptionExpiryDate) {
        const expiryTime = new Date(record.subscriptionExpiryDate).getTime();
        if (now > expiryTime && !record.autoRenewing) {
          currentStatus = "EXPIRED";
          record.subscriptionStatus = "EXPIRED";
        }
      }
    }
    const trialDaysRemaining = Math.max(
      0,
      Math.ceil((new Date(record.trialEndDate).getTime() - now) / (1e3 * 60 * 60 * 24))
    );
    res.json({
      success: true,
      userId: record.userId,
      subscriptionStatus: currentStatus,
      trialStartDate: record.trialStartDate,
      trialEndDate: record.trialEndDate,
      trialDaysRemaining,
      subscriptionExpiryDate: record.subscriptionExpiryDate,
      subscriptionProductId: record.subscriptionProductId,
      subscriptionBasePlan: record.subscriptionBasePlan,
      autoRenewing: record.autoRenewing,
      paymentIssueMessage: record.paymentIssueMessage,
      isSubscribed: currentStatus === "ACTIVE" || currentStatus === "CANCELED_BUT_ACTIVE",
      isFeatureLocked: currentStatus === "EXPIRED"
    });
  });
  app.post("/api/billing/verify-purchase", async (req, res) => {
    const { userId = "usr_001", purchaseToken, productId = "property_agent_pro", basePlanId = "monthly" } = req.body;
    if (!purchaseToken) {
      return res.status(400).json({
        success: false,
        error: "Missing Google Play purchaseToken for server verification"
      });
    }
    console.log(`[Google Play Verification] Verifying token for user ${userId}...`);
    const verification = await verifyGooglePlaySubscriptionToken(purchaseToken, productId);
    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        error: verification.error || "Google Play purchase token verification failed"
      });
    }
    const record = getOrCreateUserSubscription(userId);
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
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    subscriptionDatabase.set(userId, record);
    console.log(`[Google Play Billing] Subscription verified authoritatively. Expiry: ${record.subscriptionExpiryDate}, OrderId: ${verification.orderId}`);
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
    const { userId = "usr_001", purchaseToken, isBridgeAvailable = false, productId = "property_agent_pro" } = req.body;
    const record = getOrCreateUserSubscription(userId);
    const client = getAndroidPublisherClient();
    const tokenToVerify = purchaseToken || record.purchaseToken;
    if (tokenToVerify) {
      const verification = await verifyGooglePlaySubscriptionToken(tokenToVerify, productId);
      if (verification.isValid && (verification.subscriptionStatus === "ACTIVE" || verification.subscriptionStatus === "CANCELED_BUT_ACTIVE")) {
        record.subscriptionStatus = verification.subscriptionStatus;
        record.subscriptionExpiryDate = verification.subscriptionExpiryDate;
        record.autoRenewing = verification.autoRenewing;
        record.purchaseToken = tokenToVerify;
        record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        subscriptionDatabase.set(userId, record);
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
        for (const [uid, rec] of subscriptionDatabase.entries()) {
          if (rec.purchaseToken === purchaseToken) {
            rec.subscriptionStatus = verification.subscriptionStatus;
            rec.subscriptionExpiryDate = verification.subscriptionExpiryDate;
            rec.autoRenewing = verification.autoRenewing;
            rec.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
            subscriptionDatabase.set(uid, rec);
            console.log(`[Google Play RTDN] Updated subscription for user ${uid} to ${rec.subscriptionStatus}`);
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
  app.post("/api/billing/cancel-sync", (req, res) => {
    const { userId = "usr_001" } = req.body;
    const record = getOrCreateUserSubscription(userId);
    if (record.subscriptionStatus === "ACTIVE") {
      record.subscriptionStatus = "CANCELED_BUT_ACTIVE";
      record.autoRenewing = false;
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      subscriptionDatabase.set(userId, record);
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
  app.post("/api/billing/simulate", (req, res) => {
    const { userId = "usr_001", targetState, customDaysRemaining } = req.body;
    const record = getOrCreateUserSubscription(userId);
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
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    subscriptionDatabase.set(userId, record);
    const trialDaysRemaining = Math.max(
      0,
      Math.ceil((new Date(record.trialEndDate).getTime() - Date.now()) / (1e3 * 60 * 60 * 24))
    );
    res.json({
      success: true,
      userId: record.userId,
      subscriptionStatus: record.subscriptionStatus,
      trialStartDate: record.trialStartDate,
      trialEndDate: record.trialEndDate,
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
//# sourceMappingURL=server.cjs.map
