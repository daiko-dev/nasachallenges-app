import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldManifest } from '../types/spherex';
import { fetchField } from './fieldService';

const SAMPLE_MANIFEST: FieldManifest = {
  schemaVersion: '1.0',
  id: 'field-210.802-54.349',
  name: 'M101 Control Field',
  ra: 210.8023,
  dec: 54.349,
  fovDeg: 0.25,
  grid: { widthPx: 58, heightPx: 58, pixScaleArcsec: 6.2 },
  epochs: [
    {
      id: 'ep-1',
      obsId: 'spherex_dr1_001',
      utc: '2026-01-12T04:10:00Z',
      release: 'dr1',
      detector: 1,
      lambdaUm: 1.05,
      bandwidthUm: 0.03,
      frameUrl: 'https://example.org/ep1.png',
      sourceUrl: 'https://irsa.ipac.caltech.edu/ep1',
    },
  ],
  matchedPairs: [],
  candidates: [],
  message: null,
  provenance: {
    collection: 'spherex_dr1',
    retrievedUtc: '2026-02-01T00:00:00Z',
    synthetic: false,
    credit: 'SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive',
  },
};

describe('fieldService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns live manifest and caches it when API succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(SAMPLE_MANIFEST), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await fetchField(210.8023, 54.349, 0.25);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('live');
      expect(result.cachedNotice).toBe(false);
      expect(result.manifest.id).toBe('field-210.802-54.349');
    }
  });

  it('preserves empty-epochs manifest message from backend', async () => {
    const emptyManifest: FieldManifest = {
      ...SAMPLE_MANIFEST,
      epochs: [],
      message: 'No SPHEREx coverage in DR1/QR3 at this sky coordinate.',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(emptyManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await fetchField(10.5, -20.2, 0.25);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.epochs).toHaveLength(0);
      expect(result.manifest.message).toContain('No SPHEREx coverage');
    }
  });

  it('falls back to cached field when live API fails after prior success', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SAMPLE_MANIFEST), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockRejectedValueOnce(new Error('Connection refused'));

    await fetchField(210.8023, 54.349, 0.25);
    const fallbackResult = await fetchField(210.8023, 54.349, 0.25);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fallbackResult.ok).toBe(true);
    if (fallbackResult.ok) {
      expect(fallbackResult.source).toBe('cache');
      expect(fallbackResult.cachedNotice).toBe(true);
      expect(fallbackResult.manifest.name).toBe('M101 Control Field');
    }
  });

  it('returns structured FieldError when API fails without cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Gateway Timeout', { status: 504 })
    );

    const result = await fetchField(133.7867, -7.245, 0.25);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(504);
      expect(result.error.fallbackAvailable).toBe(false);
      expect(result.error.message).toContain('504');
    }
  });
});
