import { Capacitor } from '@capacitor/core';

export const PRIMARY_DEV_SERVER_URL = "https://ais-dev-j4os3vmz2eepnq6k2ymqpv-469255650912.asia-southeast1.run.app";
export const SHARED_PREVIEW_SERVER_URL = "https://ais-pre-j4os3vmz2eepnq6k2ymqpv-469255650912.asia-southeast1.run.app";

/**
 * Gets the active server base URL stored in localStorage or default
 */
export function getActiveServerBaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem("app_active_server_url");
    if (saved && saved.trim() !== '') {
      return saved.trim();
    }
  }
  return PRIMARY_DEV_SERVER_URL;
}

/**
 * Sets the active server base URL in localStorage
 */
export function setActiveServerBaseUrl(url: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem("app_active_server_url", url.trim());
  }
}

/**
 * Returns a fully qualified API endpoint URL.
 * Supports absolute base override or active configured server URL for cross-environment sync.
 */
export function getApiUrl(path: string, overrideBase?: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (overrideBase) {
    return `${overrideBase.replace(/\/+$/, '')}${cleanPath}`;
  }

  // Check user-configured override from local settings
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem("app_active_server_url");
    if (saved && saved.trim() !== '') {
      return `${saved.trim().replace(/\/+$/, '')}${cleanPath}`;
    }
  }

  if (Capacitor.isNativePlatform()) {
    const customUrl = (import.meta as any).env?.VITE_SERVER_URL;
    const baseUrl = customUrl && customUrl.trim() !== '' ? customUrl.trim() : PRIMARY_DEV_SERVER_URL;
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}${cleanPath}`;
  }
  
  return cleanPath;
}

/**
 * Wrapper for fetch that automatically handles API routing across Web and Mobile Native (Capacitor)
 * with automatic fallback to preview URL if primary server is unreachable.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  try {
    return await fetch(url, options);
  } catch (err) {
    if (Capacitor.isNativePlatform()) {
      const fallbackUrl = getApiUrl(path, SHARED_PREVIEW_SERVER_URL);
      console.warn(`[apiFetch] Primary fetch failed for ${url}, trying fallback ${fallbackUrl}...`);
      return fetch(fallbackUrl, options);
    }
    throw err;
  }
}

/**
 * Safely fetches an API endpoint and parses JSON without throwing SyntaxError or NetworkError.
 * Returns { ok: boolean, status: number, data: T | null, error?: string }
 */
export async function safeJsonFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await apiFetch(path, options);
    const contentType = res.headers.get("content-type") || "";

    let data: any = null;
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: "Invalid JSON response from server"
        };
      }
    } else {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        data: null,
        error: res.ok ? "Server returned non-JSON response" : `Server HTTP ${res.status}: ${text.slice(0, 100)}`
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.error || data?.message || `HTTP ${res.status} error`
      };
    }

    return {
      ok: true,
      status: res.status,
      data
    };
  } catch (netErr: any) {
    console.warn(`[safeJsonFetch] Network/fetch error for [${path}]:`, netErr);
    return {
      ok: false,
      status: 0,
      data: null,
      error: netErr?.message || "Network connection error"
    };
  }
}

