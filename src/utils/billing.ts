import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { UserProfile, SubscriptionStatus, GooglePlaySubscriptionProduct, SubscriptionPlanId, SubscriptionPlanDetails } from '../types';
import { auth } from '../lib/firebase';

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
    console.warn('[Trial Countdown] Error calculating trial days from authoritative trialEndDate:', err);
    // Safe fallback: never grant 7 days on error
    return 0;
  }
}

/**
 * Formats server trialEndDate into a human-readable string in user's local timezone.
 * Example: "Ends on 30 September 2026 at 4:15 PM"
 */
export function formatTrialEndDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `Ends on ${day} at ${time}`;
  } catch {
    return '';
  }
}

export function maskToken(token?: string | null): string {
  if (!token) return 'NONE';
  if (token.length <= 8) return '***';
  return `...${token.slice(-6)}`;
}

/**
 * Normalized resolution of the current subscription status and feature entitlement
 */
export function getEffectiveSubscriptionStatus(
  profile: UserProfile,
  customServerNow?: number | string | Date
): {
  status: SubscriptionStatus;
  trialStatus: 'not_started' | 'active' | 'expired';
  trialEverStarted: boolean;
  daysRemaining: number;
  isSubscribed: boolean;
  isLocked: boolean;
  expiryFormatted?: string;
  displayStatusText: string;
  isTrialEndDateMissingOrInvalid: boolean;
} {
  // Normalize legacy string flags if present
  let rawStatus: SubscriptionStatus | string | undefined = profile.subscriptionStatus;
  if (typeof rawStatus === 'string') {
    const upper = rawStatus.toUpperCase();
    if (upper === 'ACTIVE' || upper === 'SUBSCRIBED') rawStatus = 'ACTIVE';
    else if (upper === 'EXPIRED') rawStatus = 'EXPIRED';
    else if (upper === 'TRIAL') rawStatus = 'TRIAL';
    else if (upper === 'NOT_STARTED') rawStatus = 'NOT_STARTED';
    else if (upper === 'PAYMENT_ISSUE') rawStatus = 'PAYMENT_ISSUE';
    else if (upper === 'CANCELED_BUT_ACTIVE') rawStatus = 'CANCELED_BUT_ACTIVE';
  }

  const serverNow = customServerNow ?? getAuthoritativeServerNow();

  // 1. Paid Subscription status takes precedence
  let isSubscribed = Boolean(profile.isSubscribed);
  let status: SubscriptionStatus = (rawStatus as SubscriptionStatus) || (isSubscribed ? 'ACTIVE' : 'NOT_STARTED');

  let expiryFormatted: string | undefined;
  const resolvedExpiryDate = profile.subscriptionExpiryTime || profile.subscriptionExpiryDate;
  if (status === 'CANCELED_BUT_ACTIVE' || status === 'ACTIVE') {
    if (!resolvedExpiryDate) {
      status = 'EXPIRED';
      isSubscribed = false;
    } else {
      try {
        const expDate = new Date(resolvedExpiryDate);
        const expTimeMs = expDate.getTime();
        if (isNaN(expTimeMs)) {
          status = 'EXPIRED';
          isSubscribed = false;
        } else {
          expiryFormatted = expDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const refNow = serverNow ?? getAuthoritativeServerNow();
          const refNowMs = typeof refNow === 'number' ? refNow : new Date(refNow).getTime();
          if (refNowMs > expTimeMs) {
            status = 'EXPIRED';
            isSubscribed = false;
          } else {
            isSubscribed = true;
          }
        }
      } catch {
        status = 'EXPIRED';
        isSubscribed = false;
      }
    }
  } else if (status === 'PAYMENT_ISSUE') {
    // Bugs 5 & 6: PAYMENT_ISSUE Access Policy
    // If PAYMENT_ISSUE has a verified future expiry:
    // - keep Pro access during the grace period (isSubscribed = true)
    // - status remains PAYMENT_ISSUE
    // If expiry has passed:
    // - remove Pro access (isSubscribed = false, status = 'EXPIRED')
    if (!resolvedExpiryDate) {
      status = 'EXPIRED';
      isSubscribed = false;
    } else {
      try {
        const expDate = new Date(resolvedExpiryDate);
        const expTimeMs = expDate.getTime();
        if (isNaN(expTimeMs)) {
          status = 'EXPIRED';
          isSubscribed = false;
        } else {
          expiryFormatted = expDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const refNow = serverNow ?? getAuthoritativeServerNow();
          const refNowMs = typeof refNow === 'number' ? refNow : new Date(refNow).getTime();
          if (refNowMs > expTimeMs) {
            status = 'EXPIRED';
            isSubscribed = false;
          } else {
            status = 'PAYMENT_ISSUE';
            isSubscribed = true;
          }
        }
      } catch {
        status = 'EXPIRED';
        isSubscribed = false;
      }
    }
  } else if (resolvedExpiryDate) {
    try {
      const expDate = new Date(resolvedExpiryDate);
      if (!isNaN(expDate.getTime())) {
        expiryFormatted = expDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {}
  }

  // 2. Evaluate Trial Status
  const trialEverStarted = Boolean(
    profile.trialEverStarted ||
    (profile.trialStartDate && profile.trialStartDate !== 'null') ||
    (profile.trialEndDate && profile.trialEndDate !== 'null') ||
    rawStatus === 'TRIAL' ||
    rawStatus === 'EXPIRED'
  );

  let trialStatus: 'not_started' | 'active' | 'expired' = 'not_started';
  let days = 0;
  let isTrialEndDateMissingOrInvalid = false;

  // Bug 12: Paid subscription overrides trial state. If paid subscription is active, Pro comes from paid subscription.
  if (isSubscribed && (status === 'ACTIVE' || status === 'CANCELED_BUT_ACTIVE' || status === 'PAYMENT_ISSUE')) {
    trialStatus = trialEverStarted ? 'expired' : 'not_started';
  } else if (!trialEverStarted && (profile.trialStatus === 'not_started' || !profile.trialStatus)) {
    trialStatus = 'not_started';
    status = 'NOT_STARTED';
    days = 0;
  } else {
    // Trial was started or active or expired
    const hasValidTrialEndDate = Boolean(
      profile.trialEndDate && !isNaN(new Date(profile.trialEndDate).getTime())
    );
    isTrialEndDateMissingOrInvalid = !hasValidTrialEndDate;

    days = calculateTrialDaysRemaining(profile.trialStartDate, profile.trialEndDate, serverNow);

    if (days > 0 && hasValidTrialEndDate && profile.trialStatus !== 'expired') {
      trialStatus = 'active';
      status = 'TRIAL';
    } else {
      trialStatus = 'expired';
      status = 'EXPIRED';
      days = 0;
    }
  }

  const isLocked = status === 'EXPIRED';

  let displayStatusText = '';
  switch (status) {
    case 'NOT_STARTED':
      displayStatusText = 'Free Trial Available';
      break;
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
      displayStatusText = isSubscribed
        ? `Payment Issue • Grace Period until ${expiryFormatted || 'end of period'}`
        : 'Payment Issue • Action Required';
      break;
    case 'EXPIRED':
      displayStatusText = 'Trial Expired';
      break;
  }

  return {
    status,
    trialStatus,
    trialEverStarted,
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
 *   subscriptionActive === true (active, canceled-but-active, or payment-issue with future expiry)
 * Expired users without an active subscription return false.
 */
export function hasProAccess(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  const { status, daysRemaining, isSubscribed, isLocked } = getEffectiveSubscriptionStatus(profile);
  const trialActive = status === 'TRIAL' && daysRemaining > 0 && !isLocked;
  // Bug 6: PAYMENT_ISSUE with future verified expiry maintains Pro access during grace period
  const subscriptionActive = isSubscribed && (status === 'ACTIVE' || status === 'CANCELED_BUT_ACTIVE' || status === 'PAYMENT_ISSUE');
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

    // 2. Fetch available offer token strictly matching basePlanId ('monthly' | 'quarterly')
    // Bug 4 Fix: monthly -> use only the offer token whose planIdentifier/basePlanId is monthly
    // quarterly -> use only the offer token whose planIdentifier/basePlanId is quarterly
    // Do NOT fall back to another base plan or to products[0].
    let offerToken: string | undefined;
    try {
      const prodsRes = await NativePurchases.getProducts({
        productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID],
        productType: PURCHASE_TYPE.SUBS,
      });

      const allProducts = prodsRes.products || [];
      console.log(`[Google Play Billing] Querying products for base plan "${basePlanId}". Found ${allProducts.length} product(s).`);

      for (const p of allProducts) {
        const prod = p as any;
        if (prod.planIdentifier === basePlanId || prod.basePlanId === basePlanId) {
          if (prod.offerToken) {
            offerToken = prod.offerToken;
            break;
          }
        }
        if (Array.isArray(prod.subscriptionOfferDetails)) {
          const matchOffer = prod.subscriptionOfferDetails.find((o: any) => o.basePlanId === basePlanId);
          if (matchOffer?.offerToken) {
            offerToken = matchOffer.offerToken;
            break;
          }
        }
      }
    } catch (queryErr: any) {
      console.warn('[Google Play Billing] Product pre-query notice:', queryErr);
    }

    // Bug 4: If no matching offer token exists for the requested base plan, stop purchase and show a clear error
    if (!offerToken) {
      console.warn(`[Google Play Billing] No matching offer token found for base plan "${basePlanId}". Stopping purchase.`);
      return {
        success: false,
        error: `OFFER_TOKEN_NOT_FOUND: No Google Play offer found for base plan ${basePlanId}`,
        message: `Unable to find the Google Play offer for the ${selectedPlan.name}. Please ensure your Play Store app is updated and try again.`,
      };
    }

    console.log(`[Google Play Billing] Selected offer token for base plan "${basePlanId}". Token present: YES`);

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
      console.warn('[Google Play Verification Notice - Network Error]', {
        endpoint: verifyEndpoint,
        error: networkErr?.message || networkErr,
      });
      throw new Error(`Could not reach verification server. Please check your internet connection.`);
    }

    let verifyData: any = null;
    try {
      verifyData = JSON.parse(responseText);
    } catch (parseErr) {
      console.warn('[Google Play Verification Notice - Non-JSON Response Body]', {
        endpoint: verifyEndpoint,
        httpStatus: verifyRes.status,
        statusText: verifyRes.statusText,
        contentType: verifyRes.headers.get('content-type'),
        responseBody: responseText,
      });
      throw new Error(`Billing verification failed: server returned HTTP ${verifyRes.status} with non-JSON response.`);
    }

    if (!verifyRes.ok || !verifyData?.success) {
      console.warn('[Google Play Verification Notice - Server Response]', {
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

    return {
      success: true,
      profileUpdates,
    };
  } catch (err: any) {
    console.warn('Google Play purchase verification notice:', err?.message || err);
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
      console.warn('[Google Play Restore Notice - Non-JSON Response]', {
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
      console.warn('[Google Play Restore Notice - Server Response]', {
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
    const resolvedExpiry = data.subscriptionExpiryTime || data.subscriptionExpiryDate;
    const isFutureExpiry = resolvedExpiry ? new Date(resolvedExpiry).getTime() > Date.now() : false;

    // Bug 10: Support ACTIVE, CANCELED_BUT_ACTIVE, and PAYMENT_ISSUE with future expiry
    const isStatusActive =
      rawStatus === 'ACTIVE' ||
      rawStatus === 'CANCELED_BUT_ACTIVE' ||
      (rawStatus === 'PAYMENT_ISSUE' && isFutureExpiry);

    if (data.restored && isStatusActive) {
      // Bug 10: Do NOT default to quarterly if base plan is unknown
      const effectiveBasePlan = data.subscriptionBasePlanId || data.subscriptionBasePlan || data.planId || data.basePlanId;
      const effectiveStatus: SubscriptionStatus =
        rawStatus === 'CANCELED_BUT_ACTIVE'
          ? 'CANCELED_BUT_ACTIVE'
          : (rawStatus === 'PAYMENT_ISSUE' ? 'PAYMENT_ISSUE' : 'ACTIVE');

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
        paymentIssueMessage: effectiveStatus === 'PAYMENT_ISSUE' ? data.paymentIssueMessage || 'Payment issue with Google Play subscription. Please update your payment method.' : undefined,
      };

      return {
        success: true,
        restored: true,
        message: effectiveStatus === 'PAYMENT_ISSUE'
          ? 'Subscription restored with active grace period!'
          : 'Active PropLead subscription restored via Google Play!',
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
    console.warn('Restore purchases notice:', err?.message || err);
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

export interface StartTrialResult {
  success: boolean;
  trialStatus?: 'active';
  trialStartDate?: string;
  trialEndDate?: string;
  trialEverStarted?: boolean;
  serverNow?: string;
  error?: string;
  message?: string;
}

/**
 * Manually activate 7-day free trial on the backend server.
 * Backend verifies eligibility (authenticated, trialEverStarted is false, no active subscription)
 * and sets server-authoritative timestamps.
 */
export async function startFreeTrialServer(userId: string): Promise<StartTrialResult> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }
    const idToken = await currentUser.getIdToken(true);
    const endpoint = getBillingApiUrl('/api/billing/start-trial');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to activate trial',
        message: data.message || 'Unable to start trial at this time. Please try again.',
      };
    }

    if (data.serverNow || data.serverTimestamp) {
      setAuthoritativeServerTime(data.serverNow || data.serverTimestamp);
    }

    return {
      success: true,
      trialStatus: data.trialStatus,
      trialStartDate: data.trialStartDate,
      trialEndDate: data.trialEndDate,
      trialEverStarted: data.trialEverStarted,
      serverNow: data.serverNow,
    };
  } catch (err: any) {
    console.warn('[Billing] startFreeTrialServer notice:', err?.message || err);
    return {
      success: false,
      error: err?.message || 'Network error starting trial',
      message: 'Network error communicating with billing server.',
    };
  }
}

