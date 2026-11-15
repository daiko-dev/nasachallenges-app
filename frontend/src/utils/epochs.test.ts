import { describe, expect, it } from 'vitest';
import type { FieldManifest } from '../types/spherex';
import { lambdaBadge, sortedEpochs } from './epochs';

const sampleManifest: FieldManifest = {
  schemaVersion: '1.0',
  id: 'test-field',
  name: 'Test Field',
  ra: 210.8,
  dec: 54.3,
  fovDeg: 0.1,
  grid: { widthPx: 58, heightPx: 58, pixScaleArcsec: 6.2 },
  epochs: [
    {
      id: 'e03',
      obsId: 'OBS3',
      utc: '2026-08-15T12:00:00Z',
      release: 'qr3',
      detector: 2,
      lambdaUm: 1.52,
      bandwidthUm: 0.04,
      frameUrl: '/frame3.png',
      sourceUrl: 'https://irsa.ipac.caltech.edu/',
    },
    {
      id: 'e01',
      obsId: 'OBS1',
      utc: '2026-02-01T08:00:00Z',
      release: 'dr1',
      detector: 2,
      lambdaUm: 1.51,
      bandwidthUm: 0.04,
      frameUrl: '/frame1.png',
      sourceUrl: 'https://irsa.ipac.caltech.edu/',
    },
    {
      id: 'e02',
      obsId: 'OBS2',
      utc: '2026-05-10T04:00:00Z',
      release: 'dr1',
      detector: 5,
      lambdaUm: 3.45,
      bandwidthUm: 0.09,
      frameUrl: '/frame2.png',
      sourceUrl: 'https://irsa.ipac.caltech.edu/',
    },
  ],
  matchedPairs: [['e01', 'e03']],
  candidates: [],
  message: null,
  provenance: {
    collection: 'spherex_dr1|spherex_qr3',
    retrievedUtc: '2026-11-14T12:00:00Z',
    synthetic: false,
    credit: 'SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive',
  },
};

describe('epochs utilities (F2)', () => {
  it('test_epochs_sorted_by_utc', () => {
    const ordered = sortedEpochs(sampleManifest);
    expect(ordered.map((e) => e.id)).toEqual(['e01', 'e03', 'e02'].sort((a, b) => {
      const map: Record<string, number> = { e01: 1, e02: 2, e03: 3 };
      return map[a] - map[b];
    }));
    expect(ordered.map((e) => e.id)).toEqual(['e01', 'e02', 'e03']);
  });

  it('test_lambda_badge_matched_pair', () => {
    const ordered = sortedEpochs(sampleManifest);
    expect(lambdaBadge(ordered[0], ordered[2], sampleManifest)).toBe('matched');
    expect(lambdaBadge(ordered[2], ordered[0], sampleManifest)).toBe('matched');
  });

  it('test_lambda_badge_mismatch_pair', () => {
    const ordered = sortedEpochs(sampleManifest);
    expect(lambdaBadge(ordered[0], ordered[1], sampleManifest)).toBe('mismatch');
  });
});
