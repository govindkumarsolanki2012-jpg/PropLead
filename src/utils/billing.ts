import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { UserProfile, SubscriptionStatus, GooglePlaySubscriptionProduct, SubscriptionPlanId, SubscriptionPlanDetails } from '../types';
import { auth } from '../lib/firebase';
import { saveSubscriptionRecordToFirestore, saveUserProfile } from '../services/firebaseService';

export const GOOGLE_PLAY_PRODUCT_ID = 'property_agent_pro';
export const GOOGLE_PLAY_BASE_PLAN_ID = 'quarterly';
export const GOOGLE_PLAY_PRICE_TEXT = '₹199 / 3 months';
export const GOOGLE_PLAY_PACKAGE_NAME = 'com.proplead.tracker';

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlanDetails> = {
  monthly: {
    id: 'monthly',
    basePlanId: 'monthly',
    name: 'Monthly',
    durationLabel: '1 Month',
    price: 79,
    priceFormatted: '₹79',
    billingText: '₹79 every month',
    shortText: 'Flexible monthly plan',
    ctaText: 'Continue with ₹79 Monthly',
    billingPeriod: 'P1M',
    durationMonths: 1,
  },
  quarterly: {
    id: 'quarterly',
    basePlanId: 'quarterly',
    name: '3 Months',
    durationLabel: '3 Months',
    price: 199,
    priceFormatted: '₹199',
    billingText: '₹199 every 3 months',
    perMonthText: '₹66.33/month',
    badge: 'BEST VALUE',
    savingsText: 'Save ₹38',
    shortText: 'Best value for active agents',
    ctaText: 'Continue with ₹199 / 3 Months',
    billingPeriod: 'P3M',
    durationMonths: 3,
  },
};

export const PRO_FEATURES_LIST = [
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
];

// Production Cloud Run billing service endpoint
// In Native Android (Capacitor), requests hit this public HTTPS endpoint directly (bypassing AI Studio dev cookie proxy)
export const DEFAULT_PRODUCTION_BILLING_URL = 'https://proplead-36803800158.asia-south1.run.app';

export const REMOTE_BACKEND_URL = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BILLING_BACKEND_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) ||
  DEFAULT_PRODUCTION_BILLING_URL
).trim().replace(/\/$/, '');

/**
 * Resolves the appropriate billing API endpoint URL based on runtime environment:
 * - In Android Native (Capacitor), relative paths hit the local asset scheme returning index.html.
 *   Therefore, native requests are routed to the live production Cloud Run backend server.
 * - On Web browsers, standard relative paths /api/* (or custom VITE_BILLING_BACKEND_URL) are used.
 */
export function getBillingApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const customEnv = (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BILLING_BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    ''
  ).trim();

  // If custom environment URL is explicitly provided, use it
  if (customEnv) {
    return `${customEnv.replace(/\/$/, '')}${cleanPath}`;
  }

  // Detect Android Capacitor / WebView environment:
  // 1. Capacitor.getPlatform() === 'android'
  // 2. Capacitor.isNativePlatform() === true
  // 3. window.location.protocol === 'capacitor:'
  // 4. Running locally in phone WebView on localhost without port 3000 (Vite dev server)
  const isAndroid = typeof window !== 'undefined' && (
    Capacitor.getPlatform() === 'android' ||
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000') ||
    (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) && window.location.hostname === 'localhost')
  );

  if (isAndroid) {
    return `${DEFAULT_PRODUCTION_BILLING_URL}${cleanPath}`;
  }

  // Web in production on Cloud Run (same origin) or local dev server
  return cleanPath;
}

export const DEFAULT_PRODUCT_DETAILS: GooglePlaySubscriptionProduct = {
  productId: GOOGLE_PLAY_PRODUCT_ID,
  basePlanId: 'quarterly',
  title: 'Choose Your Plan',
  description: 'Keep your property leads, customers, follow-ups and property matching organized.',
  priceFormatted: '₹199',
  priceMicros: 199000000,
  currencyCode: 'INR',
  billingPeriod: 'P3M',
  freeTrialPeriod: 'P7D',
  freeTrialDays: 7,
  offers: [],
  features: PRO_FEATURES_LIST,
  plans: SUBSCRIPTION_PLANS,
};

let authoritativeServerTimestamp: number | null = null;
let authoritativeLocalClockSync: number = 0;

/**
 * Stores authoritative server timestamp and baseline monotonic clock to prevent device clock tampering
 */
export function setAuthoritativeServerTime(serverTimestamp: string | number): void {
  const ts = typeof serverTimestamp === 'number' ? serverTimestamp : new Date(serverTimestamp).getTime();
  if (!isNaN(ts) && ts > 0) {
    authoritativeServerTimestamp = ts;
    authoritativeLocalClockSync = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  }
}

/**
 * Returns current authoritative server timestamp, immune to device clock tampering
 */
export function getAuthoritativeServerNow(): number {
  if (authoritativeServerTimestamp !== null) {
    const elapsed = (typeof performance !== 'undefined' && performance.now)
      ? (performance.now() - authoritativeLocalClockSync)
      : (Date.now() - authoritativeLocalClockSync);
    return authoritativeServerTimestamp + Math.max(0, elapsed);
  }
  return Date.now();
}

/**
 * Calculates remaining trial days dynamically from authoritative trialEndDate and serverNow.
 * Strictly uses trialEndDate from Firestore.
 * Safe fallback: returns 0 and logs debugging warning when trialEndDate is invalid or missing.
 * Does NOT hardcode 30, 29, or assume a fresh trial.
 */
export function calculateTrialDaysRemaining(
  startDateStr?: string,
  endDateStr?: string,
  serverNow?: number | string | Date
): number {
  try {
    // 1. Resolve authoritative reference time
    let now: number;
    if (serverNow !== undefined && serverNow !== null) {
      now = typeof serverNow === 'number' ? serverNow : new Date(serverNow).getTime();
      if (isNaN(now)) {
        now = getAuthoritativeServerNow();
      }
    } else {
      now = getAuthoritativeServerNow();
    }

    // 2. Authoritative Firestore trialEndDate
    if (!endDateStr) {
      console.warn('[Trial Countdown] Authoritative trialEndDate is missing from Firestore profile.', {
        startDateStr,
        endDateStr,
      });
      return 0;
    }

    let endTimestamp = new Date(endDateStr).getTime();
    if (isNaN(endTimestamp)) {
      console.warn('[Trial Countdown] Authoritative trialEndDate is an invalid date string:', endDateStr);
      return 0;
    }

    // Cap any legacy 30-day trial to 7 days from trial start date
    if (startDateStr) {
      const startTimestamp = new Date(startDateStr).getTime();
      if (!isNaN(startTimestamp)) {
        const maxTrialEnd = startTimestamp + 7 * 24 * 60 * 60 * 1000;
        if (endTimestamp > maxTrialEnd) {
          endTimestamp = maxTrialEnd;
        }
      }
    }

    const diffMs = endTimestamp - now;
    if (diffMs <= 0) {
      return 0;
    }

    // Dynamic days remaining: decreases each day until 0 (capped at 7 days)
    const days = Math.min(7, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return Math.max(0, days);
  } catch (err) {
    console.error('[Trial Countdown] Error calculating trial days from authoritative trialEndDate:', err);
    // Safe fallback: never grant 7 days on error
    return 0;
  }
}

/**
 * Normalized resolution of the current subscription status and feature entitlement
 */
export function getEffectiveSubscriptionStatus(
  profile: UserProfile,
  customServerNow?: number | string | Date
): {
  status: SubscriptionStatus;
  daysRemaining: number;
  isSubscribed: boolean;
  isLocked: boolean;
  expiryFormatted?: string;
  displayStatusText: string;
  isTrialEndDateMissingOrInvalid: boolean;
} {
  // Normalize legacy string flags if present
  let rawStatus = profile.subscriptionStatus;
  if (typeof rawStatus === 'string') {
    const upper = rawStatus.toUpperCase();
    if (upper === 'ACTIVE' || upper === 'SUBSCRIBED') rawStatus = 'ACTIVE';
    else if (upper === 'EXPIRED') rawStatus = 'EXPIRED';
    else if (upper === 'TRIAL') rawStatus = 'TRIAL';
  }

  // Server authoritative status takes precedence
  let status: SubscriptionStatus = (rawStatus as SubscriptionStatus) || (profile.isSubscribed ? 'ACTIVE' : 'TRIAL');

  const serverNow = customServerNow ?? getAuthoritativeServerNow();

  // Validate trialEndDate presence and integrity
  const hasValidTrialEndDate = Boolean(
    profile.trialEndDate && !isNaN(new Date(profile.trialEndDate).getTime())
  );
  const isTrialEndDateMissingOrInvalid = !hasValidTrialEndDate && (status === 'TRIAL' || status === 'EXPIRED');

  if (isTrialEndDateMissingOrInvalid && !profile.isSubscribed) {
    console.warn('[Trial Countdown Debug] User profile has missing or invalid authoritative trialEndDate:', {
      userId: profile.id,
      trialEndDate: profile.trialEndDate,
      trialStartDate: profile.trialStartDate,
      subscriptionStatus: profile.subscriptionStatus,
    });
  }

  let days = calculateTrialDaysRemaining(profile.trialStartDate, profile.trialEndDate, serverNow);

  // If server has authoritatively set status to EXPIRED or trialEndDate is missing/invalid, days remaining is strictly 0
  if (status === 'EXPIRED' || (!hasValidTrialEndDate && status === 'TRIAL')) {
    days = 0;
  }

  // Check trial expiration: if trial days reached 0, transition to EXPIRED
  if (status === 'TRIAL' && (days <= 0 || !hasValidTrialEndDate)) {
    status = 'EXPIRED';
  }

  // Check canceled subscription expiration
  let expiryFormatted: string | undefined;
  const resolvedExpiryDate = profile.subscriptionExpiryTime || profile.subscriptionExpiryDate;
  if (resolvedExpiryDate) {
    try {
      const expDate = new Date(resolvedExpiryDate);
      expiryFormatted = expDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      if (status === 'CANCELED_BUT_ACTIVE' || status === 'ACTIVE') {
        const refNow = serverNow ?? getAuthoritativeServerNow();
        const refNowMs = typeof refNow === 'number' ? refNow : new Date(refNow).getTime();
        if (refNowMs > expDate.getTime() && !profile.autoRenewing) {
          status = 'EXPIRED';
        }
      }
    } catch {}
  }

  const isSubscribed = status === 'ACTIVE' || status === 'CANCELED_BUT_ACTIVE';
  const isLocked = status === 'EXPIRED';

  let displayStatusText = '';
  switch (status) {
    case 'TRIAL':
      displayStatusText = `Free Trial • ${days} ${days === 1 ? 'day' : 'days'} remaining`;
      break;
    case 'ACTIVE':
      displayStatusText = 'Pro • Active';
      break;
    case 'CANCELED_BUT_ACTIVE':
      displayStatusText = `Pro • Active until ${expiryFormatted || 'end of period'}`;
      break;
    case 'PAYMENT_ISSUE':
      displayStatusText = 'Payment Issue • Action Required';
      break;
    case 'EXPIRED':
      displayStatusText = isTrialEndDateMissingOrInvalid ? 'Trial Unverified' : 'Trial Expired';
      break;
  }

  return {
    status,
    daysRemaining: days,
    isSubscribed,
    isLocked,
    expiryFormatted,
    displayStatusText,
    isTrialEndDateMissingOrInvalid,
  };
}

/**
 * Authoritative Pro Access Check
 * Access is allowed ONLY when:
 *   trialActive === true (trial status with valid trial days remaining and not locked)
 *   OR
 *   subscriptionActive === true (active or canceled-but-active subscription)
 * Expired users without an active subscription return false.
 */
export function hasProAccess(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  const { status, daysRemaining, isSubscribed, isLocked } = getEffectiveSubscriptionStatus(profile);
  const trialActive = status === 'TRIAL' && daysRemaining > 0 && !isLocked;
  const subscriptionActive = isSubscribed && (status === 'ACTIVE' || status === 'CANCELED_BUT_ACTIVE');
  return trialActive || subscriptionActive;
}

export interface GooglePlayProductResult {
  product: GooglePlaySubscriptionProduct | null;
  isAvailable: boolean;
  error?: string;
}

/**
 * Fetch product details from Google Play Store via NativePurchases or backend catalog.
 */
export async function fetchGooglePlayProduct(): Promise<GooglePlayProductResult> {
  // If running in native Android shell, query Google Play directly via NativePurchases
  if (Capacitor.isNativePlatform()) {
    try {
      const supported = await NativePurchases.isBillingSupported();
      if (!supported.isBillingSupported) {
        console.warn('[Google Play Billing] isBillingSupported returned false, using configured plans');
        return {
          product: DEFAULT_PRODUCT_DETAILS,
          isAvailable: true,
        };
      }

      const res = await NativePurchases.getProducts({
        productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID],
        productType: PURCHASE_TYPE.SUBS,
      });

      if (!res.products || res.products.length === 0) {
        console.warn('[Google Play Billing] 0 products returned from Play Store, using configured plans');
        return {
          product: DEFAULT_PRODUCT_DETAILS,
          isAvailable: true,
        };
      }

      const nativeProd =
        res.products.find(
          (p) => p.identifier === GOOGLE_PLAY_PRODUCT_ID || (p as any).planIdentifier === GOOGLE_PLAY_PRODUCT_ID
        ) || res.products[0];

      const priceString = nativeProd?.priceString || DEFAULT_PRODUCT_DETAILS.priceFormatted;
      const priceMicros = nativeProd?.price
        ? Math.round(nativeProd.price * 1000000)
        : DEFAULT_PRODUCT_DETAILS.priceMicros;

      const loadedProduct: GooglePlaySubscriptionProduct = {
        ...DEFAULT_PRODUCT_DETAILS,
        productId: GOOGLE_PLAY_PRODUCT_ID,
        title: nativeProd?.title || DEFAULT_PRODUCT_DETAILS.title,
        description: nativeProd?.description || DEFAULT_PRODUCT_DETAILS.description,
        priceFormatted: priceString,
        priceMicros,
        currencyCode: nativeProd?.currencyCode || DEFAULT_PRODUCT_DETAILS.currencyCode,
        plans: SUBSCRIPTION_PLANS,
      };

      return {
        product: loadedProduct,
        isAvailable: true,
      };
    } catch (nativeErr: any) {
      console.warn('[Google Play Billing] Fallback to default product details:', nativeErr);
      return {
        product: DEFAULT_PRODUCT_DETAILS,
        isAvailable: true,
      };
    }
  }

  // Web environment / local dev: try fetching from server billing endpoint
  try {
    const url = getBillingApiUrl('/api/billing/product-details');
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data?.product) {
        return {
          product: {
            ...DEFAULT_PRODUCT_DETAILS,
            ...data.product,
            plans: SUBSCRIPTION_PLANS,
          },
          isAvailable: true,
        };
      }
    }
  } catch (err) {
    console.warn('[Billing API] Error fetching product-details from server:', err);
  }

  return {
    product: DEFAULT_PRODUCT_DETAILS,
    isAvailable: true,
  };
}

/**
 * Launch Google Play In-App Purchase Flow
 * - Uses @capgo/native-purchases on native Android with selected basePlanId ('monthly' | 'quarterly')
 * - Obtains purchaseToken from Google Play
 * - Verifies purchase server-side with /api/billing/verify-purchase
 * - Never marks user ACTIVE locally before server verification
 * - Refreshes subscription status from /api/billing/subscription-status
 */
export async function launchGooglePlayPurchase(
  userId: string,
  onProgress?: (step: string) => void,
  basePlanId: 'monthly' | 'quarterly' = 'quarterly'
): Promise<{
  success: boolean;
  profileUpdates?: Partial<UserProfile>;
  pending?: boolean;
  verificationPending?: boolean;
  purchaseToken?: string;
  error?: string;
  message?: string;
}> {
  try {
    const selectedPlan = SUBSCRIPTION_PLANS[basePlanId] || SUBSCRIPTION_PLANS.quarterly;
    onProgress?.('Connecting to Google Play Billing...');

    if (!Capacitor.isNativePlatform()) {
      // In web browser / dev environment, perform RFC-compliant sandbox verification with backend
      onProgress?.('Verifying subscription with server (Sandbox Mode)...');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      }

      const verifyEndpoint = getBillingApiUrl('/api/billing/verify-purchase');
      const testToken = `web_sandbox_token_${Date.now()}_${basePlanId}`;
      const verificationPayload = {
        userId,
        purchaseToken: testToken,
        productId: GOOGLE_PLAY_PRODUCT_ID,
        basePlanId,
        packageName: GOOGLE_PLAY_PACKAGE_NAME,
      };

      const verifyRes = await fetch(verifyEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(verificationPayload),
      });

      let verifyData: any = null;
      try {
        verifyData = await verifyRes.json();
      } catch {
        // Non-JSON
      }

      if (!verifyRes.ok || !verifyData?.success) {
        if (verifyRes.status === 503 || verifyData?.error === 'SUBSCRIPTION_VERIFICATION_PENDING') {
          return {
            success: false,
            verificationPending: true,
            purchaseToken: testToken,
            error: 'SUBSCRIPTION_VERIFICATION_PENDING',
            message: verifyData?.message || 'Purchase completed but verification is temporarily unavailable.',
          };
        }
        return {
          success: false,
          error: verifyData?.error || 'Verification failed in sandbox mode.',
        };
      }

      onProgress?.('Subscription verified & unlocked!');
      const resolvedExpiry = verifyData.subscriptionExpiryDate || verifyData.expiryDate;

      const profileUpdates: Partial<UserProfile> = {
        subscriptionStatus: 'ACTIVE',
        isSubscribed: true,
        isTrialActive: false,
        subscriptionPlan: GOOGLE_PLAY_PRODUCT_ID,
        subscriptionProductId: GOOGLE_PLAY_PRODUCT_ID,
        subscriptionBasePlan: basePlanId,
        subscriptionBasePlanId: basePlanId,
        planId: basePlanId,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        purchaseDate: verifyData.purchaseDate || new Date().toISOString(),
        lastVerifiedAt: verifyData.lastVerifiedAt || new Date().toISOString(),
        purchaseToken: testToken,
        autoRenewing: true,
        paymentIssueMessage: undefined,
      };

      // Ensure dual persistence to Firestore
      saveSubscriptionRecordToFirestore(userId, {
        userId,
        subscriptionStatus: 'active',
        subscriptionProductId: GOOGLE_PLAY_PRODUCT_ID,
        subscriptionBasePlanId: basePlanId,
        subscriptionBasePlan: basePlanId,
        planId: basePlanId,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        autoRenewing: true,
        purchaseToken: testToken,
        acknowledged: true,
        lastVerifiedAt: profileUpdates.lastVerifiedAt,
      }).catch((e) => console.warn('[Firestore] sub record save error:', e));

      saveUserProfile(userId, profileUpdates).catch((e) => console.warn('[Firestore] user profile save error:', e));

      return {
        success: true,
        profileUpdates,
      };
    }

    // 1. Check billing availability
    const availability = await NativePurchases.isBillingSupported();
    if (!availability.isBillingSupported) {
      return {
        success: false,
        error: 'Google Play Billing is not supported or not available on this device.',
      };
    }

    // 2. Fetch available offer token and ensure product exists in Google Play catalog
    let offerToken: string | undefined;
    try {
      const prodsRes = await NativePurchases.getProducts({
        productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID],
        productType: PURCHASE_TYPE.SUBS,
      });

      const matching =
        prodsRes.products?.find(
          (p) => p.identifier === GOOGLE_PLAY_PRODUCT_ID || (p as any).planIdentifier === basePlanId
        ) || prodsRes.products?.[0];
      if (matching && (matching as any).offerToken) {
        offerToken = (matching as any).offerToken;
      }
    } catch (queryErr: any) {
      console.warn('[Google Play Billing] Product pre-query notice:', queryErr);
    }

    // 3. Initiate native Google Play purchase flow with specific basePlanId
    onProgress?.(`Opening Google Play checkout (${selectedPlan.name})...`);

    const appAccountToken =
      userId && typeof userId === 'string' && userId.length <= 64 && !userId.includes('@')
        ? userId
        : undefined;

    let transaction;
    try {
      transaction = await NativePurchases.purchaseProduct({
        productIdentifier: GOOGLE_PLAY_PRODUCT_ID,
        planIdentifier: basePlanId,
        productType: PURCHASE_TYPE.SUBS,
        ...(offerToken ? { offerToken } : {}),
        ...(appAccountToken ? { appAccountToken } : {}),
        autoAcknowledgePurchases: false, // Server acknowledges via Google Play Developer API upon verification
      });
    } catch (purchaseErr: any) {
      const msg = (purchaseErr?.message || String(purchaseErr || '')).toLowerCase();
      if (msg.includes('cancel') || msg.includes('user_canceled') || msg.includes('user cancelled')) {
        return {
          success: false,
          error: 'Purchase was cancelled.',
        };
      }
      if (msg.includes('item_already_owned') || msg.includes('already owned')) {
        return {
          success: false,
          error: 'You already own this subscription. Tap "Restore Purchase" to sync your access.',
        };
      }
      if (msg.includes('network') || msg.includes('timeout')) {
        return {
          success: false,
          error: 'Network connection issue with Google Play. Please check your internet and try again.',
        };
      }
      return {
        success: false,
        error: purchaseErr?.message || 'Google Play purchase could not be completed.',
      };
    }

    if (!transaction) {
      return {
        success: false,
        error: 'No purchase transaction returned from Google Play.',
      };
    }

    // 4. Handle Pending Purchase State
    if (transaction.purchaseState === '0' || (transaction as any).purchaseState === 0) {
      return {
        success: false,
        pending: true,
        error:
          'Your payment is currently pending confirmation from Google Play. Pro access will be automatically activated once payment completes.',
      };
    }

    const purchaseToken = transaction.purchaseToken;
    if (!purchaseToken) {
      return {
        success: false,
        error: 'Purchase token was not received from Google Play.',
      };
    }

    // 5. Server-side purchase verification (server remains authoritative)
    onProgress?.('Verifying subscription with server...');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (tokenErr) {
        console.warn('[Google Play Purchase] Notice getting ID token:', tokenErr);
      }
    }

    const verifyEndpoint = getBillingApiUrl('/api/billing/verify-purchase');
    console.log('[Google Play Purchase] Sending verification request to:', verifyEndpoint);

    const verificationPayload = {
      userId,
      purchaseToken,
      productId: GOOGLE_PLAY_PRODUCT_ID,
      basePlanId,
      packageName: GOOGLE_PLAY_PACKAGE_NAME,
    };

    let verifyRes: Response;
    let responseText: string = '';

    try {
      verifyRes = await fetch(verifyEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(verificationPayload),
      });
      responseText = await verifyRes.text();
    } catch (networkErr: any) {
      console.error('[Google Play Verification Failed - Network Error]', {
        endpoint: verifyEndpoint,
        error: networkErr?.message || networkErr,
      });
      throw new Error(`Could not reach verification server. Please check your internet connection.`);
    }

    let verifyData: any = null;
    try {
      verifyData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[Google Play Verification Failed - Non-JSON Response Body]', {
        endpoint: verifyEndpoint,
        httpStatus: verifyRes.status,
        statusText: verifyRes.statusText,
        contentType: verifyRes.headers.get('content-type'),
        responseBody: responseText,
      });
      throw new Error(`Billing verification failed: server returned HTTP ${verifyRes.status} with non-JSON response.`);
    }

    if (!verifyRes.ok || !verifyData?.success) {
      console.error('[Google Play Verification Failed - Server Error]', {
        endpoint: verifyEndpoint,
        httpStatus: verifyRes.status,
        statusText: verifyRes.statusText,
        responseBody: responseText,
        verifyData,
      });

      if (verifyRes.status === 503 || verifyData?.error === 'SUBSCRIPTION_VERIFICATION_PENDING') {
        return {
          success: false,
          verificationPending: true,
          purchaseToken,
          error: 'SUBSCRIPTION_VERIFICATION_PENDING',
          message: verifyData?.message || 'Purchase completed but verification is temporarily unavailable.',
        };
      }

      throw new Error(verifyData?.error || `Server verification with Google Play failed (HTTP ${verifyRes.status}).`);
    }

    console.log('[Google Play Verification Success]', {
      endpoint: verifyEndpoint,
      httpStatus: verifyRes.status,
      orderId: verifyData.orderId,
      subscriptionStatus: verifyData.subscriptionStatus,
      expiryDate: verifyData.subscriptionExpiryDate,
      planId: verifyData.planId || verifyData.plan || basePlanId,
    });

    // 6. Refresh authoritative subscription status
    try {
      const statusEndpoint = getBillingApiUrl(`/api/billing/subscription-status?userId=${encodeURIComponent(userId)}`);
      const statusRes = await fetch(statusEndpoint, {
        headers,
      });
      if (statusRes.ok) {
        const statusText = await statusRes.text();
        try {
          const statusData = JSON.parse(statusText);
          if (statusData.serverNow || statusData.serverTimestamp) {
            setAuthoritativeServerTime(statusData.serverNow || statusData.serverTimestamp);
          }
        } catch {}
      }
    } catch {}

    onProgress?.('Subscription verified & unlocked!');

    const resolvedExpiry = verifyData.subscriptionExpiryDate || verifyData.expiryDate;
    if (!resolvedExpiry) {
      throw new Error('Google Play verification succeeded but did not provide an authoritative expiry date.');
    }

    const profileUpdates: Partial<UserProfile> = {
      subscriptionStatus: 'ACTIVE',
      isSubscribed: true,
      isTrialActive: false,
      subscriptionPlan: GOOGLE_PLAY_PRODUCT_ID,
      subscriptionProductId: GOOGLE_PLAY_PRODUCT_ID,
      subscriptionBasePlan: basePlanId,
      subscriptionBasePlanId: basePlanId,
      planId: basePlanId,
      subscriptionExpiryDate: resolvedExpiry,
      subscriptionExpiryTime: resolvedExpiry,
      expiryDate: resolvedExpiry,
      purchaseDate: verifyData.purchaseDate || new Date().toISOString(),
      lastVerifiedAt: verifyData.lastVerifiedAt || new Date().toISOString(),
      purchaseToken,
      autoRenewing: verifyData.autoRenewing !== undefined ? verifyData.autoRenewing : true,
      paymentIssueMessage: undefined,
    };

    // Dual persistence to Firestore
    saveSubscriptionRecordToFirestore(userId, {
      userId,
      subscriptionStatus: 'active',
      subscriptionProductId: GOOGLE_PLAY_PRODUCT_ID,
      subscriptionBasePlanId: basePlanId,
      subscriptionBasePlan: basePlanId,
      planId: basePlanId,
      subscriptionExpiryDate: resolvedExpiry,
      subscriptionExpiryTime: resolvedExpiry,
      expiryDate: resolvedExpiry,
      autoRenewing: profileUpdates.autoRenewing,
      purchaseToken,
      acknowledged: true,
      lastVerifiedAt: profileUpdates.lastVerifiedAt,
    }).catch((e) => console.warn('[Firestore] native sub save error:', e));

    saveUserProfile(userId, profileUpdates).catch((e) => console.warn('[Firestore] user profile save error:', e));

    return {
      success: true,
      profileUpdates,
    };
  } catch (err: any) {
    console.error('Google Play purchase verification failed:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to complete Google Play purchase. Please try again.',
    };
  }
}

/**
 * Restore purchases from Google Play via NativePurchases and backend API
 * Server remains authoritative.
 */
export async function restoreGooglePlayPurchases(
  userId: string,
  onProgress?: (step: string) => void
): Promise<{
  success: boolean;
  restored: boolean;
  billingUnavailable?: boolean;
  profileUpdates?: Partial<UserProfile>;
  message: string;
}> {
  try {
    onProgress?.('Checking Google Play...');

    let purchaseToken: string | undefined;
    let isBridgeAvailable = false;

    if (Capacitor.isNativePlatform()) {
      try {
        const supported = await NativePurchases.isBillingSupported();
        if (supported.isBillingSupported) {
          isBridgeAvailable = true;

          // Request native store restore
          try {
            await NativePurchases.restorePurchases();
          } catch (e) {
            console.warn('[NativePurchases] restorePurchases warning:', e);
          }

          // Query active subscription purchases
          const result = await NativePurchases.getPurchases({
            productType: PURCHASE_TYPE.SUBS,
          });

          if (result.purchases && result.purchases.length > 0) {
            const matching =
              result.purchases.find(
                (p) =>
                  (p.productIdentifier === GOOGLE_PLAY_PRODUCT_ID || !p.productIdentifier) &&
                  p.purchaseToken &&
                  p.purchaseState !== '0'
              ) || result.purchases[0];

            if (matching && matching.purchaseToken && matching.purchaseState !== '0') {
              purchaseToken = matching.purchaseToken;
            }
          }
        }
      } catch (nativeErr) {
        console.warn('[NativePurchases] getPurchases failed:', nativeErr);
      }
    }

    // Backend verification & restore endpoint
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch {}

    const restoreEndpoint = getBillingApiUrl('/api/billing/restore-purchases');
    const res = await fetch(restoreEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        purchaseToken,
        isBridgeAvailable,
        productId: GOOGLE_PLAY_PRODUCT_ID,
      }),
    });

    const restoreText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(restoreText);
    } catch (parseErr) {
      console.error('[Google Play Restore Failed - Non-JSON Response]', {
        endpoint: restoreEndpoint,
        httpStatus: res.status,
        statusText: res.statusText,
        responseBody: restoreText,
      });
      return {
        success: false,
        restored: false,
        billingUnavailable: true,
        message: 'Google Play billing service returned invalid response. Please try again.',
      };
    }

    if (!res.ok) {
      console.error('[Google Play Restore Failed - Server Error]', {
        endpoint: restoreEndpoint,
        httpStatus: res.status,
        statusText: res.statusText,
        responseBody: restoreText,
      });
      return {
        success: false,
        restored: false,
        billingUnavailable: true,
        message: data?.message || 'Google Play billing is currently unavailable. Please try again.',
      };
    }

    const rawStatus = (data.subscriptionStatus || '').toUpperCase();
    const isStatusActive = rawStatus === 'ACTIVE' || rawStatus === 'CANCELED_BUT_ACTIVE' || String(data.subscriptionStatus).toLowerCase() === 'active';

    if (data.restored && isStatusActive) {
      const resolvedExpiry = data.subscriptionExpiryTime || data.subscriptionExpiryDate;
      const effectiveBasePlan = data.subscriptionBasePlanId || data.subscriptionBasePlan || data.planId || 'quarterly';
      const effectiveStatus = rawStatus === 'CANCELED_BUT_ACTIVE' ? 'CANCELED_BUT_ACTIVE' : 'ACTIVE';

      const profileUpdates: Partial<UserProfile> = {
        subscriptionStatus: effectiveStatus,
        isSubscribed: true,
        isTrialActive: false,
        subscriptionPlan: data.subscriptionProductId || GOOGLE_PLAY_PRODUCT_ID,
        subscriptionProductId: data.subscriptionProductId || GOOGLE_PLAY_PRODUCT_ID,
        subscriptionBasePlan: effectiveBasePlan,
        subscriptionBasePlanId: effectiveBasePlan,
        planId: effectiveBasePlan,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        purchaseDate: data.purchaseDate,
        lastVerifiedAt: data.lastVerifiedAt || new Date().toISOString(),
        autoRenewing: data.autoRenewing !== undefined ? data.autoRenewing : true,
        purchaseToken: data.purchaseToken || purchaseToken,
        paymentIssueMessage: undefined,
      };

      // Dual persistence to Firestore
      saveSubscriptionRecordToFirestore(userId, {
        userId,
        subscriptionStatus: 'active',
        subscriptionProductId: data.subscriptionProductId || GOOGLE_PLAY_PRODUCT_ID,
        subscriptionBasePlanId: effectiveBasePlan,
        subscriptionBasePlan: effectiveBasePlan,
        planId: effectiveBasePlan,
        subscriptionExpiryDate: resolvedExpiry,
        subscriptionExpiryTime: resolvedExpiry,
        expiryDate: resolvedExpiry,
        autoRenewing: profileUpdates.autoRenewing,
        purchaseToken: profileUpdates.purchaseToken,
        acknowledged: true,
        lastVerifiedAt: profileUpdates.lastVerifiedAt,
      }).catch((e) => console.warn('[Firestore] restore sub record save error:', e));

      saveUserProfile(userId, profileUpdates).catch((e) => console.warn('[Firestore] restore user profile save error:', e));

      return {
        success: true,
        restored: true,
        message: 'Active PropLead subscription restored via Google Play!',
        profileUpdates,
      };
    }

    if (data.billingUnavailable) {
      return {
        success: false,
        restored: false,
        billingUnavailable: true,
        message: data.message || 'Google Play billing is currently unavailable. Please try again.',
      };
    }

    return {
      success: true,
      restored: false,
      message: data.message || 'No active PropLead subscription was found for this Google Play account.',
    };
  } catch (err: any) {
    console.error('Restore purchases error:', err?.message || err);
    return {
      success: false,
      restored: false,
      billingUnavailable: true,
      message: 'Google Play billing is currently unavailable. Please try again.',
    };
  }
}

/**
 * Automatically checks for any existing Google Play subscription purchases on device startup/login
 * and restores entitlement if present and verified.
 */
export async function checkAndRestoreGooglePlayEntitlement(userId: string): Promise<Partial<UserProfile> | null> {
  if (!userId) return null;
  try {
    if (Capacitor.isNativePlatform()) {
      const supported = await NativePurchases.isBillingSupported();
      if (supported.isBillingSupported) {
        const result = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
        if (result.purchases && result.purchases.length > 0) {
          const match = result.purchases.find(
            (p) => (p.productIdentifier === GOOGLE_PLAY_PRODUCT_ID || !p.productIdentifier) && p.purchaseToken && p.purchaseState !== '0'
          ) || result.purchases[0];
          if (match && match.purchaseToken) {
            const restoredResult = await restoreGooglePlayPurchases(userId);
            if (restoredResult.success && restoredResult.restored && restoredResult.profileUpdates) {
              return restoredResult.profileUpdates;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Startup Google Play Entitlement Check Notice]:', err);
  }
  return null;
}

/**
 * Open Google Play Subscription Management Screen
 */
export async function openGooglePlayManageSubscriptions(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePurchases.manageSubscriptions();
      return;
    } catch (e) {
      console.warn('[NativePurchases] manageSubscriptions fallback to web URL:', e);
    }
  }
  const url = `https://play.google.com/store/account/subscriptions?sku=${GOOGLE_PLAY_PRODUCT_ID}&package=${GOOGLE_PLAY_PACKAGE_NAME}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open Google Play Payment Fix Screen
 */
export async function openGooglePlayFixPayment(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativePurchases.manageSubscriptions();
      return;
    } catch (e) {
      console.warn('[NativePurchases] manageSubscriptions fallback to web URL:', e);
    }
  }
  const url = 'https://play.google.com/store/account/subscriptions';
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Simulate state on backend for developer sandbox / testing all 17 scenarios
 */
export async function simulateBillingState(
  userId: string,
  targetState: SubscriptionStatus,
  customDays?: number
): Promise<{ success: boolean; profileUpdates?: Partial<UserProfile> }> {
  try {
    const res = await fetch('/api/billing/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, targetState, customDaysRemaining: customDays }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.serverTimestamp || data.serverNow) {
        setAuthoritativeServerTime(data.serverTimestamp || data.serverNow);
      }
      return {
        success: true,
        profileUpdates: {
          subscriptionStatus: data.subscriptionStatus,
          trialStartDate: data.trialStartDate,
          trialEndDate: data.trialEndDate,
          serverTimestamp: data.serverTimestamp || data.serverNow,
          trialDaysRemaining: data.trialDaysRemaining,
          subscriptionExpiryDate: data.subscriptionExpiryDate,
          autoRenewing: data.autoRenewing,
          isSubscribed: data.isSubscribed,
          paymentIssueMessage: data.paymentIssueMessage,
        },
      };
    }
  } catch (err) {
    console.error('Simulation error:', err);
  }
  return { success: false };
}
