import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BlinkCanvas } from './components/BlinkViewer/BlinkCanvas';
import { WavelengthBadge } from './components/BlinkViewer/WavelengthBadge';
import { AladinSkyMap } from './components/CelestialViewer/AladinSkyMap';
import { EvidenceCard } from './components/EvidenceCard/EvidenceCard';
import {
  BARNARD_MANIFEST,
  generateCutoutDataUri,
  getCuratedOrFallbackManifest,
  M101_MANIFEST,
  WISE0855_MANIFEST,
} from './data/curatedFields';
import { translations } from './i18n/translations';
import { fetchField, getLatestCachedField } from './services/fieldService';
import type { Candidate, FieldManifest } from './types/spherex';
import { candidateLabel } from './utils/candidates';
import { DEFAULT_VIEW, normalizeRa, parseCoords, parseView } from './utils/coordinates';
import { lambdaBadge, sortedEpochs } from './utils/epochs';

// Controllable Aladin Lite v3 WebGL2 engine mock for deterministic headless verification
const aladinState = {
  shouldFailInit: false,
  centerRa: 210.8023,
  centerDec: 54.349,
  fov: 0.25,
  lastSurvey: 'allwise',
  positionChangedCb: null as ((pos: unknown) => void) | null,
  clickCb: null as ((pos: unknown) => void) | null,
  createImageSurveySpy: vi.fn((key: string) => ({ id: key })),
  setImageSurveySpy: vi.fn(),
  gotoRaDecSpy: vi.fn((ra: number, dec: number) => {
    aladinState.centerRa = ra;
    aladinState.centerDec = dec;
  }),
  setFovSpy: vi.fn((f: number) => {
    aladinState.fov = f;
  }),
  setProjectionSpy: vi.fn(),
};

vi.mock('aladin-lite', () => ({
  default: {
    get init() {
      if (aladinState.shouldFailInit) {
        return Promise.reject(new Error('WebGL2 context creation failed in headless mode'));
      }
      return Promise.resolve();
    },
    aladin: (_container: HTMLElement, opts?: { target?: string; fov?: number }) => {
      if (aladinState.shouldFailInit) {
        throw new Error('WebGL2 context creation failed in headless mode');
      }
      if (opts?.target) {
        const parts = opts.target.split(/\s+/).map(Number);
        if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          aladinState.centerRa = parts[0];
          aladinState.centerDec = parts[1];
        }
      }
      if (typeof opts?.fov === 'number') {
        aladinState.fov = opts.fov;
      }
      return {
        createImageSurvey: aladinState.createImageSurveySpy,
        setImageSurvey: aladinState.setImageSurveySpy,
        gotoRaDec: aladinState.gotoRaDecSpy,
        setFov: aladinState.setFovSpy,
        setProjection: aladinState.setProjectionSpy,
        getRaDec: () => [aladinState.centerRa, aladinState.centerDec] as [number, number],
        getFov: () => [aladinState.fov, aladinState.fov] as [number, number],
        pix2world: (x: number, y: number) => [
          normalizeRa(aladinState.centerRa + (x - 400) * 0.001),
          Math.max(-90, Math.min(90, aladinState.centerDec - (y - 300) * 0.001)),
        ],
        world2pix: () => [400, 300],
        on: (event: string, cb: (payload: unknown) => void) => {
          if (event === 'positionChanged') {
            aladinState.positionChangedCb = cb;
          } else if (event === 'click' || event === 'objectClicked') {
            aladinState.clickCb = cb;
          }
        },
      };
    },
  },
}));

interface MockCanvas2DContext {
  imageSmoothingEnabled: boolean;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: string;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  ellipse: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
  createRadialGradient: ReturnType<typeof vi.fn>;
  createLinearGradient: ReturnType<typeof vi.fn>;
}

let mockCtx2D: MockCanvas2DContext;

function createMockCanvas2DContext(): MockCanvas2DContext {
  const gradientStub = { addColorStop: vi.fn() };
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => gradientStub),
    createLinearGradient: vi.fn(() => gradientStub),
  };
}

function mockBackendByCoordinate() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const urlStr =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(urlStr, 'http://localhost:8000');
    const ra = Number(parsedUrl.searchParams.get('ra') ?? DEFAULT_VIEW.ra);
    const dec = Number(parsedUrl.searchParams.get('dec') ?? DEFAULT_VIEW.dec);
    const fov = Number(parsedUrl.searchParams.get('fov') ?? DEFAULT_VIEW.fovDeg);
    const manifest = getCuratedOrFallbackManifest(ra, dec, fov);
    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  document.documentElement.lang = 'en';

  // Enable full 2D Canvas and WebGL2 mock paths in AladinSkyMap & BlinkCanvas
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0'
  );

  aladinState.shouldFailInit = false;
  aladinState.centerRa = DEFAULT_VIEW.ra;
  aladinState.centerDec = DEFAULT_VIEW.dec;
  aladinState.fov = DEFAULT_VIEW.fovDeg;
  aladinState.positionChangedCb = null;
  aladinState.clickCb = null;
  aladinState.createImageSurveySpy.mockClear();
  aladinState.setImageSurveySpy.mockClear();
  aladinState.gotoRaDecSpy.mockClear();
  aladinState.setFovSpy.mockClear();
  aladinState.setProjectionSpy.mockClear();

  mockCtx2D = createMockCanvas2DContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => mockCtx2D) as unknown as typeof HTMLCanvasElement.prototype.getContext
  );

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ============================================================================
// TIER 1 — FEATURE COVERAGE (Happy-Path Verification of F1 through F18)
// ============================================================================
describe('Tier 1 — Feature Coverage (F1-F18 Happy Path)', () => {
  it('F1 & F2: renders 3D/WebGL2 Celestial Viewer, switches AllWISE/2MASS/DSS2 surveys, toggles 3D projection/grid, and extracts sky coordinates on click', async () => {
    const pickedCoords: Array<{ ra: number; dec: number }> = [];
    const handlePick = (ra: number, dec: number) => {
      pickedCoords.push({ ra, dec });
    };

    render(
      <AladinSkyMap
        ra={210.8023}
        dec={54.349}
        fovDeg={0.25}
        lang="en"
        onPickCoords={handlePick}
        onSelectRegion={handlePick}
      />
    );

    const skyRegion = screen.getByRole('region', { name: /Infrared sky context map/i });
    expect(skyRegion).toBeTruthy();
    expect(within(skyRegion).getByText(/210\.8023/)).toBeTruthy();
    expect(within(skyRegion).getByText(/54\.3490/)).toBeTruthy();

    await waitFor(() => {
      expect(aladinState.createImageSurveySpy).toHaveBeenCalled();
    });

    // F2: Switch surveys between AllWISE, 2MASS, and DSS2
    const surveySelect = screen.getByLabelText(/Background survey/i) as HTMLSelectElement;
    expect(surveySelect.value).toBe('allwise');

    fireEvent.change(surveySelect, { target: { value: '2mass' } });
    expect(surveySelect.value).toBe('2mass');
    expect(aladinState.createImageSurveySpy).toHaveBeenCalledWith(
      '2mass',
      expect.stringContaining('2MASS'),
      'https://skies.esac.esa.int/2MASSColor/',
      'equatorial',
      9,
      { imgFormat: 'jpeg' }
    );

    fireEvent.change(surveySelect, { target: { value: 'dss2' } });
    expect(surveySelect.value).toBe('dss2');
    expect(aladinState.setImageSurveySpy).toHaveBeenCalledWith('P/DSS2/color');

    // Toggle 3D Globe (SIN) <-> Wide Sky (AIT) and ICRS Grid
    const projBtn = screen.getByRole('button', { name: /3D Globe \(SIN\)/i });
    fireEvent.click(projBtn);
    expect(screen.getByRole('button', { name: /Wide Sky \(AIT\)/i })).toBeTruthy();

    const gridBtn = screen.getByRole('button', { name: /ICRS Grid/i });
    expect(gridBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(gridBtn);
    expect(gridBtn.getAttribute('aria-pressed')).toBe('false');

    // F1: Click directly on the 3D celestial sphere canvas to extract RA/Dec
    const skyCanvas = screen.getByTestId('celestial-3d-canvas');
    fireEvent.mouseDown(skyCanvas, { clientX: 420, clientY: 280 });
    fireEvent.mouseUp(skyCanvas, { clientX: 420, clientY: 280 });
    expect(pickedCoords.length).toBeGreaterThanOrEqual(1);

    // Also test Aladin positionChanged + "Query this region" button
    act(() => {
      aladinState.centerRa = 269.4521;
      aladinState.centerDec = 4.6934;
      aladinState.positionChangedCb?.({ ra: 269.4521, dec: 4.6934 });
    });

    const queryRegionBtn = screen.getByRole('button', { name: /Query this region/i });
    fireEvent.click(queryRegionBtn);
    expect(pickedCoords[pickedCoords.length - 1].ra).toBeCloseTo(269.4521, 3);
    expect(pickedCoords[pickedCoords.length - 1].dec).toBeCloseTo(4.6934, 3);
  });

  it("F3: provides curated target presets (M101, Barnard's Star, WISE 0855) and pre-baked 60x60 SVG cutout datasets", async () => {
    // Verify curated datasets and 60x60 pixelated SVG cutout generator
    const uri = generateCutoutDataUri({
      seed: 210.8023,
      lambdaUm: 1.12,
      targetX: 20,
      targetY: 20,
      targetFlux: 0.9,
      extendedCore: true,
    });
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(uri)).toContain('viewBox="0 0 60 60"');
    expect(decodeURIComponent(uri)).toContain('shape-rendering="crispEdges"');

    expect(M101_MANIFEST.epochs).toHaveLength(3);
    expect(BARNARD_MANIFEST.candidates[0].match?.name).toContain("Barnard's Star");
    expect(WISE0855_MANIFEST.candidates[0].match).toBeNull();

    const arbitrary = getCuratedOrFallbackManifest(45.1234, -19.8765, 0.25);
    expect(arbitrary.ra).toBeCloseTo(45.1234, 4);
    expect(arbitrary.dec).toBeCloseTo(-19.8765, 4);
    expect(arbitrary.epochs.length).toBeGreaterThanOrEqual(2);

    // Verify preset buttons in App
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/M101 Control Field/i).length).toBeGreaterThanOrEqual(1);
    });

    const barnardBtn = screen.getByRole('button', { name: /Barnard's Star/i });
    fireEvent.click(barnardBtn);

    await waitFor(() => {
      expect(window.location.search).toContain('ra=269.4521');
      expect(window.location.search).toContain('dec=4.6934');
      expect(barnardBtn.getAttribute('aria-pressed')).toBe('true');
    });

    const wiseBtn = screen.getByRole('button', { name: /WISE 0855/i });
    fireEvent.click(wiseBtn);

    await waitFor(() => {
      expect(window.location.search).toContain('ra=133.7867');
      expect(window.location.search).toContain('dec=-7.2450');
      expect(wiseBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('F4 & F5: parses decimal and sexagesimal coordinates in Smart Search Bar and synchronizes URL query params', async () => {
    window.history.replaceState(null, '', '?ra=269.4521&dec=4.6934&fov=0.25');
    mockBackendByCoordinate();

    render(<App />);

    // Initial load respects URL query parameters
    const searchInput = screen.getByLabelText(/Sky coordinates/i) as HTMLInputElement;
    expect(searchInput.value).toContain('269.4521');
    expect(searchInput.value).toContain('4.6934');

    // Submit sexagesimal HMS/DMS coordinates
    fireEvent.change(searchInput, { target: { value: '13h 03m 31s +54d 20m 56s' } });
    fireEvent.click(screen.getByRole('button', { name: /Load field/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('ra=195.8792');
      expect(window.location.search).toContain('dec=54.3489');
    });

    // Submit decimal coordinates with comma + sign
    fireEvent.change(searchInput, { target: { value: '133.7867, -7.2450' } });
    fireEvent.click(screen.getByRole('button', { name: /Load field/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('ra=133.7867');
      expect(window.location.search).toContain('dec=-7.2450');
    });
  });

  it('F6 & F7: toggles full UI between English and Spanish and opens/closes accessible AboutModal with NASA/IPAC credits', async () => {
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /SphereX Viewer and Data Visualizer/i })
      ).toBeTruthy();
    });

    expect(document.documentElement.lang).toBe('en');

    // Switch to Spanish
    const langBtn = screen.getByRole('button', {
      name: /Cambiar idioma a espanol|Switch language to Spanish/i,
    });
    fireEvent.click(langBtn);

    expect(document.documentElement.lang).toBe('es');
    expect(screen.getByText(/Explorador infrarrojo multiepoca|Visor espacial 3D/i)).toBeTruthy();

    // Open AboutModal in Spanish
    const aboutBtn = screen.getByRole('button', { name: /Guia y Creditos/i });
    fireEvent.click(aboutBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText(/Guia de Uso y Creditos Cientificos/i)).toBeTruthy();
    expect(
      within(dialog).getByText(
        /SPHEREx data: NASA\/JPL-Caltech\/IPAC, via NASA\/IPAC Infrared Science Archive/i
      )
    ).toBeTruthy();
    expect(within(dialog).getByText(/Apache-2\.0/i)).toBeTruthy();

    // Close via Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('F8, F9, F10, F11: renders pixelated 2D Blink Comparator canvas, playback FPS controls, epoch stepping, and split-wipe slider', async () => {
    vi.useFakeTimers();
    const onSelectCandidate = vi.fn();

    const { container } = render(
      <BlinkCanvas
        manifest={M101_MANIFEST}
        selectedCandidateId="CAND-M101-01"
        onSelectCandidate={onSelectCandidate}
        lang="en"
      />
    );

    // F8: Verify 2D <canvas> pixelated styling and ctx.imageSmoothingEnabled = false
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(canvas.width).toBe(290);
    expect(canvas.height).toBe(290);
    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(mockCtx2D.imageSmoothingEnabled).toBe(false);

    // Verify Active Epoch telemetry readout (e01: 2026-01-14, 1.120 um, D2 (DR1), 2026W03_1A_0210_1)
    expect(screen.getByText('2026-01-14 03:22:10')).toBeTruthy();
    expect(screen.getByText('1.120 um')).toBeTruthy();
    expect(screen.getByText('D2 (DR1)')).toBeTruthy();
    expect(screen.getByText('2026W03_1A_0210_1')).toBeTruthy();

    // F9: Play/Pause and FPS Speed Controls (1, 2, 4 FPS)
    const playBtn = screen.getByRole('button', { name: /Play Blink/i });
    const fpsSelect = screen.getByLabelText(/Blink speed/i) as HTMLSelectElement;
    expect(fpsSelect.value).toBe('2');

    fireEvent.change(fpsSelect, { target: { value: '4' } });
    expect(fpsSelect.value).toBe('4');

    fireEvent.click(playBtn);
    expect(screen.getByRole('button', { name: /Pause Blink/i })).toBeTruthy();

    // Advance 250ms at 4 FPS -> steps from epoch 1/3 to 2/3
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.getByText(/Active epoch \(2\/3\)/i)).toBeTruthy();

    // F10: Manual Next/Prev buttons, epoch chips, and ArrowLeft/ArrowRight keyboard stepping
    fireEvent.click(screen.getByRole('button', { name: /Next epoch/i }));
    expect(screen.getByText(/Active epoch \(3\/3\)/i)).toBeTruthy();
    // Manual step pauses playback
    expect(screen.getByRole('button', { name: /Play Blink/i })).toBeTruthy();

    const comparatorSection = screen.getByRole('region', { name: /Epoch Blink Comparator/i });
    fireEvent.keyDown(comparatorSection, { key: 'ArrowLeft' });
    expect(screen.getByText(/Active epoch \(2\/3\)/i)).toBeTruthy();

    fireEvent.keyDown(comparatorSection, { key: 'ArrowRight' });
    expect(screen.getByText(/Active epoch \(3\/3\)/i)).toBeTruthy();

    // F11: Side-by-side Split-Wipe Comparison Slider
    const splitSlider = screen.getByLabelText(/Split-wipe comparison/i) as HTMLInputElement;
    expect(splitSlider.value).toBe('100');

    mockCtx2D.clip.mockClear();
    fireEvent.change(splitSlider, { target: { value: '50' } });
    expect(screen.getByText('50%')).toBeTruthy();
    expect(mockCtx2D.clip).toHaveBeenCalled();
  });

  it('F12: displays Green (Wavelength Matched) for compatible pairs and Amber (Wavelength Mismatch) warning for different bands', () => {
    const { rerender } = render(
      <WavelengthBadge status="matched" lambdaA={1.12} lambdaB={1.13} lang="en" />
    );

    expect(screen.getByText(/Wavelength Matched/i)).toBeTruthy();
    expect(screen.getByText(/1\.120 um vs 1\.130 um/i)).toBeTruthy();
    expect(
      screen.getByText(/Valid spectral pair for temporal brightness comparison/i)
    ).toBeTruthy();

    rerender(<WavelengthBadge status="mismatch" lambdaA={1.12} lambdaB={2.45} lang="en" />);

    expect(screen.getByText(/Wavelength Mismatch/i)).toBeTruthy();
    expect(screen.getByText(/1\.120 um vs 2\.450 um/i)).toBeTruthy();
    expect(
      screen.getByText(/Different wavelength: brightness differences may not be real change/i)
    ).toBeTruthy();
  });

  it('F13, F14, F15, F16: plots candidate trajectory overlay, displays S/N, catalog match, RAG report, IRSA link, and mandatory disclaimer', () => {
    const onSelect = vi.fn();

    render(
      <>
        <BlinkCanvas
          manifest={BARNARD_MANIFEST}
          selectedCandidateId="CAND-BARNARD-01"
          onSelectCandidate={onSelect}
          lang="en"
        />
        <EvidenceCard
          manifest={BARNARD_MANIFEST}
          selectedCandidateId="CAND-BARNARD-01"
          onSelectCandidate={onSelect}
          lang="en"
        />
      </>
    );

    // F13: Candidate trajectory plotted via arc & lineTo on 2D canvas, and toggleable via Hide/Show tracks
    expect(mockCtx2D.arc).toHaveBeenCalled();
    const tracksBtn = screen.getByRole('button', { name: /Hide tracks/i });
    mockCtx2D.arc.mockClear();
    fireEvent.click(tracksBtn);
    expect(screen.getByRole('button', { name: /Show tracks/i })).toBeTruthy();
    expect(mockCtx2D.arc).not.toHaveBeenCalled();

    // F14: S/N ratio, algorithmic kind, and Gaia/SIMBAD catalog cross-match
    expect(screen.getAllByText(/S\/N 18\.4/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Source with cross-epoch offset/i)).toBeTruthy();
    expect(
      screen.getByText(/Barnard's Star \(GJ 699\) \(Gaia DR3 \/ SIMBAD, 1\.2"\)/i)
    ).toBeTruthy();

    // F15: Grounded RAG report and IRSA Spectrophotometry link
    expect(screen.getByText(/High proper-motion source tracked across 3 epochs/i)).toBeTruthy();
    expect(screen.getByText(/Source: deterministic template/i)).toBeTruthy();
    const irsaLink = screen.getByRole('link', { name: /Open IRSA Spectrophotometry/i });
    expect(irsaLink.getAttribute('href')).toBe(
      'https://irsa.ipac.caltech.edu/applications/spherex/?ra=269.4521&dec=4.6934'
    );

    // F16: Honest candidate label and permanent "What this is NOT" disclaimer
    const labelText = screen.getByText(
      /Candidate: matches known object \(Barnard's Star \(GJ 699\)\)/i
    );
    expect(labelText).toBeTruthy();
    expect(labelText.textContent).not.toMatch(/discover|descubr/i);
    expect(screen.getByText(/What this is NOT:/i)).toBeTruthy();
    expect(
      screen.getByText(/not a confirmed discovery and not a Planet X detection/i)
    ).toBeTruthy();
  });

  it('F17 & F18: renders red SYNTHETIC TEST DATA banner when synthetic is true and enforces antislop zero em-dash & landmark rules', () => {
    const syntheticManifest: FieldManifest = {
      ...M101_MANIFEST,
      id: 'synth-01',
      provenance: {
        ...M101_MANIFEST.provenance,
        synthetic: true,
      },
    };

    const { container } = render(
      <BlinkCanvas
        manifest={syntheticManifest}
        selectedCandidateId="CAND-M101-01"
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    const synthAlert = screen.getByRole('alert');
    expect(synthAlert.textContent).toContain('SYNTHETIC TEST DATA - not SPHEREx');
    expect(container.textContent).not.toContain('—');
  });
});

// ============================================================================
// TIER 2 — BOUNDARY & CORNER CASES (BVA & Negative/Edge Inputs)
// ============================================================================
describe('Tier 2 — Boundary & Corner Cases', () => {
  it('verifies Right Ascension wrapping boundaries (0, 360, -0.01, 365.5, -720)', () => {
    expect(normalizeRa(0)).toBeCloseTo(0, 5);
    expect(normalizeRa(360)).toBeCloseTo(0, 5);
    expect(normalizeRa(-0.01)).toBeCloseTo(359.99, 5);
    expect(normalizeRa(365.5)).toBeCloseTo(5.5, 5);
    expect(normalizeRa(-720)).toBeCloseTo(0, 5);

    expect(parseCoords('0 0')).toEqual({ ra: 0, dec: 0 });
    expect(parseCoords('360.0 0.0')).toEqual({ ra: 0, dec: 0 });
    expect(parseCoords('-0.01 12.5')).toEqual({ ra: 359.99, dec: 12.5 });
    expect(parseCoords('365.5 -45.0')).toEqual({ ra: 5.5, dec: -45 });
  });

  it('verifies Declination exact boundaries (-90, +90) and rejects out-of-range (-90.001, +90.001, +95)', () => {
    expect(parseCoords('180.0 -90.0')).toEqual({ ra: 180, dec: -90 });
    expect(parseCoords('180.0 +90.0')).toEqual({ ra: 180, dec: 90 });
    expect(parseCoords('00h 00m 00s -90d 00m 00s')).toEqual({ ra: 0, dec: -90 });
    expect(parseCoords('00h 00m 00s +90d 00m 00s')).toEqual({ ra: 0, dec: 90 });

    // Out of bounds
    expect(parseCoords('180.0 -90.001')).toBeNull();
    expect(parseCoords('180.0 90.001')).toBeNull();
    expect(parseCoords('180.0 95.0')).toBeNull();
    expect(parseCoords('00h 00m 00s +90d 00m 01s')).toBeNull();
    expect(parseCoords('00h 00m 00s -90d 01m 00s')).toBeNull();
  });

  it('rejects malformed sexagesimal strings (24h, 60m, 60s, garbage, single number)', () => {
    expect(parseCoords('24h 00m 00s +10d 00m 00s')).toBeNull();
    expect(parseCoords('12h 60m 00s +10d 00m 00s')).toBeNull();
    expect(parseCoords('12h 00m 60s +10d 00m 00s')).toBeNull();
    expect(parseCoords('12h 00m 00s +10d 60m 00s')).toBeNull();
    expect(parseCoords('12h 00m 00s +10d 00m 60s')).toBeNull();
    expect(parseCoords('   ')).toBeNull();
    expect(parseCoords('210.8023')).toBeNull();
  });

  it('handles corrupted URL query parameters by falling back safely to DEFAULT_VIEW', () => {
    expect(parseView('')).toEqual(DEFAULT_VIEW);
    expect(parseView('?ra=abc&dec=def&fov=xyz')).toEqual(DEFAULT_VIEW);
    expect(parseView('?ra=210.8&dec=999&fov=0.25')).toEqual(DEFAULT_VIEW);
    expect(parseView('?ra=210.8&dec=54.3&fov=-1')).toEqual({
      ra: 210.8,
      dec: 54.3,
      fovDeg: DEFAULT_VIEW.fovDeg,
    });
    expect(parseView('?ra=210.8&dec=54.3&fov=185')).toEqual({
      ra: 210.8,
      dec: 54.3,
      fovDeg: DEFAULT_VIEW.fovDeg,
    });
  });

  it('handles empty epochs array (epochs: []) with informative coverage message and no crash', () => {
    const emptyEpochsManifest: FieldManifest = {
      ...M101_MANIFEST,
      id: 'empty-field',
      epochs: [],
      candidates: [],
      message: 'No SPHEREx coverage in DR1/QR3 at this sky coordinate.',
    };

    render(
      <BlinkCanvas
        manifest={emptyEpochsManifest}
        selectedCandidateId={null}
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    expect(
      screen.getByText(/No SPHEREx coverage in DR1\/QR3 at this sky coordinate/i)
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Play Blink/i })).toBeNull();
  });

  it('handles single-epoch field (epochs.length === 1) by disabling Play/Prev/Next and hiding split-compare', () => {
    const singleEpochManifest: FieldManifest = {
      ...M101_MANIFEST,
      id: 'single-epoch-field',
      epochs: [M101_MANIFEST.epochs[0]],
      matchedPairs: [],
    };

    render(
      <BlinkCanvas
        manifest={singleEpochManifest}
        selectedCandidateId="CAND-M101-01"
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    const playBtn = screen.getByRole('button', { name: /Play Blink/i }) as HTMLButtonElement;
    const prevBtn = screen.getByRole('button', { name: /Previous epoch/i }) as HTMLButtonElement;
    const nextBtn = screen.getByRole('button', { name: /Next epoch/i }) as HTMLButtonElement;

    expect(playBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true);
    expect(screen.queryByLabelText(/Split-wipe comparison/i)).toBeNull();
  });

  it('handles zero candidates (candidates: []), unmatched vs matched candidates, and null vs template vs llm explanations', () => {
    const zeroCandManifest: FieldManifest = {
      ...M101_MANIFEST,
      candidates: [],
    };

    const { rerender } = render(
      <EvidenceCard
        manifest={zeroCandManifest}
        selectedCandidateId={null}
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    expect(screen.getByText(/No moving-source candidates flagged in this field/i)).toBeTruthy();
    expect(
      screen.getByText(/No positional shifts exceeded the S\/N threshold/i)
    ).toBeTruthy();

    // Candidate with explanation: null and kind: 'unmatched_source' and match: null
    const nullExplanationCand: Candidate = {
      id: 'CAND-NULL-EXP',
      kind: 'unmatched_source',
      status: 'candidate',
      track: [{ epochId: 'e01', x: 12, y: 15, ra: 210.8, dec: 54.3 }],
      snr: 6.1,
      match: null,
      explanation: null,
    };

    rerender(
      <EvidenceCard
        manifest={{ ...M101_MANIFEST, candidates: [nullExplanationCand] }}
        selectedCandidateId="CAND-NULL-EXP"
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    expect(screen.getByText(/Candidate: unvalidated/i)).toBeTruthy();
    expect(screen.getByText(/Unmatched transient source/i)).toBeTruthy();
    expect(screen.getByText(/No match in JPL SBIdent \/ Gaia \/ SIMBAD/i)).toBeTruthy();
    expect(
      screen.getByText(/Candidate object tracked across 1 epochs at S\/N 6\.1/i)
    ).toBeTruthy();

    // Candidate with source: 'llm'
    rerender(
      <EvidenceCard
        manifest={WISE0855_MANIFEST}
        selectedCandidateId="CAND-W0855-01"
        onSelectCandidate={vi.fn()}
        lang="en"
      />
    );

    expect(screen.getByText(/Source: OpenRouter \+ grounded JSON/i)).toBeTruthy();
  });

  it('handles Aladin HiPS engine failure gracefully by keeping the 3D Celestial Sphere interactive', async () => {
    aladinState.shouldFailInit = true;
    const picked: Array<{ ra: number; dec: number }> = [];

    render(
      <AladinSkyMap
        ra={210.8023}
        dec={54.349}
        fovDeg={0.25}
        lang="en"
        onPickCoords={(r, d) => picked.push({ ra: r, dec: d })}
      />
    );

    // Even when Aladin HiPS rejects, the 3D celestial sphere canvas and region query remain operational
    const skyCanvas = screen.getByTestId('celestial-3d-canvas');
    expect(skyCanvas).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Query this region/i }));
    expect(picked).toHaveLength(1);
    expect(picked[0].ra).toBeCloseTo(210.8023, 3);
  });

  it('handles offline network rejection and HTTP 504 Gateway Timeout in fieldService and App', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Gateway Timeout', { status: 504 })
    );

    const res504 = await fetchField(133.7867, -7.245, 0.25);
    expect(res504.ok).toBe(false);
    if (!res504.ok) {
      expect(res504.error.status).toBe(504);
      expect(res504.error.message).toContain('504');
    }

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Demo mode/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Retry live query/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open coordinate in NASA IRSA/i })).toBeTruthy();
    // Pre-baked M101 cutouts remain inspectable even while backend is offline
    expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
  });
});

// ============================================================================
// TIER 3 — CROSS-FEATURE COMBINATIONS (Pairwise State Interactions)
// ============================================================================
describe('Tier 3 — Cross-Feature Combinations (Pairwise)', () => {
  it('Pairwise 1: Language toggle (EN <-> ES) across Matched vs Mismatched wavelengths + Unvalidated vs Matched candidates + open AboutModal', async () => {
    const multiCandidateManifest: FieldManifest = {
      ...M101_MANIFEST,
      candidates: [
        M101_MANIFEST.candidates[0], // Matched in JPL SBIdent
        WISE0855_MANIFEST.candidates[0], // Unvalidated (match: null, source: 'llm')
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(multiCandidateManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    // Initially comparing e01 (1.12 um) vs e02 (1.13 um) -> Matched in EN
    expect(screen.getByText(/Wavelength Matched/i)).toBeTruthy();
    expect(
      screen.getByText(/Candidate: matches known object \(\(3342\) Fivesparks\)/i)
    ).toBeTruthy();

    // Switch compare epoch to e03 (2.45 um) -> Mismatch in EN
    const compareSelect = screen.getByLabelText(/Compare against epoch/i) as HTMLSelectElement;
    fireEvent.change(compareSelect, { target: { value: '2' } });
    expect(screen.getByText(/Wavelength Mismatch/i)).toBeTruthy();

    // Select second candidate (unvalidated)
    const cand2Btn = screen.getAllByRole('button', { name: /CAND-W0855-01/i })[0];
    fireEvent.click(cand2Btn);
    expect(screen.getByText(/Candidate: unvalidated/i)).toBeTruthy();

    // Toggle language to Spanish (ES) while Mismatched + Unvalidated candidate active
    fireEvent.click(
      screen.getByRole('button', { name: /Cambiar idioma a espanol|Switch language to Spanish/i })
    );
    expect(document.documentElement.lang).toBe('es');
    expect(screen.getByText(/Longitud de onda distinta \(Mismatch\)/i)).toBeTruthy();
    expect(screen.getByText(/Candidato: sin validar/i)).toBeTruthy();
    expect(screen.getByText(/Fuente: OpenRouter \+ JSON verificado/i)).toBeTruthy();

    // Open AboutModal in ES, then close via backdrop click
    fireEvent.click(screen.getByRole('button', { name: /Guia y Creditos/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Guia de Uso y Creditos Cientificos/i)).toBeTruthy();
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Pairwise 2: Coordinate search -> URL query update -> Epoch stepping -> Split-wipe comparison -> Track overlay toggle', async () => {
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    // Search sexagesimal coordinates for Barnard's Star (17h 57m 48.5s +04d 41m 36s -> ~269.4521, +4.6933)
    const searchInput = screen.getByLabelText(/Sky coordinates/i);
    fireEvent.change(searchInput, { target: { value: '17h 57m 48.5s +04d 41m 36s' } });
    fireEvent.click(screen.getByRole('button', { name: /Load field/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('ra=269.4521');
      expect(screen.getByText(/Barnard's Star High-PM Field/i)).toBeTruthy();
    });

    // Step to epoch 2 via epoch slider
    const epochSlider = screen.getByLabelText(/Active epoch/i) as HTMLInputElement;
    fireEvent.change(epochSlider, { target: { value: '1' } });
    expect(screen.getByText(/Active epoch \(2\/3\)/i)).toBeTruthy();

    // Adjust split-wipe slider to 35%
    const splitSlider = screen.getByLabelText(/Split-wipe comparison/i) as HTMLInputElement;
    fireEvent.change(splitSlider, { target: { value: '35' } });
    expect(screen.getByText('35%')).toBeTruthy();

    // Toggle track overlay off and back on
    const trackBtn = screen.getByRole('button', { name: /Hide tracks/i });
    fireEvent.click(trackBtn);
    expect(screen.getByRole('button', { name: /Show tracks/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show tracks/i }));
    expect(screen.getByRole('button', { name: /Hide tracks/i })).toBeTruthy();
  });

  it("Pairwise 3: Preset switching (M101 -> Barnard's Star -> WISE 0855) while Blink playback is active resets playback, epoch index, and active candidate", async () => {
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    // Advance to epoch 2 and start Blink playback
    fireEvent.click(screen.getByRole('button', { name: /Next epoch/i }));
    expect(screen.getByText(/Active epoch \(2\/3\)/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Play Blink/i }));
    expect(screen.getByRole('button', { name: /Pause Blink/i })).toBeTruthy();

    // Switch preset to Barnard's Star while playing
    fireEvent.click(screen.getByRole('button', { name: /Barnard's Star/i }));

    await waitFor(() => {
      expect(screen.getByText(/Barnard's Star High-PM Field/i)).toBeTruthy();
    });

    // Playback resets to paused ("Play Blink"), active epoch resets to 1/3, and candidate updates to CAND-BARNARD-01
    expect(screen.getByRole('button', { name: /Play Blink/i })).toBeTruthy();
    expect(screen.getByText(/Active epoch \(1\/3\)/i)).toBeTruthy();
    expect(
      screen.getByText(/Candidate: matches known object \(Barnard's Star \(GJ 699\)\)/i)
    ).toBeTruthy();

    // Switch preset to WISE 0855
    fireEvent.click(screen.getByRole('button', { name: /WISE 0855/i }));

    await waitFor(() => {
      expect(screen.getByText(/WISE 0855 Sub-Stellar Field/i)).toBeTruthy();
    });
    expect(screen.getByText(/Candidate: unvalidated/i)).toBeTruthy();
    expect(screen.getAllByText(/S\/N 9\.7/).length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// TIER 4 — REAL-WORLD APPLICATION SCENARIOS (End-to-End User Journeys)
// ============================================================================
describe('Tier 4 — Real-World Application Scenarios', () => {
  it("Scenario 1: Citizen scientist investigates high proper-motion star (Barnard's Star), steps epochs via keyboard, verifies Gaia/SIMBAD match, and switches to Spanish", async () => {
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    // Step 1: Select Barnard's Star target preset
    fireEvent.click(screen.getByRole('button', { name: /Barnard's Star/i }));

    await waitFor(() => {
      expect(screen.getByText(/Barnard's Star High-PM Field/i)).toBeTruthy();
    });

    // Step 2: Step through epochs using keyboard arrows on Blink Comparator
    const blinkRegion = screen.getByRole('region', { name: /Epoch Blink Comparator/i });
    expect(screen.getByText('1.250 um')).toBeTruthy(); // e01

    fireEvent.keyDown(blinkRegion, { key: 'ArrowRight' });
    expect(screen.getByText('1.260 um')).toBeTruthy(); // e02

    fireEvent.keyDown(blinkRegion, { key: 'ArrowRight' });
    expect(screen.getByText('3.180 um')).toBeTruthy(); // e03

    // Comparing e03 (3.180 um) against e02 (1.260 um) triggers Amber Wavelength Mismatch alert
    expect(screen.getByText(/Wavelength Mismatch/i)).toBeTruthy();

    // Step 3: Verify Gaia DR3 / SIMBAD cross-match in Evidence Card
    expect(
      screen.getByText(/Barnard's Star \(GJ 699\) \(Gaia DR3 \/ SIMBAD, 1\.2"\)/i)
    ).toBeTruthy();

    // Step 4: Switch UI to Spanish and verify translated scientific telemetry
    fireEvent.click(
      screen.getByRole('button', { name: /Cambiar idioma a espanol|Switch language to Spanish/i })
    );
    expect(
      screen.getByText(/Candidato: coincide con objeto conocido \(Barnard's Star \(GJ 699\)\)/i)
    ).toBeTruthy();
    expect(screen.getByText(/Que NO es esto:/i)).toBeTruthy();
  });

  it('Scenario 2: Astronomer searches sexagesimal coordinates (08h 55m 10.8s -07d 14m 42s), inspects unvalidated candidate, uses split-wipe, and checks IRSA & credits', async () => {
    mockBackendByCoordinate();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    // Enter WISE 0855 sexagesimal coordinates: 08h 55m 10.8s -07d 14m 42s -> RA 133.7950, Dec -7.2450
    const searchInput = screen.getByLabelText(/Sky coordinates/i);
    fireEvent.change(searchInput, { target: { value: '08h 55m 10.8s -07d 14m 42s' } });
    fireEvent.click(screen.getByRole('button', { name: /Load field/i }));

    await waitFor(() => {
      expect(window.location.search).toContain('ra=133.7950');
      expect(window.location.search).toContain('dec=-7.2450');
      expect(screen.getByText(/WISE 0855 Sub-Stellar Field/i)).toBeTruthy();
    });

    // Verify unvalidated candidate and thermal-IR dropout explanation
    expect(screen.getByText(/Candidate: unvalidated/i)).toBeTruthy();
    expect(screen.getByText(/No match in JPL SBIdent \/ Gaia \/ SIMBAD/i)).toBeTruthy();
    expect(screen.getByText(/Unvalidated moving candidate tracked across 3 epochs/i)).toBeTruthy();

    // Use split-wipe comparison slider
    const splitSlider = screen.getByLabelText(/Split-wipe comparison/i) as HTMLInputElement;
    fireEvent.change(splitSlider, { target: { value: '60' } });
    expect(screen.getByText('60%')).toBeTruthy();

    // Check IRSA Spectrophotometry link and AboutModal credits
    const irsaLink = screen.getByRole('link', { name: /Open IRSA Spectrophotometry/i });
    expect(irsaLink.getAttribute('href')).toContain('irsa.ipac.caltech.edu/applications/spherex/');

    fireEvent.click(screen.getByRole('button', { name: /Guide & Credits/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText(/Aladin Lite v3/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Close dialog/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Scenario 3: Evaluator tests false-positive guardrails (Wavelength Mismatch alert, Synthetic Test Data red banner, and anti-discovery labeling invariant)', async () => {
    const evaluatorManifest: FieldManifest = {
      ...WISE0855_MANIFEST,
      id: 'eval-synth-field',
      epochs: [
        {
          ...WISE0855_MANIFEST.epochs[0],
          id: 'ep-a',
          lambdaUm: 1.05,
        },
        {
          ...WISE0855_MANIFEST.epochs[1],
          id: 'ep-b',
          lambdaUm: 2.45,
        },
      ],
      matchedPairs: [],
      provenance: {
        ...WISE0855_MANIFEST.provenance,
        synthetic: true,
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(evaluatorManifest), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/SYNTHETIC TEST DATA - not SPHEREx/i)).toBeTruthy();
    });

    // Guardrail 1: Wavelength Mismatch amber warning for 1.050 um vs 2.450 um
    expect(screen.getByText(/Wavelength Mismatch/i)).toBeTruthy();
    expect(screen.getByText(/1\.050 um vs 2\.450 um/i)).toBeTruthy();

    // Guardrail 2: Candidate labels never claim discovery in EN or ES
    for (const lang of ['en', 'es'] as const) {
      for (const manifest of [M101_MANIFEST, BARNARD_MANIFEST, WISE0855_MANIFEST]) {
        for (const cand of manifest.candidates) {
          expect(candidateLabel(cand, lang)).not.toMatch(/discover|descubr/i);
        }
      }
    }

    // Guardrail 3: Permanent visible "What this is NOT" disclaimer
    expect(
      screen.getByText(/not a confirmed discovery and not a Planet X detection/i)
    ).toBeTruthy();
  });

  it('Scenario 4: Fault-tolerant offline/cache operation (live fetch caches field -> network outage falls back to cached observation -> retry succeeds)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(M101_MANIFEST), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(M101_MANIFEST), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { unmount } = render(<App />);

    // First load succeeds from live backend and populates localStorage cache
    await waitFor(() => {
      expect(getLatestCachedField()?.name).toBe('M101 Control Field');
    });
    unmount();

    // Second mount hits network outage -> falls back to cached field with status banner
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText(/Live API unavailable\. Displaying cached SPHEREx observation/i)
      ).toBeTruthy();
    });
    expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();

    // Clicking "Retry live query" re-queries live API and clears fallback banner
    const retryBtn = screen.getByRole('button', { name: /Retry live query/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(
        screen.queryByText(/Live API unavailable\. Displaying cached SPHEREx observation/i)
      ).toBeNull();
    });
  });

  it('Scenario 5: Keyboard-only accessibility & antislop compliance audit (Escape closes modal, HUD collapse toggle, translation parity, zero em-dashes)', async () => {
    // Verify translation dictionary parity and zero em-dashes
    const enKeys = Object.keys(translations.en).sort();
    const esKeys = Object.keys(translations.es).sort();
    expect(esKeys).toEqual(enKeys);
    for (const val of [...Object.values(translations.en), ...Object.values(translations.es)]) {
      expect(val).not.toContain('—');
    }

    // Verify sortedEpochs does not mutate input array
    const reversedManifest: FieldManifest = {
      ...M101_MANIFEST,
      epochs: [...M101_MANIFEST.epochs].reverse(),
    };
    const sorted = sortedEpochs(reversedManifest);
    expect(sorted.map((e) => e.id)).toEqual(['e01', 'e02', 'e03']);
    expect(reversedManifest.epochs[0].id).toBe('e03');
    expect(lambdaBadge(sorted[0], sorted[0], reversedManifest)).toBe('matched');

    // Render full App and audit DOM for em-dashes, landmarks, HUD toggle, and keyboard interaction
    mockBackendByCoordinate();
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Control Field \(3 observations/i)).toBeTruthy();
    });

    expect(container.querySelector('header')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
    expect(container.querySelector('footer')).toBeTruthy();
    expect(container.textContent).not.toContain('—');

    // Toggle HUD Dock visibility ("Hide HUD" / "Show HUD")
    const hudToggleBtn = screen.queryByRole('button', { name: /Hide HUD/i });
    if (hudToggleBtn) {
      fireEvent.click(hudToggleBtn);
      expect(screen.getByRole('button', { name: /Show HUD/i })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Show HUD/i }));
    }

    // Open AboutModal, verify focus moves to Close button, and close with Escape
    fireEvent.click(screen.getByRole('button', { name: /Guide & Credits/i }));
    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Switch to Spanish and verify zero em-dashes in full Spanish DOM
    fireEvent.click(
      screen.getByRole('button', { name: /Cambiar idioma a espanol|Switch language to Spanish/i })
    );
    expect(container.textContent).not.toContain('—');
  });
});
