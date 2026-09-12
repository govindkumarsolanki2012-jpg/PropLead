import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
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
  if (rawStatus === 'subscribed') rawStatus = 'ACTIVE';
  if (rawStatus === 'expired') rawStatus = 'EXPIRED';

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
 * Fetch product details from Google Play Catalog API or Native Google Play Client
 */
export async function fetchGooglePlayProduct(): Promise<GooglePlaySubscriptionProduct> {
  // If running in native Android shell, query Google Play directly via NativePurchases
  if (Capacitor.isNativePlatform()) {
    try {
      const supported = await NativePurchases.isBillingSupported();
      if (supported.isBillingSupported) {
        const res = await NativePurchases.getProducts({
          productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID],
          productType: PURCHASE_TYPE.SUBS,
        });

        if (res.products && res.products.length > 0) {
          const nativeProd =
            res.products.find(
              (p) => p.identifier === GOOGLE_PLAY_PRODUCT_ID || (p as any).planIdentifier === GOOGLE_PLAY_PRODUCT_ID
            ) || res.products[0];

          if (nativeProd) {
            const priceString = nativeProd.priceString || DEFAULT_PRODUCT_DETAILS.priceFormatted;
            const priceMicros = nativeProd.price
              ? Math.round(nativeProd.price * 1000000)
              : DEFAULT_PRODUCT_DETAILS.priceMicros;
            const offerToken = (nativeProd as any).offerToken || undefined;

            return {
              ...DEFAULT_PRODUCT_DETAILS,
              productId: GOOGLE_PLAY_PRODUCT_ID,
              basePlanId: GOOGLE_PLAY_BASE_PLAN_ID,
              title: nativeProd.title || DEFAULT_PRODUCT_DETAILS.title,
              description: nativeProd.description || DEFAULT_PRODUCT_DETAILS.description,
              priceFormatted: priceString,
              priceMicros,
              currencyCode: nativeProd.currencyCode || DEFAULT_PRODUCT_DETAILS.currencyCode,
              offers: offerToken
                ? [
                    {
                      offerId: GOOGLE_PLAY_BASE_PLAN_ID,
                      offerToken,
                      pricingPhases: [
                        {
                          priceFormatted: priceString,
                          priceMicros,
                          billingPeriod: 'P1M',
                          recurrenceMode: 1,
                          billingCycleCount: 0,
                        },
                      ],
                    },
                  ]
                : DEFAULT_PRODUCT_DETAILS.offers,
            };
          }
        }
      }
    } catch (nativeErr) {
      console.warn('[NativePurchases] Could not query store product details, falling back to server catalog:', nativeErr);
    }
  }

  // Fallback to server-side product-details endpoint
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
 * - Uses @capgo/native-purchases on native Android
 * - Obtains purchaseToken from Google Play
 * - Verifies purchase server-side with /api/billing/verify-purchase
 * - Never marks user ACTIVE locally before server verification
 * - Refreshes subscription status from /api/billing/subscription-status
 */
export async function launchGooglePlayPurchase(
  userId: string,
  onProgress?: (step: string) => void
): Promise<{ success: boolean; profileUpdates?: Partial<UserProfile>; pending?: boolean; error?: string }> {
  try {
    onProgress?.('Connecting to Google Play Billing...');

    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        error: 'Google Play Billing is only available on Android. Please install and run the app on an Android device to subscribe.',
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

    // 2. Fetch available offer token if available
    let offerToken: string | undefined;
    try {
      const prodsRes = await NativePurchases.getProducts({
        productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID],
        productType: PURCHASE_TYPE.SUBS,
      });
      const matching =
        prodsRes.products?.find(
          (p) => p.identifier === GOOGLE_PLAY_PRODUCT_ID || (p as any).planIdentifier === GOOGLE_PLAY_PRODUCT_ID
        ) || prodsRes.products?.[0];
      if (matching && (matching as any).offerToken) {
        offerToken = (matching as any).offerToken;
      }
    } catch {
      // offerToken is optional if base plan has a single offer
    }

    // 3. Initiate native Google Play purchase flow
    onProgress?.('Opening Google Play checkout...');

    const appAccountToken =
      userId && typeof userId === 'string' && userId.length <= 64 && !userId.includes('@')
        ? userId
        : undefined;

    let transaction;
    try {
      transaction = await NativePurchases.purchaseProduct({
        productIdentifier: GOOGLE_PLAY_PRODUCT_ID,
        planIdentifier: GOOGLE_PLAY_BASE_PLAN_ID,
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
          error: 'You already own this subscription. Tap "Restore Subscription" to sync your access.',
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
      throw new Error(verifyData.error || 'Server verification with Google Play failed.');
    }

    if (!verifyData.subscriptionExpiryDate) {
      throw new Error('Google Play verification response did not include a valid subscription expiry timestamp.');
    }

    // 6. Refresh authoritative subscription status
    try {
      const statusRes = await fetch(`/api/billing/subscription-status?userId=${encodeURIComponent(userId)}`, {
        headers,
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.serverNow || statusData.serverTimestamp) {
          setAuthoritativeServerTime(statusData.serverNow || statusData.serverTimestamp);
        }
      }
    } catch {}

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
        subscriptionExpiryDate: verifyData.subscriptionExpiryDate,
        purchaseToken,
        autoRenewing: verifyData.autoRenewing !== undefined ? verifyData.autoRenewing : true,
        paymentIssueMessage: undefined,
      },
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
