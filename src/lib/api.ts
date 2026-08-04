import { Capacitor } from '@capacitor/core';

// Default production/shared server URL for Capacitor APK mobile apps to connect to the backend
const DEFAULT_SERVER_URL = "https://ais-pre-j4os3vmz2eepnq6k2ymqpv-469255650912.asia-southeast1.run.app";

/**
 * Returns a fully qualified API endpoint URL.
 * On Web: Returns relative path `/api/...`
 * On Mobile (Capacitor APK): Prepends the backend server URL so mobile requests reach the Cloud Run database.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (Capacitor.isNativePlatform()) {
    const customUrl = (import.meta as any).env?.VITE_SERVER_URL;
    const baseUrl = customUrl && customUrl.trim() !== '' ? customUrl.trim() : DEFAULT_SERVER_URL;
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}${cleanPath}`;
  }
  
  return cleanPath;
}

/**
 * Wrapper for fetch that automatically handles API routing across Web and Mobile Native (Capacitor).
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  return fetch(url, options);
}
