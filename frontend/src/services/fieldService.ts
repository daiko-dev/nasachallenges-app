import type { FieldError, FieldManifest } from '../types/spherex';

const DEFAULT_API_BASE = 'http://localhost:8000/api/v1';
const CACHE_PREFIX = 'svdv:field:';
const LATEST_KEY = 'svdv:field:latest';
const REQUEST_TIMEOUT_MS = 75000;

export interface FieldSuccessResult {
  ok: true;
  manifest: FieldManifest;
  source: 'live' | 'cache';
  cachedNotice: boolean;
}

export interface FieldFailureResult {
  ok: false;
  error: FieldError;
  latestCached: FieldManifest | null;
}

export type FieldResult = FieldSuccessResult | FieldFailureResult;

function coordKey(ra: number, dec: number): string {
  return `${CACHE_PREFIX}${ra.toFixed(3)}_${dec.toFixed(3)}`;
}

function isValidManifest(value: unknown): value is FieldManifest {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Partial<FieldManifest>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.ra === 'number' &&
    typeof obj.dec === 'number' &&
    Array.isArray(obj.epochs) &&
    Array.isArray(obj.candidates)
  );
}

function readCache(key: string): FieldManifest | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(ra: number, dec: number, manifest: FieldManifest): void {
  try {
    const serialized = JSON.stringify(manifest);
    window.localStorage.setItem(coordKey(ra, dec), serialized);
    window.localStorage.setItem(LATEST_KEY, serialized);
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function getLatestCachedField(): FieldManifest | null {
  return readCache(LATEST_KEY);
}

export async function fetchField(
  ra: number,
  dec: number,
  fovDeg: number,
  externalSignal?: AbortSignal
): Promise<FieldResult> {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
    DEFAULT_API_BASE;
  const url = `${apiBase}/field?ra=${encodeURIComponent(ra.toFixed(5))}&dec=${encodeURIComponent(
    dec.toFixed(5)
  )}&fov=${encodeURIComponent(fovDeg.toFixed(3))}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timeoutId);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let statusCode = 0;
  let errorDetail = 'Live backend unreachable; using precomputed demo cutouts';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    statusCode = response.status;

    if (response.ok) {
      const payload: unknown = await response.json();
      if (isValidManifest(payload)) {
        writeCache(ra, dec, payload);
        return {
          ok: true,
          manifest: payload,
          source: 'live',
          cachedNotice: false,
        };
      }
      errorDetail = 'Invalid FieldManifest payload returned by backend';
    } else {
      errorDetail = `Backend responded with HTTP ${response.status}`;
    }
  } catch (err) {
    if (externalSignal?.aborted) {
      throw err;
    }
    errorDetail =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out waiting for SPHEREx/IRSA backend'
        : err instanceof Error
          ? err.message
          : 'Network error contacting SPHEREx backend';
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }

  const exactCached = readCache(coordKey(ra, dec));
  if (exactCached) {
    return {
      ok: true,
      manifest: exactCached,
      source: 'cache',
      cachedNotice: true,
    };
  }

  const latestCached = readCache(LATEST_KEY);
  return {
    ok: false,
    error: {
      status: statusCode,
      message: errorDetail,
      fallbackAvailable: latestCached !== null,
    },
    latestCached,
  };
}
