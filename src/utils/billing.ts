import { Capacitor } from '@capacitor/core';
import { UserProfile, SubscriptionStatus, GooglePlaySubscriptionProduct } from '../types';
import { auth } from '../lib/firebase';

export const GOOGLE_PLAY_PRODUCT_ID = 'property_agent_pro';
export const GOOGLE_PLAY_BASE_PLAN_ID = 'monthly';
export const GOOGLE_PLAY_PRICE_TEXT = '₹49/month';
export const GOOGLE_PLAY_PACKAGE_NAME = 'com.proplead.tracker';

export const DEFAULT_PRODUCT_DETAILS: GooglePlaySubscriptionProduct = {
  productId: GOOGLE_PLAY_PRODUCT_ID,
  basePlanId: GOOGLE_PLAY_BASE_PLAN_ID,
  title: 'Property Agent Pro',
  description: 'Keep your property leads, customers, follow-ups and property matching organized.',
  priceFormatted: '₹49/month',
  priceMicros: 49000000,
  currencyCode: 'INR',
  billingPeriod: 'P1M',
  freeTrialPeriod: 'P30D',
  freeTrialDays: 30,
  offers: [
    {
      offerId: '30-day-free-trial',
      offerToken: 'offer_token_30d_trial_monthly',
      pricingPhases: [
        {
          priceFormatted: '₹0 for 30 days',
          priceMicros: 0,
          billingPeriod: 'P30D',
          recurrenceMode: 2,
          billingCycleCount: 1,
        },
        {
          priceFormatted: '₹49/month',
          priceMicros: 49000000,
          billingPeriod: 'P1M',
          recurrenceMode: 1,
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
 * Safe fallback: returns 0 when trialEndDate is invalid or missing.
 * Does NOT assume a fresh 30-day trial.
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

    // 2. Resolve end timestamp from authoritative trialEndDate
    let endTimestamp: number;
    if (endDateStr) {
      endTimestamp = new Date(endDateStr).getTime();
    } else if (startDateStr) {
      const start = new Date(startDateStr).getTime();
      endTimestamp = start + 30 * 24 * 60 * 60 * 1000;
    } else {
      // Safe fallback: missing dates, return 0 (never grant 30 days)
      return 0;
    }

    if (isNaN(endTimestamp)) {
      // Safe fallback: invalid timestamp, return 0 (never grant 30 days)
      return 0;
    }

    const diffMs = endTimestamp - now;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  } catch (err) {
    console.error('Error calculating trial days:', err);
    // Safe fallback: never grant 30 days on error
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
} {
  // Normalize legacy string flags if present
  let rawStatus = profile.subscriptionStatus;
  if (rawStatus === 'subscribed') rawStatus = 'ACTIVE';
  if (rawStatus === 'expired') rawStatus = 'EXPIRED';

  // Server authoritative status takes precedence
  let status: SubscriptionStatus = (rawStatus as SubscriptionStatus) || (profile.isSubscribed ? 'ACTIVE' : 'TRIAL');

  const serverNow = customServerNow ?? (profile.serverTimestamp ? new Date(profile.serverTimestamp).getTime() : undefined);
  let days = calculateTrialDaysRemaining(profile.trialStartDate, profile.trialEndDate, serverNow);

  // If server has authoritatively set status to EXPIRED, days remaining is strictly 0
  if (status === 'EXPIRED') {
    days = 0;
  }

  // Check trial expiration: if trial days reached 0, transition to EXPIRED
  if (status === 'TRIAL' && days <= 0) {
    status = 'EXPIRED';
  }

  // Check canceled subscription expiration
  let expiryFormatted: string | undefined;
  if (profile.subscriptionExpiryDate) {
    try {
      const expDate = new Date(profile.subscriptionExpiryDate);
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
      displayStatusText = 'Trial Expired';
      break;
  }

  return {
    status,
    daysRemaining: days,
    isSubscribed,
    isLocked,
    expiryFormatted,
    displayStatusText,
  };
}

/**
 * Fetch product details from Google Play Catalog API
 */
export async function fetchGooglePlayProduct(): Promise<GooglePlaySubscriptionProduct> {
  try {
    const res = await fetch('/api/billing/product-details');
    if (res.ok) {
      const data = await res.json();
      if (data.product) {
        return data.product;
      }
    }
  } catch (err) {
    console.warn('Using default Google Play product details:', err);
  }
  return DEFAULT_PRODUCT_DETAILS;
}

/**
 * Launch Google Play In-App Purchase Flow
 * - Interacts with Android Digital Goods API if in TWA / Android PWA
 * - Interacts with Android native bridge if embedded
 * - Initiates secure purchase and verification with backend
 */
export async function launchGooglePlayPurchase(
  userId: string,
  onProgress?: (step: string) => void
): Promise<{ success: boolean; profileUpdates?: Partial<UserProfile>; error?: string }> {
  try {
    onProgress?.('Connecting to Google Play Billing...');

    let purchaseToken: string | undefined;

    // Check for Android Digital Goods API (Google Play Billing on Chrome Android / PWA / TWA)
    if (typeof window !== 'undefined' && 'getDigitalGoodsService' in window) {
      try {
        const service = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
        if (service) {
          onProgress?.('Requesting offer from Google Play...');
          const details = await service.getDetails([GOOGLE_PLAY_PRODUCT_ID]);
          console.log('[DigitalGoodsService] Details:', details);
        }
      } catch (e) {
        console.log('[DigitalGoodsService] Fallback to direct billing flow:', e);
      }
    }

    // Check for Native Android Javascript Interface (if app is packaged in Android WebView / Capacitor)
    if (typeof window !== 'undefined' && (window as any).AndroidBilling) {
      try {
        const nativeRes = await (window as any).AndroidBilling.launchBillingFlow(
          GOOGLE_PLAY_PRODUCT_ID,
          GOOGLE_PLAY_BASE_PLAN_ID
        );
        if (nativeRes) {
          const parsed = typeof nativeRes === 'string' ? JSON.parse(nativeRes) : nativeRes;
          purchaseToken = parsed.purchaseToken;
        }
      } catch (e) {
        console.log('[AndroidBilling Native Bridge] fallback:', e);
      }
    }

    // Standard Google Play Transaction Token Handling
    if (!purchaseToken) {
      if (Capacitor.isNativePlatform()) {
        // Do not use mock purchases in production Android shell
        return {
          success: false,
          error: 'Google Play Billing native bridge is not installed in this Android build. To enable live Google Play purchases, install @capacitor-community/in-app-purchases.',
        };
      }
      // Web / Dev sandbox environment fallback
      const timestamp = Date.now();
      const randomEntropy = Math.random().toString(36).substring(2, 15);
      purchaseToken = `play_tok_${timestamp}_${randomEntropy}_property_agent_pro`;
    }

    onProgress?.('Verifying subscription with Google Play Developer API...');

    // Backend verification endpoint with user auth token
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch {}

    const verifyRes = await fetch('/api/billing/verify-purchase', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        purchaseToken,
        productId: GOOGLE_PLAY_PRODUCT_ID,
        basePlanId: GOOGLE_PLAY_BASE_PLAN_ID,
      }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(verifyData.error || 'Backend verification with Google Play failed');
    }

    if (!verifyData.subscriptionExpiryDate) {
      throw new Error('Google Play verification response did not include a valid subscription expiry timestamp');
    }

    onProgress?.('Subscription verified & unlocked!');

    return {
      success: true,
      profileUpdates: {
        subscriptionStatus: verifyData.subscriptionStatus || 'ACTIVE',
        isSubscribed: true,
        isTrialActive: false,
        subscriptionPlan: GOOGLE_PLAY_PRODUCT_ID,
        subscriptionProductId: GOOGLE_PLAY_PRODUCT_ID,
        subscriptionBasePlan: GOOGLE_PLAY_BASE_PLAN_ID,
        subscriptionExpiryDate: verifyData.subscriptionExpiryDate, // Authoritative timestamp from Google Play
        purchaseToken,
        autoRenewing: verifyData.autoRenewing !== undefined ? verifyData.autoRenewing : true,
        paymentIssueMessage: undefined,
      },
    };
  } catch (err: any) {
    console.error('Google Play purchase failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to complete Google Play purchase. Please try again.',
    };
  }
}

/**
 * Restore purchases from Google Play via native Android bridge and backend API
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

    // 1. Check Native Android Javascript Interface (Android WebView / Capacitor / Cordova)
    if (typeof window !== 'undefined' && (window as any).AndroidBilling) {
      isBridgeAvailable = true;
      try {
        const bridge = (window as any).AndroidBilling;
        let nativeRes: any;
        if (typeof bridge.restorePurchases === 'function') {
          nativeRes = await bridge.restorePurchases(GOOGLE_PLAY_PRODUCT_ID);
        } else if (typeof bridge.queryPurchases === 'function') {
          nativeRes = await bridge.queryPurchases(GOOGLE_PLAY_PRODUCT_ID);
        } else if (typeof bridge.getPurchases === 'function') {
          nativeRes = await bridge.getPurchases();
        } else if (typeof bridge.getPurchaseToken === 'function') {
          nativeRes = await bridge.getPurchaseToken(GOOGLE_PLAY_PRODUCT_ID);
        }

        if (nativeRes) {
          if (typeof nativeRes === 'string') {
            try {
              const parsed = JSON.parse(nativeRes);
              purchaseToken =
                parsed.purchaseToken ||
                (parsed.purchases && parsed.purchases[0]?.purchaseToken) ||
                (Array.isArray(parsed) && parsed[0]?.purchaseToken);
            } catch {
              if (nativeRes.startsWith('play_tok_') || nativeRes.length > 10) {
                purchaseToken = nativeRes;
              }
            }
          } else if (typeof nativeRes === 'object') {
            purchaseToken =
              nativeRes.purchaseToken ||
              (nativeRes.purchases && nativeRes.purchases[0]?.purchaseToken) ||
              (Array.isArray(nativeRes) && nativeRes[0]?.purchaseToken);
          }
        }
      } catch (bridgeErr) {
        console.warn('[AndroidBilling Native Bridge] restore error:', bridgeErr);
      }
    }

    // 2. Check Digital Goods API (Chrome Android / PWA / TWA)
    if (!purchaseToken && typeof window !== 'undefined' && 'getDigitalGoodsService' in window) {
      try {
        const service = await (window as any).getDigitalGoodsService('https://play.google.com/billing');
        if (service) {
          isBridgeAvailable = true;
          let purchases: any[] = [];
          if (typeof service.listPurchases === 'function') {
            purchases = await service.listPurchases();
          } else if (typeof service.listPurchaseHistory === 'function') {
            purchases = await service.listPurchaseHistory();
          }
          if (purchases && purchases.length > 0) {
            const matching =
              purchases.find(
                (p: any) => p.itemId === GOOGLE_PLAY_PRODUCT_ID || p.productId === GOOGLE_PLAY_PRODUCT_ID
              ) || purchases[0];
            if (matching && matching.purchaseToken) {
              purchaseToken = matching.purchaseToken;
            }
          }
        }
      } catch (dgErr) {
        console.warn('[DigitalGoodsService] list purchases:', dgErr);
      }
    }

    // 3. Query backend verification & restore endpoint
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch {}

    const res = await fetch('/api/billing/restore-purchases', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        purchaseToken,
        isBridgeAvailable,
        productId: GOOGLE_PLAY_PRODUCT_ID,
      }),
    });

    if (!res.ok) {
      return {
        success: false,
        restored: false,
        billingUnavailable: true,
        message: 'Google Play billing is currently unavailable. Please try again.',
      };
    }

    const data = await res.json();

    if (data.restored && (data.subscriptionStatus === 'ACTIVE' || data.subscriptionStatus === 'CANCELED_BUT_ACTIVE')) {
      return {
        success: true,
        restored: true,
        message: 'Active PropLead subscription restored via Google Play!',
        profileUpdates: {
          subscriptionStatus: data.subscriptionStatus,
          isSubscribed: true,
          isTrialActive: false,
          subscriptionExpiryDate: data.subscriptionExpiryDate,
          subscriptionProductId: data.subscriptionProductId || GOOGLE_PLAY_PRODUCT_ID,
          autoRenewing: data.autoRenewing !== undefined ? data.autoRenewing : true,
          purchaseToken: data.purchaseToken || purchaseToken,
          paymentIssueMessage: undefined,
        },
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
  } catch (err) {
    console.error('Restore purchases error:', err);
    return {
      success: false,
      restored: false,
      billingUnavailable: true,
      message: 'Google Play billing is currently unavailable. Please try again.',
    };
  }
}

/**
 * Open Google Play Subscription Management Screen
 */
export function openGooglePlayManageSubscriptions(): void {
  const url = `https://play.google.com/store/account/subscriptions?sku=${GOOGLE_PLAY_PRODUCT_ID}&package=${GOOGLE_PLAY_PACKAGE_NAME}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Open Google Play Payment Fix Screen
 */
export function openGooglePlayFixPayment(): void {
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
