import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { FieldManifest } from './types/spherex';

vi.mock('./components/CelestialViewer/AladinSkyMap', () => ({
  AladinSkyMap: ({
    ra,
    dec,
    onPickCoords,
    onSelectRegion,
  }: {
    ra: number;
    dec: number;
    onPickCoords?: (ra: number, dec: number) => void;
    onSelectRegion?: (ra: number, dec: number, fovDeg: number) => void;
  }) => (
    <div data-testid="aladin-mock">
      <span>
        SkyMap {ra.toFixed(4)} {dec.toFixed(4)}
      </span>
      <button
        type="button"
        onClick={() => {
          onPickCoords?.(150.1234, -12.3456);
          onSelectRegion?.(150.1234, -12.3456, 0.25);
        }}
      >
        Query mocked map center
      </button>
    </div>
  ),
}));

const LIVE_MANIFEST: FieldManifest = {
  schemaVersion: '1.0',
  id: 'field-210.802-54.349',
  name: 'M101 Test Field',
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
      frameUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      sourceUrl: 'https://irsa.ipac.caltech.edu/ep1',
    },
    {
      id: 'ep-2',
      obsId: 'spherex_qr3_002',
      utc: '2026-03-18T11:20:00Z',
      release: 'qr3',
      detector: 2,
      lambdaUm: 1.55,
      bandwidthUm: 0.04,
      frameUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      sourceUrl: 'https://irsa.ipac.caltech.edu/ep2',
    },
  ],
  matchedPairs: [],
  candidates: [
    {
      id: 'CAND-001',
      kind: 'moved_source',
      status: 'candidate',
      track: [
        { epochId: 'ep-1', x: 20, y: 20, ra: 210.8, dec: 54.34 },
        { epochId: 'ep-2', x: 25, y: 24, ra: 210.81, dec: 54.35 },
      ],
      snr: 8.4,
      match: null,
      explanation: {
        text: 'Tracked across 2 epochs at S/N 8.4 with no match in JPL SBIdent.',
        source: 'template',
      },
    },
  ],
  message: null,
  provenance: {
    collection: 'spherex_dr1, spherex_qr3',
    retrievedUtc: '2026-04-01T00:00:00Z',
    synthetic: false,
    credit: 'SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive',
  },
};

describe('App interactive click-through', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: false,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'center',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows offline error state with Retry and IRSA link AND renders curated SPHEREx fallback when backend is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    render(<App />);
    expect(screen.getByText(/Querying live SPHEREx field data/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/Live SPHEREx backend unreachable/i)).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /Retry live query/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open coordinate in NASA IRSA/i })).toBeTruthy();

    // Curated fallback keeps Blink Comparator, Wavelength Badge, and Evidence Card interactive offline
    expect(screen.getByText(/Epoch Blink Comparator/i)).toBeTruthy();
    expect(screen.getByText(/Wavelength Matched/i)).toBeTruthy();
    expect(screen.getByText(/not a confirmed discovery/i)).toBeTruthy();
  });

  it('exercises search validation, presets, blink controls, candidate evidence, HUD toggle, i18n, and modal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(LIVE_MANIFEST), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/M101 Test Field/i)).toBeTruthy();
    });

    // Wavelength mismatch warning shown for 1.05 um vs 1.55 um
    expect(screen.getByText(/Wavelength Mismatch/i)).toBeTruthy();

    // Blink controls: Play/Pause, Next/Prev, FPS select, Track toggle
    const playBtn = screen.getByRole('button', { name: /Play Blink/i });
    fireEvent.click(playBtn);
    expect(screen.getByRole('button', { name: /Pause Blink/i })).toBeTruthy();

    const nextBtn = screen.getByRole('button', { name: /Next epoch/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Active epoch \(2\/2\)/i)).toBeTruthy();

    const tracksBtn = screen.getByRole('button', { name: /Hide tracks/i });
    fireEvent.click(tracksBtn);
    expect(screen.getByRole('button', { name: /Show tracks/i })).toBeTruthy();

    // Evidence card + disclaimer
    expect(screen.getByText(/Candidate: unvalidated/i)).toBeTruthy();
    expect(screen.getByText(/not a confirmed discovery/i)).toBeTruthy();

    // FPS select and split-wipe slider
    const fpsSelect = screen.getByLabelText(/Blink speed/i) as HTMLSelectElement;
    fireEvent.change(fpsSelect, { target: { value: '4' } });
    expect(fpsSelect.value).toBe('4');

    const splitSlider = screen.getByLabelText(/Split-wipe comparison/i) as HTMLInputElement;
    fireEvent.change(splitSlider, { target: { value: '50' } });
    expect(screen.getByText('50%')).toBeTruthy();

    // HUD Dock collapse/expand toggle
    const hideHudBtn = screen.getByRole('button', { name: /Hide HUD/i });
    fireEvent.click(hideHudBtn);
    expect(screen.getByRole('button', { name: /Show HUD/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show HUD/i }));

    // Invalid coordinate search shows validation error
    const searchInput = screen.getByLabelText(/Sky coordinates/i);
    fireEvent.change(searchInput, { target: { value: 'invalid coords' } });
    fireEvent.click(screen.getByRole('button', { name: /Load field/i }));
    expect(screen.getByText(/Invalid coordinates/i)).toBeTruthy();

    // Valid preset triggers fetch and updates URL query params
    fireEvent.click(screen.getByRole('button', { name: /Barnard's Star/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(window.location.search).toContain('ra=269.4521');
    });

    // Language toggle switches EN -> ES
    fireEvent.click(screen.getByRole('button', { name: /Cambiar idioma a espanol/i }));
    expect(screen.getByText(/Explorador infrarrojo multiepoca/i)).toBeTruthy();
    expect(document.documentElement.lang).toBe('es');

    // AboutModal opens and closes via Escape
    fireEvent.click(screen.getByRole('button', { name: /Guia y Creditos/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
