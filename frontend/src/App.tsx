import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AboutModal } from './components/AboutModal/AboutModal';
import { BandControls } from './components/BandControls';
import { BlinkCanvas } from './components/BlinkViewer/BlinkCanvas';
import { AladinSkyMap } from './components/CelestialViewer/AladinSkyMap';
import { SvdvIcon } from './components/common/Logo';
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
  const [fovInput, setFovInput] = useState(() =>
    parseView(window.location.search).fovDeg.toFixed(2)
  );
  const [selectedBandChannel, setSelectedBandChannel] = useState(23);
  const [selectedEpochId, setSelectedEpochId] = useState<string | null>(null);
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
    const cleanFov = Number(Math.max(0.05, Math.min(10.0, fovDeg)).toFixed(2));
    setCoordError(null);
    setCoordInput(`${cleanRa} ${cleanDec}`);
    setFovInput(`${cleanFov}`);
    setView({ ra: cleanRa, dec: cleanDec, fovDeg: cleanFov });
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseCoords(coordInput);
    if (!parsed) {
      setCoordError(t.searchError);
      return;
    }
    const numFov = Number(fovInput);
    const effectiveFov =
      parsed.fov ??
      (Number.isFinite(numFov) && numFov > 0 && numFov <= 10.0 ? numFov : view.fovDeg);
    applyView(parsed.ra, parsed.dec, effectiveFov);
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
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#090d13] text-slate-200 font-sans flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-slate-200 focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-semibold focus:text-slate-900"
      >
        {t.skipToContent}
      </a>

      {/* Neutral Scientific Top Navigation Bar (in flex flow, takes natural height, never overlaps) */}
      <header className="pointer-events-auto shrink-0 z-30 border-b border-[#222a36] bg-[#10151e]/98 px-3 py-1.5 shadow-sm sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Logo & Application Brand */}
          <div className="flex items-center gap-2">
            <SvdvIcon className="h-6 w-6 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold tracking-wider text-slate-100">
                  SVDV
                </span>
                <span className="text-slate-600">/</span>
                <h1 className="text-xs font-semibold text-slate-200 sm:text-sm">
                  {t.appTitle}
                </h1>
              </div>
              <p className="font-mono text-[10px] text-slate-400">{t.appSubtitle}</p>
            </div>
          </div>

          {/* Central Coordinate Search & Target Presets */}
          <div className="order-3 flex w-full flex-wrap items-center justify-between gap-1.5 xl:order-2 xl:w-auto xl:justify-start">
            <form
              onSubmit={handleSearchSubmit}
              noValidate
              className="flex items-center gap-1.5"
            >
              <label
                htmlFor="coord-search"
                className="sr-only 2xl:not-sr-only font-mono text-[11px] text-slate-400"
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
                  className="min-h-[34px] w-[180px] rounded border border-[#2a3444] bg-[#090d13] px-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none sm:w-[220px]"
                />
                <div className="flex items-center gap-1 rounded border border-[#2a3444] bg-[#090d13] px-2 min-h-[34px]">
                  <label htmlFor="fov-search" className="font-mono text-[11px] text-slate-400">
                    {t.fovLabel}
                  </label>
                  <input
                    id="fov-search"
                    name="fov"
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="10.0"
                    value={fovInput}
                    onChange={(e) => setFovInput(e.target.value)}
                    aria-label={t.fovAria}
                    className="w-[48px] bg-transparent font-mono text-xs text-slate-100 focus:outline-none text-right"
                  />
                  <span className="font-mono text-xs text-slate-400">°</span>
                </div>
                <button
                  type="submit"
                  className="min-h-[34px] shrink-0 rounded border border-[#3b4759] bg-[#1a222e] px-3 font-mono text-xs font-medium text-slate-200 transition-colors hover:bg-[#232e3e] hover:text-white active:scale-[0.98]"
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
              <span className="hidden font-mono text-[11px] text-slate-400 2xl:inline">
                {t.presetsLabel}
              </span>
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
                    className={`min-h-[34px] rounded border px-2.5 font-mono text-xs transition-colors active:scale-[0.98] ${
                      isSelected
                        ? 'border-slate-400 bg-[#202936] font-medium text-white shadow-sm'
                        : 'border-[#222a36] bg-[#090d13] text-slate-300 hover:border-[#384659] hover:text-white'
                    }`}
                  >
                    {lang === 'es' ? preset.labelEs : preset.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Observatory Utilities */}
          <nav
            aria-label={lang === 'es' ? 'Utilidades del observatorio' : 'Observatory utilities'}
            className="order-2 flex flex-wrap items-center gap-1.5 xl:order-3"
          >
            <button
              type="button"
              onClick={() => setHudOpen((prev) => !prev)}
              aria-expanded={hudOpen}
              aria-controls="main-content"
              className="min-h-[34px] rounded border border-[#2a3444] bg-[#090d13] px-2.5 font-mono text-xs font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98]"
            >
              {hudOpen ? t.hideHud : t.showHud}
            </button>

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'es' : 'en'))}
              aria-label={t.langAria}
              className="min-h-[34px] min-w-[34px] rounded border border-[#2a3444] bg-[#090d13] px-2 font-mono text-xs font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98]"
            >
              {t.langSwitch}
            </button>

            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="min-h-[34px] rounded border border-[#2a3444] bg-[#090d13] px-2.5 font-mono text-xs font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98]"
            >
              {t.aboutButton}
            </button>
          </nav>
        </div>

        {coordError && (
          <p id="coord-search-error" role="alert" className="mt-1 font-mono text-xs font-medium text-red-400">
            {coordError}
          </p>
        )}
      </header>

      {/* Main Workspace Area (between Header and Footer, exactly 100% remaining height) */}
      <div className="relative flex-1 w-full overflow-hidden">
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

        {/* Docked Scientific Inspector Panel (starts right below header, stops right above footer) */}
        <main
          id="main-content"
          aria-hidden={!hudOpen}
          className={`pointer-events-auto absolute top-0 bottom-0 right-0 z-20 flex w-full max-w-[500px] xl:max-w-[520px] flex-col gap-2 overflow-y-auto border-l border-[#222a36] bg-[#10151e]/98 p-3 shadow-xl transition-all duration-150 ${
            hudOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
          }`}
        >
          {/* Subtle Telemetry Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-[#222a36] pb-1 font-mono text-[11px] text-slate-400 tabular-nums">
            <span>RA {view.ra.toFixed(4)}° Dec {view.dec.toFixed(4)}°</span>
            <div className="flex items-center gap-1.5">
              <span>FOV {view.fovDeg}°</span>
              <div className="flex items-center gap-1">
                {[0.1, 0.25, 0.5, 1.0].map((fVal) => (
                  <button
                    key={fVal}
                    type="button"
                    onClick={() => applyView(view.ra, view.dec, fVal)}
                    aria-label={`Set FOV to ${fVal} degrees`}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                      Math.abs(view.fovDeg - fVal) < 0.01
                        ? 'border border-amber-500/80 bg-[#251d10] font-bold text-amber-200'
                        : 'border border-[#2a3444] bg-[#090d13] text-slate-400 hover:border-slate-400 hover:text-white'
                    }`}
                  >
                    {fVal}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-between gap-2 rounded border border-[#222a36] bg-[#090d13] px-3 py-1.5 text-xs text-slate-300"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                <span className="font-mono tabular-nums">
                  {t.loadingField} (RA {view.ra.toFixed(4)} deg, Dec {view.dec.toFixed(4)} deg)
                </span>
              </div>
            </div>
          )}

          {cachedNotice && !loading && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-800/60 bg-[#17130b] px-3 py-1.5 text-xs text-amber-200/90"
            >
              <span className="font-mono text-[11px]">{t.fallbackBanner}</span>
              <button
                type="button"
                onClick={() => loadTarget(view)}
                className="min-h-[30px] rounded border border-amber-700/60 bg-[#090d13] px-2.5 font-mono text-xs text-amber-200 hover:bg-[#1a1711]"
              >
                {t.retryButton}
              </button>
            </div>
          )}

          {!loading && fieldError && (
            <div
              role="status"
              className="flex flex-col gap-1.5 rounded border border-[#222a36] bg-[#090d13] p-2.5 text-xs text-slate-400"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  {t.offlineTitle} · RA {view.ra.toFixed(4)}°, Dec {view.dec.toFixed(4)}°
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadTarget(view)}
                    className="min-h-[30px] rounded border border-[#2a3444] bg-[#141a24] px-2 font-mono text-[10px] text-slate-300 hover:border-slate-400"
                  >
                    {t.retryButton}
                  </button>
                  {latestCached && (
                    <button
                      type="button"
                      onClick={handleLoadLatestCached}
                      className="min-h-[30px] rounded border border-[#2a3444] bg-[#141a24] px-2 font-mono text-[10px] text-slate-300 hover:border-slate-400"
                    >
                      {t.loadLatestCached}
                    </button>
                  )}
                  <a
                    href={irsaDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[30px] items-center rounded border border-[#2a3444] bg-[#141a24] px-2 font-mono text-[10px] text-slate-300 hover:border-slate-400"
                  >
                    {t.openIrsaDirect}
                  </a>
                </div>
              </div>
              <p className="max-w-[70ch] text-[10px] leading-relaxed text-slate-400">{t.offlineHint}</p>
            </div>
          )}

          {manifest && (
            <>
              <BlinkCanvas
                manifest={manifest}
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={setSelectedCandidateId}
                lang={lang}
                selectedEpochId={selectedEpochId}
              />
              <BandControls
                manifest={manifest}
                selectedBandChannel={selectedBandChannel}
                onSelectChannel={setSelectedBandChannel}
                onSelectEpoch={setSelectedEpochId}
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
      </div>

      {/* Earthdata-style Bottom Scientific Status Bar (in flex flow, takes natural height, never overlaps) */}
      <footer className="pointer-events-auto shrink-0 h-7 z-30 flex items-center justify-between border-t border-[#222a36] bg-[#090d13] px-3 font-mono text-[11px] text-slate-400">
        <p className="truncate">{t.nasaCredit}</p>
        <div className="flex items-center gap-3">
          <span className="hidden xl:inline text-slate-500">
            @Lisamuelpe · @Sherlock_man · @daiko-dev
          </span>
          <span className="hidden xl:inline text-slate-600">|</span>
          <p className="hidden md:inline">Aladin Lite v3 (CDS Strasbourg) | SVDV Apache-2.0</p>
          <span className="hidden lg:inline text-slate-600">|</span>
          <span className="hidden lg:inline text-slate-300">
            RA {view.ra.toFixed(4)}° Dec {view.dec.toFixed(4)}°
          </span>
        </div>
      </footer>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} lang={lang} />
    </div>
  );
}

export default App;
