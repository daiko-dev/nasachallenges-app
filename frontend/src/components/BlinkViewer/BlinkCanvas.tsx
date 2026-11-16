import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Candidate, Epoch, FieldManifest } from '../../types/spherex';
import { lambdaBadge, sortedEpochs } from '../../utils/epochs';
import { WavelengthBadge } from './WavelengthBadge';

interface BlinkCanvasProps {
  manifest: FieldManifest;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  lang: 'en' | 'es';
  selectedEpochId?: string | null;
}

function getSafe2dContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

export function BlinkCanvas({
  manifest,
  selectedCandidateId,
  onSelectCandidate,
  lang,
  selectedEpochId,
}: BlinkCanvasProps) {
  const epochs = useMemo(() => sortedEpochs(manifest), [manifest]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState(epochs.length > 1 ? 1 : 0);
  const [splitPercent, setSplitPercent] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState<1 | 2 | 4>(2);
  const [showTracks, setShowTracks] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync with externally selected epoch from BandControls
  useEffect(() => {
    if (!selectedEpochId) return;
    const idx = epochs.findIndex((e) => e.id === selectedEpochId);
    if (idx !== -1) {
      setActiveIndex(idx);
      setIsPlaying(false);
    }
  }, [selectedEpochId, epochs]);

  // Reset indices when manifest changes
  useEffect(() => {
    setActiveIndex(0);
    setCompareIndex(epochs.length > 1 ? 1 : 0);
    setIsPlaying(false);
    setSplitPercent(100);
  }, [manifest.id, epochs.length]);

  // Preload frame PNGs/SVGs cleanly
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return;
    }
    let cancelled = false;
    setLoadedImages({});
    setFailedImages({});

    epochs.forEach((epoch) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        setLoadedImages((prev) => ({ ...prev, [epoch.id]: img }));
      };
      img.onerror = () => {
        if (cancelled) return;
        setFailedImages((prev) => ({ ...prev, [epoch.id]: true }));
      };
      img.src = epoch.frameUrl;
    });

    return () => {
      cancelled = true;
    };
  }, [epochs]);

  // Blink interval (stops on unmount or pause)
  useEffect(() => {
    if (!isPlaying || epochs.length < 2) return;
    const intervalMs = Math.round(1000 / fps);
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % epochs.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, fps, epochs.length]);

  const activeEpoch: Epoch | undefined = epochs[activeIndex];
  const compareEpoch: Epoch | undefined = epochs[compareIndex] ?? activeEpoch;

  // Render Canvas 2D frame + split comparison + candidate track overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeEpoch) return;
    const ctx = getSafe2dContext(canvas);
    if (!ctx) return;

    const size = 290;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#090d13';
    ctx.fillRect(0, 0, size, size);

    const drawSynthetic60x60Fallback = (epoch: Epoch) => {
      const gridW = manifest.grid.widthPx || 60;
      const gridH = manifest.grid.heightPx || 60;
      const cellW = size / gridW;
      const cellH = size / gridH;
      const isLongWave = epoch.lambdaUm >= 2.2;

      ctx.fillStyle = isLongWave ? '#0e131b' : '#0b0f16';
      ctx.fillRect(0, 0, size, size);

      // Deterministic pixel matrix from manifest coordinates + epoch wavelength
      let seed = Math.floor((manifest.ra * 100 + Math.abs(manifest.dec) * 50) * 100) >>> 0;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      for (let i = 0; i < 18; i++) {
        const sx = Math.floor(rand() * (gridW - 6)) + 3;
        const sy = Math.floor(rand() * (gridH - 6)) + 3;
        const lum = Math.floor(95 + rand() * 145);
        ctx.fillStyle = isLongWave
          ? `rgb(${Math.min(255, lum + 15)}, ${lum}, ${Math.max(40, lum - 20)})`
          : `rgb(${Math.max(40, lum - 15)}, ${lum}, ${Math.min(255, lum + 20)})`;
        ctx.fillRect(Math.round(sx * cellW), Math.round(sy * cellH), Math.ceil(cellW * 1.4), Math.ceil(cellH * 1.4));
      }

      // Draw candidate pixel core for this epoch
      manifest.candidates.forEach((cand) => {
        const pt = cand.track.find((t) => t.epochId === epoch.id);
        if (pt) {
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(
            Math.round((pt.x - 1) * cellW),
            Math.round((pt.y - 1) * cellH),
            Math.ceil(cellW * 2.5),
            Math.ceil(cellH * 2.5)
          );
        }
      });
    };

    const drawFrame = (epoch: Epoch, clipWidth?: number) => {
      const img = loadedImages[epoch.id];
      ctx.save();
      if (clipWidth !== undefined) {
        ctx.beginPath();
        ctx.rect(0, 0, clipWidth, size);
        ctx.clip();
      }

      if (img) {
        ctx.drawImage(img, 0, 0, size, size);
      } else if (!failedImages[epoch.id]) {
        drawSynthetic60x60Fallback(epoch);
      } else {
        ctx.fillStyle = '#10151e';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#222a36';
        ctx.lineWidth = 1;
        ctx.strokeRect(8, 8, size - 16, size - 16);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const statusText =
          lang === 'es' ? 'Imagen FITS/PNG no disponible' : 'Frame PNG unavailable';
        ctx.fillText(statusText, size / 2, size / 2 - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${epoch.obsId} (${epoch.lambdaUm.toFixed(2)} um)`, size / 2, size / 2 + 14);
      }
      ctx.restore();
    };

    if (splitPercent < 100 && compareEpoch && compareEpoch.id !== activeEpoch.id) {
      drawFrame(compareEpoch);
      const splitX = Math.round((splitPercent / 100) * size);
      drawFrame(activeEpoch, splitX);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, size);
      ctx.stroke();
    } else {
      drawFrame(activeEpoch);
    }

    // Candidate track overlays
    if (showTracks && manifest.candidates.length > 0) {
      const gridW = manifest.grid.widthPx || 60;
      const gridH = manifest.grid.heightPx || 60;
      const scaleX = size / gridW;
      const scaleY = size / gridH;

      manifest.candidates.forEach((cand: Candidate) => {
        const isSelected = cand.id === selectedCandidateId;
        if (cand.track.length > 1) {
          ctx.strokeStyle = isSelected ? '#f59e0b' : '#64748b';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.beginPath();
          cand.track.forEach((pt, idx) => {
            const px = pt.x * scaleX;
            const py = pt.y * scaleY;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }

        const pointInEpoch = cand.track.find((pt) => pt.epochId === activeEpoch.id);
        if (pointInEpoch) {
          const px = pointInEpoch.x * scaleX;
          const py = pointInEpoch.y * scaleY;
          ctx.strokeStyle = isSelected ? '#f59e0b' : '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, isSelected ? 9 : 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }
  }, [
    activeEpoch,
    compareEpoch,
    splitPercent,
    loadedImages,
    failedImages,
    showTracks,
    manifest,
    selectedCandidateId,
    lang,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (epochs.length < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIsPlaying(false);
      setActiveIndex((prev) => (prev - 1 + epochs.length) % epochs.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIsPlaying(false);
      setActiveIndex((prev) => (prev + 1) % epochs.length);
    }
  };

  if (epochs.length === 0 || !activeEpoch) {
    return (
      <section className="border-b border-[#222a36] pb-3">
        <h2 className="text-xs font-semibold text-slate-200 sm:text-sm">
          {lang === 'es' ? 'Comparador Blink de Epocas' : 'Epoch Blink Comparator'}
        </h2>
        <p className="mt-1 font-mono text-xs text-slate-400">
          {manifest.message ??
            (lang === 'es'
              ? 'No hay epocas de SPHEREx disponibles en estas coordenadas.'
              : 'No SPHEREx epochs available at these coordinates.')}
        </p>
      </section>
    );
  }

  const badgeStatus = compareEpoch
    ? lambdaBadge(activeEpoch, compareEpoch, manifest)
    : 'matched';

  return (
    <section
      aria-label={lang === 'es' ? 'Comparador Blink de Epocas' : 'Epoch Blink Comparator'}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="flex flex-col gap-2 border-b border-[#222a36] pb-2.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-slate-400"
    >
      {manifest.provenance.synthetic && (
        <div
          role="alert"
          className="rounded border border-red-800/70 bg-[#200d0d] px-2.5 py-1 font-mono text-xs font-semibold text-red-200"
        >
          SYNTHETIC TEST DATA - not SPHEREx
        </div>
      )}

      {/* Header: Title + Inline metadata + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-200 sm:text-sm">
            {lang === 'es' ? 'Comparador Blink de Epocas' : 'Epoch Blink Comparator'}
          </h2>
          <span className="font-mono text-[11px] text-slate-400">
            {manifest.name} ({epochs.length}{' '}
            {lang === 'es' ? 'observaciones ordenadas por fecha' : 'observations sorted by UTC'})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={epochs.length < 2}
            onClick={() => setIsPlaying((p) => !p)}
            aria-pressed={isPlaying}
            className="min-h-[32px] rounded border border-[#3b4759] bg-[#1a222e] px-2.5 font-mono text-xs font-medium text-slate-200 transition-colors hover:bg-[#232e3e] hover:text-white active:scale-[0.98] disabled:border-[#222a36] disabled:bg-[#12161f] disabled:text-slate-600"
          >
            {isPlaying
              ? lang === 'es'
                ? 'Pausar Blink'
                : 'Pause Blink'
              : lang === 'es'
                ? 'Reproducir Blink'
                : 'Play Blink'}
          </button>

          <label htmlFor="fps-select" className="sr-only">
            {lang === 'es' ? 'Velocidad de parpadeo' : 'Blink speed'}
          </label>
          <select
            id="fps-select"
            value={fps}
            onChange={(e) => setFps(Number(e.target.value) as 1 | 2 | 4)}
            className="min-h-[32px] rounded border border-[#2a3444] bg-[#090d13] px-2 font-mono text-xs text-slate-200"
          >
            <option value={1}>1 FPS</option>
            <option value={2}>2 FPS</option>
            <option value={4}>4 FPS</option>
          </select>

          <button
            type="button"
            onClick={() => setShowTracks((s) => !s)}
            aria-pressed={showTracks}
            className="min-h-[32px] rounded border border-[#2a3444] bg-[#090d13] px-2 font-mono text-xs font-medium text-slate-300 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98]"
          >
            {showTracks
              ? lang === 'es'
                ? 'Ocultar marcadores'
                : 'Hide tracks'
              : lang === 'es'
                ? 'Mostrar marcadores'
                : 'Show tracks'}
          </button>
        </div>
      </div>

      {/* Telemetry Matrix Readout */}
      <div className="grid grid-cols-2 gap-2 rounded border border-[#222a36] bg-[#090d13] p-1.5 sm:grid-cols-4">
        <div className="border-r border-[#222a36] pr-1">
          <span className="block font-mono text-[10px] text-slate-500 uppercase">
            {lang === 'es' ? 'Fecha UTC' : 'UTC Date'}
          </span>
          <span className="font-mono text-xs text-slate-200 tabular-nums">
            {activeEpoch.utc.slice(0, 19).replace('T', ' ')}
          </span>
        </div>
        <div className="border-r border-[#222a36] pr-1">
          <span className="block font-mono text-[10px] text-slate-500 uppercase">
            {lang === 'es' ? 'Longitud de onda' : 'Wavelength'}
          </span>
          <span className="font-mono text-xs font-medium text-slate-100 tabular-nums">
            {activeEpoch.lambdaUm.toFixed(3)} um
          </span>
        </div>
        <div className="border-r border-[#222a36] pr-1">
          <span className="block font-mono text-[10px] text-slate-500 uppercase">
            {lang === 'es' ? 'Detector / Coleccion' : 'Detector / Release'}
          </span>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            D{activeEpoch.detector} ({activeEpoch.release.toUpperCase()})
          </span>
        </div>
        <div>
          <span className="block font-mono text-[10px] text-slate-500 uppercase">Obs ID</span>
          <span className="block truncate font-mono text-xs text-slate-400 tabular-nums">
            {activeEpoch.obsId}
          </span>
        </div>
      </div>

      {/* Side-by-Side Cutout Canvas & Stepper Controls */}
      <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-[168px_1fr]">
        <div className="flex flex-col items-center">
          <div className="rounded border border-[#222a36] bg-[#090d13] p-0.5">
            <canvas
              ref={canvasRef}
              width={290}
              height={290}
              style={{ imageRendering: 'pixelated' }}
              className="h-[164px] w-[164px] bg-[#090d13]"
            />
          </div>
          <span className="mt-1 text-center font-mono text-[10px] text-slate-400 tabular-nums">
            {lang === 'es'
              ? `Rejilla ${manifest.grid.widthPx}x${manifest.grid.heightPx} px (${manifest.grid.pixScaleArcsec}"/px)`
              : `Grid ${manifest.grid.widthPx}x${manifest.grid.heightPx} px (${manifest.grid.pixScaleArcsec}"/px)`}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Active Epoch Stepper */}
          <div className="rounded border border-[#222a36] bg-[#090d13] p-2">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-200">
              <label htmlFor="epoch-slider" className="font-mono text-[11px] text-slate-300">
                {lang === 'es' ? 'Epoca activa' : 'Active epoch'} ({activeIndex + 1}/{epochs.length})
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={epochs.length < 2}
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveIndex((prev) => (prev - 1 + epochs.length) % epochs.length);
                  }}
                  aria-label={lang === 'es' ? 'Epoca anterior' : 'Previous epoch'}
                  className="min-h-[30px] min-w-[36px] rounded border border-[#2a3444] bg-[#141a24] px-2 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98] disabled:border-[#222a36] disabled:text-slate-600"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={epochs.length < 2}
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveIndex((prev) => (prev + 1) % epochs.length);
                  }}
                  aria-label={lang === 'es' ? 'Siguiente epoca' : 'Next epoch'}
                  className="min-h-[30px] min-w-[36px] rounded border border-[#2a3444] bg-[#141a24] px-2 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white active:scale-[0.98] disabled:border-[#222a36] disabled:text-slate-600"
                >
                  Next
                </button>
              </div>
            </div>

            <input
              id="epoch-slider"
              type="range"
              min={0}
              max={Math.max(0, epochs.length - 1)}
              value={activeIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setActiveIndex(Number(e.target.value));
              }}
              className="w-full accent-slate-400"
            />

            <div className="mt-1.5 flex flex-wrap gap-1">
              {epochs.map((ep, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveIndex(idx);
                    }}
                    className={`rounded border px-2 py-0.5 text-left font-mono text-[10px] tabular-nums transition-colors ${
                      isActive
                        ? 'border-slate-400 bg-[#202936] font-medium text-white shadow-sm'
                        : 'border-[#222a36] bg-[#10151e] text-slate-400 hover:border-[#384659] hover:text-slate-200'
                    }`}
                  >
                    <span className="block font-medium">{ep.utc.slice(0, 10)}</span>
                    <span className="text-[10px] text-slate-500">
                      {ep.lambdaUm.toFixed(2)} um | {ep.release.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split-Wipe Comparison Controls */}
          {epochs.length > 1 && compareEpoch && (
            <div className="flex flex-col gap-1.5 rounded border border-[#222a36] bg-[#090d13] p-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label
                  htmlFor="compare-epoch-select"
                  className="font-mono text-[10px] text-slate-400 uppercase"
                >
                  {lang === 'es' ? 'Comparar contra epoca:' : 'Compare against epoch:'}
                </label>
                <select
                  id="compare-epoch-select"
                  value={compareIndex}
                  onChange={(e) => setCompareIndex(Number(e.target.value))}
                  className="min-h-[30px] rounded border border-[#2a3444] bg-[#10151e] px-2 font-mono text-[11px] text-slate-200"
                >
                  {epochs.map((ep, idx) => (
                    <option key={ep.id} value={idx}>
                      {ep.utc.slice(0, 10)} ({ep.lambdaUm.toFixed(2)} um, D{ep.detector})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between font-mono text-[11px] text-slate-300">
                  <label htmlFor="split-slider">
                    {lang === 'es' ? 'Cortina comparadora' : 'Split-wipe comparison'}
                  </label>
                  <span className="font-medium text-slate-200 tabular-nums">{splitPercent}%</span>
                </div>
                <input
                  id="split-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={splitPercent}
                  onChange={(e) => setSplitPercent(Number(e.target.value))}
                  className="mt-1 w-full accent-slate-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {epochs.length > 1 && compareEpoch && (
        <WavelengthBadge
          status={badgeStatus}
          lambdaA={activeEpoch.lambdaUm}
          lambdaB={compareEpoch.lambdaUm}
          lang={lang}
        />
      )}

      {manifest.candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-[#222a36] bg-[#090d13] p-1.5 text-xs">
          <span className="font-mono text-[10px] text-slate-400 uppercase">
            {lang === 'es' ? 'Candidatos en campo:' : 'Field candidates:'}
          </span>
          {manifest.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCandidate(c.id)}
              className={`min-h-[30px] rounded border px-2 py-0.5 font-mono text-xs transition-colors ${
                c.id === selectedCandidateId
                  ? 'border-slate-400 bg-[#202936] font-medium text-white'
                  : 'border-[#222a36] bg-[#10151e] text-slate-400 hover:border-[#384659] hover:text-slate-200'
              }`}
            >
              {c.id} (S/N {c.snr.toFixed(1)})
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
