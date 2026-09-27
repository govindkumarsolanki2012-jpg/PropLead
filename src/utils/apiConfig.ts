import { Capacitor } from '@capacitor/core';

/**
 * Production Cloud Run backend base URL for PropLead.
 */
export const PRODUCTION_API_BASE_URL = 'https://proplead-36803800158.asia-south1.run.app';

/**
 * Resolves the appropriate backend API base URL based on runtime environment.
 * - In AI Studio preview (*.run.app with ais-dev/ais-pre), Android Capacitor, or external web origins:
 *   Routes requests directly to the deployed Cloud Run production backend.
 * - In production when served from the Cloud Run container itself on the same origin:
 *   Uses relative path ('').
 */
export function getApiBaseUrl(): string {
  // 1. Check custom environment variable overrides
  if (typeof import.meta !== 'undefined') {
    const envUrl =
      (import.meta as any).env?.VITE_BACKEND_URL ||
      (import.meta as any).env?.VITE_BILLING_BACKEND_URL ||
      (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/$/, '');
    }
  }

  // 2. Check window location in browser
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || '';

    // If running inside Capacitor native app or local asset scheme, use absolute Cloud Run URL
    if (Capacitor.isNativePlatform() || protocol === 'capacitor:' || protocol === 'file:') {
      return PRODUCTION_API_BASE_URL;
    }

    // When running in web browser (production Cloud Run, custom domain, AI Studio preview, or local dev server),
    // the Express backend is co-hosted on the same origin.
    return '';
  }

  return PRODUCTION_API_BASE_URL;
}

/**
 * Returns the fully-qualified backend API endpoint URL for a given relative path.
 * Example: getBackendApiUrl('/api/storage/upload')
 */
export function getBackendApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
}

/**
 * Safely extracts host name from an endpoint URL for non-sensitive diagnostics logging.
 */
export function getApiUrlHost(endpointUrl: string): string {
  try {
    if (endpointUrl.startsWith('http')) {
      return new URL(endpointUrl).host;
    }
    if (typeof window !== 'undefined' && window.location.host) {
      return window.location.host;
    }
    return 'proplead-36803800158.asia-south1.run.app';
  } catch {
    return 'proplead-36803800158.asia-south1.run.app';
  }
}
