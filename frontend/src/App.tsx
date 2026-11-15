import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AboutModal } from './components/AboutModal/AboutModal';
import { BlinkCanvas } from './components/BlinkViewer/BlinkCanvas';
import { AladinSkyMap } from './components/CelestialViewer/AladinSkyMap';
import { EvidenceCard } from './components/EvidenceCard/EvidenceCard';
import { getCuratedOrFallbackManifest } from './data/curatedFields';
import { translations } from './i18n/translations';
import { fetchField } from './services/fieldService';
import type { FieldError, FieldManifest, ViewState } from './types/spherex';
import { formatView, normalizeRa, parseCoords, parseView } from './utils/coordinates';

interface TargetPreset {
  id: string;
  labelEn: string;
  labelEs: string;
  ra: number;
  dec: number;
  fovDeg: number;
}

const TARGET_PRESETS: TargetPreset[] = [
  {
    id: 'm101',
    labelEn: 'M101 Control Field',
    labelEs: 'M101 Campo Control',
    ra: 210.8023,
    dec: 54.349,
    fovDeg: 0.25,
  },
  {
    id: 'barnard',
    labelEn: "Barnard's Star",
    labelEs: 'Estrella de Barnard',
    ra: 269.4521,
    dec: 4.6934,
    fovDeg: 0.25,
  },
  {
    id: 'wise0855',
    labelEn: 'WISE 0855',
    labelEs: 'WISE 0855',
    ra: 133.7867,
    dec: -7.245,
    fovDeg: 0.25,
  },
];

export function App() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [view, setView] = useState<ViewState>(() => parseView(window.location.search));
  const [coordInput, setCoordInput] = useState(
    () =>
      `${parseView(window.location.search).ra.toFixed(4)} ${parseView(
        window.location.search
      ).dec.toFixed(4)}`
  );
  const [coordError, setCoordError] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [hudOpen, setHudOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState<FieldManifest | null>(() =>
    getCuratedOrFallbackManifest(
      parseView(window.location.search).ra,
      parseView(window.location.search).dec,
      parseView(window.location.search).fovDeg
    )
  );
  const [cachedNotice, setCachedNotice] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [latestCached, setLatestCached] = useState<FieldManifest | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    () =>
      getCuratedOrFallbackManifest(
        parseView(window.location.search).ra,
        parseView(window.location.search).dec,
        parseView(window.location.search).fovDeg
      ).candidates[0]?.id ?? null
  );
  const abortRef = useRef<AbortController | null>(null);

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const loadTarget = useCallback(async (nextView: ViewState) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setFieldError(null);
    setCachedNotice(false);

    try {
      const result = await fetchField(
        nextView.ra,
        nextView.dec,
        nextView.fovDeg,
        controller.signal
      );
      if (controller.signal.aborted) return;

      if (result.ok) {
        setManifest(result.manifest);
        setCachedNotice(result.cachedNotice);
        setSelectedCandidateId(result.manifest.candidates[0]?.id ?? null);
        setFieldError(null);
        setLatestCached(null);
      } else {
        const curatedFallback = getCuratedOrFallbackManifest(
          nextView.ra,
          nextView.dec,
          nextView.fovDeg
        );
        setManifest(curatedFallback);
        setSelectedCandidateId(curatedFallback.candidates[0]?.id ?? null);
        setFieldError(result.error);
        setLatestCached(result.latestCached);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const curatedFallback = getCuratedOrFallbackManifest(
        nextView.ra,
        nextView.dec,
        nextView.fovDeg
      );
      setManifest(curatedFallback);
      setSelectedCandidateId(curatedFallback.candidates[0]?.id ?? null);
      setFieldError({
        status: 0,
        message: err instanceof Error ? err.message : 'Unexpected query failure',
        fallbackAvailable: true,
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTarget(view);
    window.history.replaceState(null, '', formatView(view));
    return () => {
      abortRef.current?.abort();
    };
  }, [view, loadTarget]);

  const applyView = (ra: number, dec: number, fovDeg = view.fovDeg) => {
    const cleanRa = Number(normalizeRa(ra).toFixed(4));
    const cleanDec = Number(dec.toFixed(4));
    setCoordError(null);
    setCoordInput(`${cleanRa} ${cleanDec}`);
    setView({ ra: cleanRa, dec: cleanDec, fovDeg });
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseCoords(coordInput);
    if (!parsed) {
      setCoordError(t.searchError);
      return;
    }
    applyView(parsed.ra, parsed.dec, view.fovDeg);
  };

  const handleLoadLatestCached = () => {
    if (!latestCached) return;
    setManifest(latestCached);
    setCachedNotice(true);
    setFieldError(null);
    setSelectedCandidateId(latestCached.candidates[0]?.id ?? null);
    setCoordInput(`${latestCached.ra.toFixed(4)} ${latestCached.dec.toFixed(4)}`);
  };

  const activeCandidate =
    manifest?.candidates.find((c) => c.id === selectedCandidateId) ??
    manifest?.candidates[0] ??
    null;

  const irsaDirectUrl = `https://irsa.ipac.caltech.edu/applications/spherex/?ra=${view.ra.toFixed(
    4
  )}&dec=${view.dec.toFixed(4)}`;

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-obsidian text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accentAmber focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-obsidian"
      >
        {t.skipToContent}
      </a>

      {/* Primary Focal Point: 100% Viewport Interactive 3D/WebGL2 Celestial Viewer */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <AladinSkyMap
          ra={view.ra}
          dec={view.dec}
          fovDeg={view.fovDeg}
          lang={lang}
          activeCandidate={activeCandidate}
          onPickCoords={(ra, dec) => applyView(ra, dec)}
          onSelectRegion={(ra, dec, fov) => applyView(ra, dec, fov)}
        />
      </div>

      {/* Floating HUD Shell 1 of 2 (R-10 Dose Cap): Top Navigation & Coordinate Search Bar */}
      <header className="pointer-events-auto relative z-30 mx-2.5 mt-2 rounded-lg border border-instrumentBorder bg-instrument/90 px-3 py-1.5 shadow-lg backdrop-blur-md sm:mx-4 sm:px-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-accentAmber/80 bg-obsidian font-mono text-[11px] font-bold text-accentAmber"
              aria-hidden="true"
            >
              3D
            </span>
            <div>
              <h1 className="text-xs font-semibold tracking-tight text-slate-100 sm:text-sm">
                {t.appTitle}
              </h1>
              <p className="text-[10px] text-slate-300">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="order-3 flex w-full flex-wrap items-center justify-between gap-1.5 xl:order-2 xl:w-auto xl:justify-start">
            <form
              onSubmit={handleSearchSubmit}
              noValidate
              className="flex items-center gap-1.5"
            >
              <label
                htmlFor="coord-search"
                className="sr-only 2xl:not-sr-only 2xl:text-xs 2xl:font-medium 2xl:text-slate-200"
              >
                {t.searchLabel}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="coord-search"
                  name="coordinates"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={coordInput}
                  onChange={(e) => {
                    setCoordInput(e.target.value);
                    if (coordError) setCoordError(null);
                  }}
                  placeholder={t.searchPlaceholder}
                  aria-invalid={coordError !== null}
                  aria-describedby={coordError ? 'coord-search-error' : undefined}
                  className="min-h-[44px] w-[195px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-400 sm:w-[225px]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] shrink-0 rounded-md bg-accentAmber px-3 py-2 text-xs font-semibold text-obsidian hover:bg-amber-400 active:scale-[0.98] active:bg-amber-500"
                >
                  {t.searchSubmit}
                </button>
              </div>
            </form>

            <div
              role="group"
              aria-label={t.presetsLabel}
              className="flex flex-wrap items-center gap-1"
            >
              <span className="hidden text-xs text-slate-300 2xl:inline">{t.presetsLabel}</span>
              {TARGET_PRESETS.map((preset) => {
                const isSelected =
                  Math.abs(view.ra - preset.ra) < 0.01 &&
                  Math.abs(view.dec - preset.dec) < 0.01;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyView(preset.ra, preset.dec, preset.fovDeg)}
                    aria-pressed={isSelected}
                    className={`min-h-[44px] rounded-md border px-2.5 text-xs active:scale-[0.98] ${
                      isSelected
                        ? 'border-accentAmber bg-amber-950/80 font-semibold text-amber-200'
                        : 'border-instrumentBorder bg-obsidian text-slate-200 hover:border-amber-400'
                    }`}
                  >
                    {lang === 'es' ? preset.labelEs : preset.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <nav
            aria-label={lang === 'es' ? 'Utilidades del observatorio' : 'Observatory utilities'}
            className="order-2 flex flex-wrap items-center gap-1.5 xl:order-3"
          >
            <button
              type="button"
              onClick={() => setHudOpen((prev) => !prev)}
              aria-expanded={hudOpen}
              aria-controls="main-content"
              className="min-h-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-medium text-amber-300 hover:border-amber-400 active:scale-[0.98]"
            >
              {hudOpen ? t.hideHud : t.showHud}
            </button>

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'es' : 'en'))}
              aria-label={t.langAria}
              className="min-h-[44px] min-w-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-semibold text-slate-100 hover:border-amber-400 active:scale-[0.98]"
            >
              {t.langSwitch}
            </button>

            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="min-h-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-medium text-slate-100 hover:border-amber-400 active:scale-[0.98]"
            >
              {t.aboutButton}
            </button>
          </nav>
        </div>

        {coordError && (
          <p id="coord-search-error" role="alert" className="mt-1.5 text-xs font-medium text-red-300">
            {coordError}
          </p>
        )}
      </header>

      {/* Floating HUD Shell 2 of 2 (R-10 Dose Cap): Collapsible Scientific Inspector HUD Dock */}
      <main
        id="main-content"
        aria-hidden={!hudOpen}
        className={`pointer-events-auto fixed bottom-9 right-2.5 top-[44vh] z-30 flex w-[calc(100vw-20px)] max-w-[535px] flex-col gap-2 overflow-y-auto rounded-lg border border-instrumentBorder bg-instrument/90 p-3 shadow-2xl backdrop-blur-md sm:right-4 sm:top-[118px] xl:top-[70px] ${
          hudOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 rounded-md border border-instrumentBorder bg-obsidian px-3 py-1.5 text-xs text-slate-200"
          >
            <span className="font-mono tabular-nums">
              {t.loadingField} (RA {view.ra.toFixed(4)} deg, Dec {view.dec.toFixed(4)} deg)
            </span>
          </div>
        )}

        {cachedNotice && !loading && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/80 bg-amber-950/90 px-3 py-1.5 text-xs text-amber-100"
          >
            <span>{t.fallbackBanner}</span>
            <button
              type="button"
              onClick={() => loadTarget(view)}
              className="min-h-[44px] rounded border border-amber-400 bg-obsidian px-3 text-xs font-medium text-amber-200 hover:border-amber-300"
            >
              {t.retryButton}
            </button>
          </div>
        )}

        {!loading && fieldError && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-instrumentBorder/60 bg-obsidian/70 px-3 py-1.5 text-xs text-slate-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              {t.offlineTitle} · {t.activeTargetLabel} {view.ra.toFixed(4)}°, {view.dec.toFixed(4)}°
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadTarget(view)}
                className="min-h-[44px] rounded border border-instrumentBorder bg-obsidian px-2 text-[10px] text-slate-300 hover:border-amber-400"
              >
                {t.retryButton}
              </button>
              {latestCached && (
                <button
                  type="button"
                  onClick={handleLoadLatestCached}
                  className="min-h-[44px] rounded border border-instrumentBorder bg-obsidian px-2 text-[10px] text-slate-300 hover:border-amber-400"
                >
                  {t.loadLatestCached}
                </button>
              )}
              <a
                href={irsaDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded border border-instrumentBorder bg-obsidian px-2 text-[10px] text-amber-300 hover:border-amber-400"
              >
                {t.openIrsaDirect}
              </a>
            </div>
          </div>
        )}

        {manifest && (
          <>
            <BlinkCanvas
              manifest={manifest}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={setSelectedCandidateId}
              lang={lang}
            />
            <EvidenceCard
              manifest={manifest}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={setSelectedCandidateId}
              lang={lang}
            />
          </>
        )}
      </main>

      {/* Bottom-Left Mandatory Credit Status Pill */}
      <footer className="pointer-events-auto fixed bottom-2 left-2.5 z-20 flex max-w-[calc(100vw-20px)] flex-wrap items-center gap-3 rounded-md border border-instrumentBorder bg-obsidian/95 px-3 py-1 text-[11px] text-slate-300 sm:left-4">
        <p>{t.nasaCredit}</p>
        <p className="hidden sm:inline">Aladin Lite v3 (CDS Strasbourg) | SVDV Apache-2.0</p>
      </footer>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} lang={lang} />
    </div>
  );
}

export default App;
