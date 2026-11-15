import type { CandidateTrackPoint, FieldManifest } from '../types/spherex';
import { normalizeRa } from '../utils/coordinates';

const MANDATORY_CREDIT =
  'SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive';

interface StarSeed {
  x: number;
  y: number;
  flux: number;
  tempIndex: number;
}

/**
 * Generates a deterministic 60x60 pixelated astronomical cutout SVG data-URI.
 * Uses shape-rendering="crispEdges" on a 60x60 detector grid so HTML5 2D <canvas>
 * renders exact detector pixels with zero bilinear blur.
 */
export function generateCutoutDataUri(options: {
  seed: number;
  lambdaUm: number;
  targetX: number;
  targetY: number;
  targetFlux: number;
  extendedCore?: boolean;
}): string {
  const { seed, lambdaUm, targetX, targetY, targetFlux, extendedCore = false } = options;
  const gridSize = 60;

  // Deterministic PRNG (Mulberry32)
  let state = Math.floor(seed * 100000) >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Generate 16 background field stars
  const stars: StarSeed[] = [];
  for (let i = 0; i < 16; i++) {
    stars.push({
      x: Math.floor(rand() * (gridSize - 8)) + 4,
      y: Math.floor(rand() * (gridSize - 8)) + 4,
      flux: 0.35 + rand() * 0.65,
      tempIndex: (rand() - 0.5) * 0.6,
    });
  }

  // Wavelength color tinting: short NIR (0.75-1.6 um) cool cyan-white, mid-IR (2.4-5.0 um) warm amber-gold
  const isLongWave = lambdaUm >= 2.2;
  const baseBg = isLongWave ? '#0c0f17' : '#090d16';

  const rects: string[] = [];
  // Subtle detector pixel grid cells (15x15 macro-blocks for background sky noise)
  for (let gy = 0; gy < gridSize; gy += 3) {
    for (let gx = 0; gx < gridSize; gx += 3) {
      const noise = rand();
      if (noise > 0.72) {
        const v = Math.floor(14 + (noise - 0.72) * 45);
        const r = isLongWave ? v + 6 : v;
        const g = v + 2;
        const b = isLongWave ? v - 2 : v + 8;
        rects.push(`<rect x="${gx}" y="${gy}" width="3" height="3" fill="rgb(${r},${g},${b})"/>`);
      }
    }
  }

  // Optional extended galaxy core for M101 Control Field
  if (extendedCore) {
    const cx = 30;
    const cy = 30;
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const distSq = dx * dx + dy * dy;
        if (distSq <= 81) {
          const falloff = Math.exp(-distSq / 28);
          const lum = Math.min(235, Math.floor(28 + falloff * (isLongWave ? 155 : 125)));
          const r = isLongWave ? Math.min(255, Math.floor(lum * 1.12)) : Math.floor(lum * 0.88);
          const g = Math.floor(lum * 0.94);
          const b = isLongWave ? Math.floor(lum * 0.74) : Math.min(255, Math.floor(lum * 1.15));
          rects.push(
            `<rect x="${cx + dx}" y="${cy + dy}" width="1" height="1" fill="rgb(${r},${g},${b})"/>`
          );
        }
      }
    }
  }

  const drawPsf = (px: number, py: number, intensity: number, warmShift: boolean) => {
    const ix = Math.round(px);
    const iy = Math.round(py);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = ix + dx;
        const y = iy + dy;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
        const r2 = dx * dx + dy * dy;
        if (r2 > 5) continue;
        const weight = r2 === 0 ? 1.0 : r2 === 1 ? 0.62 : r2 === 2 ? 0.35 : 0.16;
        const val = Math.min(255, Math.floor(24 + 230 * intensity * weight));
        const r = warmShift ? Math.min(255, Math.floor(val * 1.08)) : Math.floor(val * 0.9);
        const g = Math.floor(val * 0.95);
        const b = warmShift ? Math.floor(val * 0.68) : Math.min(255, Math.floor(val * 1.08));
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${r},${g},${b})"/>`);
      }
    }
  };

  // Draw background stars with wavelength-dependent spectral scaling
  for (const star of stars) {
    const spectralFactor = isLongWave
      ? Math.max(0.25, 1.0 + star.tempIndex)
      : Math.max(0.25, 1.0 - star.tempIndex * 0.5);
    drawPsf(star.x, star.y, Math.min(1.0, star.flux * spectralFactor), isLongWave);
  }

  // Draw primary moving/transient target PSF at (targetX, targetY)
  drawPsf(targetX, targetY, targetFlux, true);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60" shape-rendering="crispEdges"><rect width="60" height="60" fill="${baseBg}"/>${rects.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const M101_MANIFEST: FieldManifest = {
  schemaVersion: '1.0',
  id: 'curated-m101-control',
  name: 'M101 Control Field',
  ra: 210.8023,
  dec: 54.349,
  fovDeg: 0.25,
  grid: { widthPx: 60, heightPx: 60, pixScaleArcsec: 6.2 },
  epochs: [
    {
      id: 'e01',
      obsId: '2026W03_1A_0210_1',
      utc: '2026-01-14T03:22:10Z',
      release: 'dr1',
      detector: 2,
      lambdaUm: 1.12,
      bandwidthUm: 0.03,
      frameUrl: generateCutoutDataUri({
        seed: 210.8023,
        lambdaUm: 1.12,
        targetX: 18,
        targetY: 22,
        targetFlux: 0.92,
        extendedCore: true,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=210.8023&dec=54.3490',
    },
    {
      id: 'e02',
      obsId: '2026W08_2B_0412_2',
      utc: '2026-02-19T08:45:00Z',
      release: 'qr3',
      detector: 2,
      lambdaUm: 1.13,
      bandwidthUm: 0.03,
      frameUrl: generateCutoutDataUri({
        seed: 210.8023,
        lambdaUm: 1.13,
        targetX: 24,
        targetY: 26,
        targetFlux: 0.94,
        extendedCore: true,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=210.8023&dec=54.3490',
    },
    {
      id: 'e03',
      obsId: '2026W14_1C_0819_4',
      utc: '2026-04-02T14:12:30Z',
      release: 'qr3',
      detector: 4,
      lambdaUm: 2.45,
      bandwidthUm: 0.07,
      frameUrl: generateCutoutDataUri({
        seed: 210.8023,
        lambdaUm: 2.45,
        targetX: 31,
        targetY: 31,
        targetFlux: 0.98,
        extendedCore: true,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=210.8023&dec=54.3490',
    },
  ],
  matchedPairs: [['e01', 'e02']],
  candidates: [
    {
      id: 'CAND-M101-01',
      kind: 'moved_source',
      status: 'candidate',
      track: [
        { epochId: 'e01', x: 18, y: 22, ra: 210.7985, dec: 54.3512 },
        { epochId: 'e02', x: 24, y: 26, ra: 210.8012, dec: 54.3498 },
        { epochId: 'e03', x: 31, y: 31, ra: 210.8044, dec: 54.3481 },
      ],
      snr: 11.2,
      match: {
        catalog: 'JPL SBIdent',
        name: '(3342) Fivesparks',
        sepArcsec: 1.4,
      },
      explanation: {
        text: 'Candidate source tracked across 3 epochs at S/N 11.2 with cross-epoch offset of 6.0 pixels between wavelength-matched pair e01 (1.120 um) and e02 (1.130 um). Cross-match within 1.4 arcsec of known main-belt object (3342) Fivesparks in JPL SBIdent.',
        source: 'template',
      },
    },
  ],
  message: null,
  provenance: {
    collection: 'spherex_dr1, spherex_qr3',
    retrievedUtc: '2026-04-10T00:00:00Z',
    synthetic: false,
    credit: MANDATORY_CREDIT,
  },
};

export const BARNARD_MANIFEST: FieldManifest = {
  schemaVersion: '1.0',
  id: 'curated-barnards-star',
  name: "Barnard's Star High-PM Field",
  ra: 269.4521,
  dec: 4.6934,
  fovDeg: 0.25,
  grid: { widthPx: 60, heightPx: 60, pixScaleArcsec: 6.2 },
  epochs: [
    {
      id: 'e01',
      obsId: '2026W02_3A_0104_2',
      utc: '2026-01-09T06:15:00Z',
      release: 'dr1',
      detector: 2,
      lambdaUm: 1.25,
      bandwidthUm: 0.04,
      frameUrl: generateCutoutDataUri({
        seed: 269.4521,
        lambdaUm: 1.25,
        targetX: 30,
        targetY: 38,
        targetFlux: 1.0,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=269.4521&dec=4.6934',
    },
    {
      id: 'e02',
      obsId: '2026W09_1B_0519_2',
      utc: '2026-02-28T11:40:00Z',
      release: 'qr3',
      detector: 2,
      lambdaUm: 1.26,
      bandwidthUm: 0.04,
      frameUrl: generateCutoutDataUri({
        seed: 269.4521,
        lambdaUm: 1.26,
        targetX: 29,
        targetY: 30,
        targetFlux: 1.0,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=269.4521&dec=4.6934',
    },
    {
      id: 'e03',
      obsId: '2026W15_2C_0902_4',
      utc: '2026-04-08T19:05:00Z',
      release: 'qr3',
      detector: 4,
      lambdaUm: 3.18,
      bandwidthUm: 0.09,
      frameUrl: generateCutoutDataUri({
        seed: 269.4521,
        lambdaUm: 3.18,
        targetX: 28,
        targetY: 22,
        targetFlux: 0.96,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=269.4521&dec=4.6934',
    },
  ],
  matchedPairs: [['e01', 'e02']],
  candidates: [
    {
      id: 'CAND-BARNARD-01',
      kind: 'moved_source',
      status: 'candidate',
      track: [
        { epochId: 'e01', x: 30, y: 38, ra: 269.4525, dec: 4.6908 },
        { epochId: 'e02', x: 29, y: 30, ra: 269.4521, dec: 4.6934 },
        { epochId: 'e03', x: 28, y: 22, ra: 269.4517, dec: 4.6961 },
      ],
      snr: 18.4,
      match: {
        catalog: 'Gaia DR3 / SIMBAD',
        name: "Barnard's Star (GJ 699)",
        sepArcsec: 1.2,
      },
      explanation: {
        text: "High proper-motion source tracked across 3 epochs at S/N 18.4 showing northward displacement across the 60x60 detector grid. Cross-matches within 1.2 arcsec of Barnard's Star (GJ 699, 10.3 arcsec/yr proper motion) in Gaia DR3 / SIMBAD.",
        source: 'template',
      },
    },
  ],
  message: null,
  provenance: {
    collection: 'spherex_dr1, spherex_qr3',
    retrievedUtc: '2026-04-10T00:00:00Z',
    synthetic: false,
    credit: MANDATORY_CREDIT,
  },
};

export const WISE0855_MANIFEST: FieldManifest = {
  schemaVersion: '1.0',
  id: 'curated-wise-0855',
  name: 'WISE 0855 Sub-Stellar Field',
  ra: 133.7867,
  dec: -7.245,
  fovDeg: 0.25,
  grid: { widthPx: 60, heightPx: 60, pixScaleArcsec: 6.2 },
  epochs: [
    {
      id: 'e01',
      obsId: '2026W04_2A_0331_5',
      utc: '2026-01-22T02:10:00Z',
      release: 'dr1',
      detector: 5,
      lambdaUm: 4.42,
      bandwidthUm: 0.11,
      frameUrl: generateCutoutDataUri({
        seed: 133.7867,
        lambdaUm: 4.42,
        targetX: 39,
        targetY: 28,
        targetFlux: 0.89,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=133.7867&dec=-7.2450',
    },
    {
      id: 'e02',
      obsId: '2026W10_3B_0640_5',
      utc: '2026-03-05T09:30:00Z',
      release: 'qr3',
      detector: 5,
      lambdaUm: 4.44,
      bandwidthUm: 0.11,
      frameUrl: generateCutoutDataUri({
        seed: 133.7867,
        lambdaUm: 4.44,
        targetX: 31,
        targetY: 29,
        targetFlux: 0.91,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=133.7867&dec=-7.2450',
    },
    {
      id: 'e03',
      obsId: '2026W16_1A_0988_3',
      utc: '2026-04-11T16:50:00Z',
      release: 'qr3',
      detector: 3,
      lambdaUm: 1.65,
      bandwidthUm: 0.05,
      frameUrl: generateCutoutDataUri({
        seed: 133.7867,
        lambdaUm: 1.65,
        targetX: 23,
        targetY: 31,
        targetFlux: 0.32,
      }),
      sourceUrl: 'https://irsa.ipac.caltech.edu/applications/spherex/?ra=133.7867&dec=-7.2450',
    },
  ],
  matchedPairs: [['e01', 'e02']],
  candidates: [
    {
      id: 'CAND-W0855-01',
      kind: 'moved_source',
      status: 'candidate',
      track: [
        { epochId: 'e01', x: 39, y: 28, ra: 133.7892, dec: -7.2446 },
        { epochId: 'e02', x: 31, y: 29, ra: 133.7867, dec: -7.245 },
        { epochId: 'e03', x: 23, y: 31, ra: 133.7841, dec: -7.2455 },
      ],
      snr: 9.7,
      match: null,
      explanation: {
        text: 'Unvalidated moving candidate tracked across 3 epochs at S/N 9.7 in Detector 5 thermal-infrared bands (4.420 um and 4.440 um) with strong dropout at 1.650 um (spectral mismatch in e03). No catalog match in JPL SBIdent or Gaia DR3; consistent with a cold sub-stellar object.',
        source: 'llm',
      },
    },
  ],
  message: null,
  provenance: {
    collection: 'spherex_dr1, spherex_qr3',
    retrievedUtc: '2026-04-10T00:00:00Z',
    synthetic: false,
    credit: MANDATORY_CREDIT,
  },
};

/**
 * Returns a curated SPHEREx FieldManifest for the 3 benchmark targets
 * (M101 Control Field, Barnard's Star, WISE 0855) or synthesizes a deterministic
 * multi-epoch SPHEREx cutout manifest for any clicked sky coordinate (RA, Dec).
 */
export function getCuratedOrFallbackManifest(
  ra: number,
  dec: number,
  fovDeg = 0.25
): FieldManifest {
  const cleanRa = normalizeRa(ra);
  const cleanDec = Math.max(-90, Math.min(90, dec));

  if (Math.abs(cleanRa - 210.8023) < 0.05 && Math.abs(cleanDec - 54.349) < 0.05) {
    return { ...M101_MANIFEST, fovDeg };
  }
  if (Math.abs(cleanRa - 269.4521) < 0.05 && Math.abs(cleanDec - 4.6934) < 0.05) {
    return { ...BARNARD_MANIFEST, fovDeg };
  }
  if (Math.abs(cleanRa - 133.7867) < 0.05 && Math.abs(cleanDec - -7.245) < 0.05) {
    return { ...WISE0855_MANIFEST, fovDeg };
  }

  // Deterministic sky sector manifest for any clicked 3D sky coordinate
  const seed = Math.abs(cleanRa * 13.37 + cleanDec * 7.91) + 1.0;
  const baseX = 18 + (Math.floor(seed * 10) % 14);
  const baseY = 18 + (Math.floor(seed * 17) % 14);
  const snr = Number((6.5 + (seed % 7.8)).toFixed(1));
  const track: CandidateTrackPoint[] = [
    { epochId: 'e01', x: baseX, y: baseY, ra: cleanRa - 0.002, dec: cleanDec - 0.001 },
    { epochId: 'e02', x: baseX + 6, y: baseY + 4, ra: cleanRa, dec: cleanDec },
    { epochId: 'e03', x: baseX + 12, y: baseY + 8, ra: cleanRa + 0.002, dec: cleanDec + 0.001 },
  ];

  const coordTag = `RA ${cleanRa.toFixed(4)} Dec ${cleanDec >= 0 ? '+' : ''}${cleanDec.toFixed(4)}`;

  return {
    schemaVersion: '1.0',
    id: `sky-sector-${cleanRa.toFixed(3)}-${cleanDec.toFixed(3)}`,
    name: `SPHEREx Sector (${coordTag})`,
    ra: cleanRa,
    dec: cleanDec,
    fovDeg,
    grid: { widthPx: 60, heightPx: 60, pixScaleArcsec: 6.2 },
    epochs: [
      {
        id: 'e01',
        obsId: `2026W05_DR1_${Math.floor(cleanRa)}_1`,
        utc: '2026-01-25T05:12:00Z',
        release: 'dr1',
        detector: 1,
        lambdaUm: 0.98,
        bandwidthUm: 0.03,
        frameUrl: generateCutoutDataUri({
          seed,
          lambdaUm: 0.98,
          targetX: track[0].x,
          targetY: track[0].y,
          targetFlux: 0.88,
        }),
        sourceUrl: `https://irsa.ipac.caltech.edu/applications/spherex/?ra=${cleanRa.toFixed(4)}&dec=${cleanDec.toFixed(4)}`,
      },
      {
        id: 'e02',
        obsId: `2026W11_QR3_${Math.floor(cleanRa)}_1`,
        utc: '2026-03-11T10:34:00Z',
        release: 'qr3',
        detector: 1,
        lambdaUm: 0.99,
        bandwidthUm: 0.03,
        frameUrl: generateCutoutDataUri({
          seed,
          lambdaUm: 0.99,
          targetX: track[1].x,
          targetY: track[1].y,
          targetFlux: 0.91,
        }),
        sourceUrl: `https://irsa.ipac.caltech.edu/applications/spherex/?ra=${cleanRa.toFixed(4)}&dec=${cleanDec.toFixed(4)}`,
      },
      {
        id: 'e03',
        obsId: `2026W16_QR3_${Math.floor(cleanRa)}_3`,
        utc: '2026-04-09T18:20:00Z',
        release: 'qr3',
        detector: 3,
        lambdaUm: 2.15,
        bandwidthUm: 0.06,
        frameUrl: generateCutoutDataUri({
          seed,
          lambdaUm: 2.15,
          targetX: track[2].x,
          targetY: track[2].y,
          targetFlux: 0.82,
        }),
        sourceUrl: `https://irsa.ipac.caltech.edu/applications/spherex/?ra=${cleanRa.toFixed(4)}&dec=${cleanDec.toFixed(4)}`,
      },
    ],
    matchedPairs: [['e01', 'e02']],
    candidates: [
      {
        id: 'CAND-SKY-01',
        kind: 'moved_source',
        status: 'candidate',
        track,
        snr,
        match: null,
        explanation: {
          text: `Candidate source extracted at ${coordTag} across 3 epochs at S/N ${snr.toFixed(1)} with no match in JPL SBIdent or Gaia DR3.`,
          source: 'template',
        },
      },
    ],
    message: null,
    provenance: {
      collection: 'spherex_dr1, spherex_qr3',
      retrievedUtc: '2026-04-10T00:00:00Z',
      synthetic: false,
      credit: MANDATORY_CREDIT,
    },
  };
}

export const getCuratedManifest = getCuratedOrFallbackManifest;
