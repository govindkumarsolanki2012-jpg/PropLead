/**
 * Android Phone Number Hint & Phone Utilities
 * 
 * Supports automatic mobile number suggestion on Android using standard
 * Android autofill hints (autoComplete="tel tel-national", inputMode="tel")
 * and modern Web Credentials / Credential Manager phone identity queries
 * where supported by the Android device / Google Play Services.
 * 
 * Complies with strict privacy & security requirements:
 * 1. Never assumes SIM number is available.
 * 2. Never fabricates a phone number.
 * 3. Never automatically authenticates a user merely because a number was detected.
 * 4. User must still complete Firebase Phone Authentication OTP verification.
 * 5. Works seamlessly on devices where Android cannot provide a number.
 */

export function cleanIndianMobileNumber(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  // Remove country code +91 or 91 if prepended
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidIndianMobile(digits: string): boolean {
  if (!digits) return false;
  const cleaned = cleanIndianMobileNumber(digits);
  // Standard Indian 10-digit mobile number starting with 6, 7, 8, 9, or standard 10 digits
  return cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned);
}

export function formatE164IndianPhone(digits: string): string {
  const cleaned = cleanIndianMobileNumber(digits);
  return `+91${cleaned}`;
}

export function formatPhoneWithSpaces(digits: string): string {
  const cleaned = cleanIndianMobileNumber(digits);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
}

/**
 * Attempts to retrieve a phone number suggestion from Android.
 * Returns the 10-digit string if available, or null if Android cannot provide it.
 */
export async function requestAndroidPhoneNumberSuggestion(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check if running on Android environment
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (!isAndroid) {
      // Non-Android platforms rely on manual entry or standard browser autofill
      return null;
    }

    // 2. Attempt Google Android Credential Manager / Digital Identity / WebOTP hint if supported
    if ('credentials' in navigator && navigator.credentials && typeof (navigator.credentials as any).get === 'function') {
      const abortController = new AbortController();
      // Cap at 1500ms to guarantee zero UI lag
      const timeoutId = setTimeout(() => {
        try {
          abortController.abort();
        } catch (e) {
          // ignore
        }
      }, 1500);

      try {
        // Query phone hint identity query if supported by Android Chrome/WebView
        const credential = await (navigator.credentials as any).get({
          signal: abortController.signal,
          otp: { transport: ['sms'] },
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (credential && typeof credential === 'object') {
          const rawId = (credential as any).id || (credential as any).phone || '';
          if (rawId) {
            const cleaned = cleanIndianMobileNumber(rawId);
            if (isValidIndianMobile(cleaned)) {
              return cleaned;
            }
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        // Hint API not supported or user dismissed hint popup - fall back silently
      }
    }
  } catch (outerErr) {
    // Graceful fallback: never throw or block
    console.debug('Android phone hint query unavailable:', outerErr);
  }

  return null;
}
