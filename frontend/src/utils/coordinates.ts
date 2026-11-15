import type { ViewState } from '../types/spherex';

export const DEFAULT_VIEW: ViewState = {
  ra: 210.8023,
  dec: 54.349,
  fovDeg: 0.25,
};

export function normalizeRa(raDeg: number): number {
  const mod = raDeg % 360;
  return mod < 0 ? mod + 360 : mod;
}

function parseSexagesimalRa(hStr: string, mStr: string, sStr: string): number | null {
  const h = Number(hStr);
  const m = Number(mStr);
  const s = Number(sStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (h < 0 || h >= 24 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  return (h + m / 60 + s / 3600) * 15;
}

function parseSexagesimalDec(dStr: string, mStr: string, sStr: string): number | null {
  const sign = dStr.trim().startsWith('-') ? -1 : 1;
  const d = Math.abs(Number(dStr));
  const m = Number(mStr);
  const s = Number(sStr);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (d > 90 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  const val = sign * (d + m / 60 + s / 3600);
  return val < -90 || val > 90 ? null : val;
}

export function parseCoords(raw: string): { ra: number; dec: number } | null {
  const input = raw.trim();
  if (!input) return null;

  // Sexagesimal with h/m/s and d/m/s or colon separators:
  // e.g. "13h 03m 31s +54d 20m 56s" or "13:03:31 -54:20:56"
  const sexaMatch = input.match(
    /^(\d{1,2})[h:\s]+(\d{1,2})[m:\s]+(\d{1,2}(?:\.\d+)?)s?[\s,]+([+-]?\d{1,2})[d°:\s]+(\d{1,2})[m':\s]+(\d{1,2}(?:\.\d+)?)[s"]?$/i
  );
  if (sexaMatch) {
    const ra = parseSexagesimalRa(sexaMatch[1], sexaMatch[2], sexaMatch[3]);
    const dec = parseSexagesimalDec(sexaMatch[4], sexaMatch[5], sexaMatch[6]);
    if (ra === null || dec === null) return null;
    return { ra: Number(normalizeRa(ra).toFixed(6)), dec: Number(dec.toFixed(6)) };
  }

  // Decimal format: "210.80 54.35" or "210.80, +54.35"
  const decMatch = input.match(/^([+-]?\d+(?:\.\d+)?)[\s,]+([+-]?\d+(?:\.\d+)?)$/);
  if (decMatch) {
    const raRaw = Number(decMatch[1]);
    const dec = Number(decMatch[2]);
    if (!Number.isFinite(raRaw) || !Number.isFinite(dec)) return null;
    if (dec < -90 || dec > 90) return null;
    return { ra: Number(normalizeRa(raRaw).toFixed(6)), dec: Number(dec.toFixed(6)) };
  }

  return null;
}

export function parseView(search: string): ViewState {
  const params = new URLSearchParams(search);
  const raParam = params.get('ra');
  const decParam = params.get('dec');
  const fovParam = params.get('fov');

  const ra = raParam !== null && raParam !== '' ? Number(raParam) : NaN;
  const dec = decParam !== null && decParam !== '' ? Number(decParam) : NaN;
  const fov = fovParam !== null && fovParam !== '' ? Number(fovParam) : NaN;

  const validCoords = Number.isFinite(ra) && Number.isFinite(dec) && dec >= -90 && dec <= 90;
  const validFov = Number.isFinite(fov) && fov > 0 && fov <= 180;

  return {
    ra: validCoords ? normalizeRa(ra) : DEFAULT_VIEW.ra,
    dec: validCoords ? dec : DEFAULT_VIEW.dec,
    fovDeg: validFov ? fov : DEFAULT_VIEW.fovDeg,
  };
}

export function formatView(view: ViewState): string {
  const params = new URLSearchParams();
  params.set('ra', normalizeRa(view.ra).toFixed(4));
  params.set('dec', view.dec.toFixed(4));
  params.set('fov', view.fovDeg.toFixed(2));
  return `?${params.toString()}`;
}
