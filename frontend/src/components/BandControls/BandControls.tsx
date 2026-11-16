import { useMemo, useState } from 'react';
import {
  DETECTOR_ARRAYS,
  SPHEREX_BANDS,
  type DetectorArrayInfo,
  type SpherexBand,
} from '../../data/spherexBands';
import type { Epoch, FieldManifest } from '../../types/spherex';

interface BandControlsProps {
  manifest?: FieldManifest | null;
  selectedBandChannel: number;
  onSelectChannel: (channel: number) => void;
  onSelectEpoch?: (epochId: string) => void;
  lang: 'en' | 'es';
}

const SCIENCE_PRESETS = [
  { channel: 1, labelEn: 'Ch 1 (0.75 µm) · Optical / NIR Edge', labelEs: 'Ch 1 (0.75 µm) · Borde Óptico / NIR' },
  { channel: 23, labelEn: 'Ch 23 (1.13 µm) · NIR Continuum', labelEs: 'Ch 23 (1.13 µm) · Continuo NIR' },
  { channel: 45, labelEn: 'Ch 45 (1.69 µm) · Stellar Emission Peak', labelEs: 'Ch 45 (1.69 µm) · Pico Estelar' },
  { channel: 75, labelEn: 'Ch 75 (3.01 µm) · H₂O Water Ice', labelEs: 'Ch 75 (3.01 µm) · Hielo de Agua H₂O' },
  { channel: 94, labelEn: 'Ch 94 (4.30 µm) · CO₂ Atmospheric', labelEs: 'Ch 94 (4.30 µm) · CO₂ Atmosférico' },
  { channel: 98, labelEn: 'Ch 98 (4.47 µm) · Thermal Infrared Deep', labelEs: 'Ch 98 (4.47 µm) · Infrarrojo Térmico Profundo' },
];

export function BandControls({
  manifest,
  selectedBandChannel,
  onSelectChannel,
  onSelectEpoch,
  lang,
}: BandControlsProps) {
  const [activeArrayFilter, setActiveArrayFilter] = useState<number | 'all'>('all');
  const [isOpen, setIsOpen] = useState(true);

  const activeBand: SpherexBand =
    SPHEREX_BANDS[selectedBandChannel - 1] ?? SPHEREX_BANDS[0];

  // Map manifest epochs to their closest channels
  const fieldEpochsByDetector = useMemo(() => {
    if (!manifest?.epochs) return new Map<number, Epoch>();
    const map = new Map<number, Epoch>();
    manifest.epochs.forEach((ep) => {
      map.set(ep.detector, ep);
    });
    return map;
  }, [manifest]);

  const matchingEpoch = manifest?.epochs?.find(
    (ep) =>
      ep.detector === activeBand.detector &&
      Math.abs(ep.lambdaUm - activeBand.wavelength_um) < 0.15
  );

  const filteredBands = useMemo(() => {
    if (activeArrayFilter === 'all') return SPHEREX_BANDS;
    return SPHEREX_BANDS.filter((b) => b.detector === activeArrayFilter);
  }, [activeArrayFilter]);

  const handleStep = (delta: number) => {
    const nextCh = Math.max(1, Math.min(102, selectedBandChannel + delta));
    onSelectChannel(nextCh);
    const band = SPHEREX_BANDS[nextCh - 1];
    if (band && onSelectEpoch) {
      const ep = manifest?.epochs?.find((e) => e.detector === band.detector);
      if (ep) onSelectEpoch(ep.id);
    }
  };

  const handleChannelClick = (ch: number) => {
    onSelectChannel(ch);
    const band = SPHEREX_BANDS[ch - 1];
    if (band && onSelectEpoch) {
      const ep = manifest?.epochs?.find((e) => e.detector === band.detector);
      if (ep) onSelectEpoch(ep.id);
    }
  };

  return (
    <section
      aria-label={lang === 'es' ? 'Selector de las 102 bandas infrarrojas de SPHEREx' : 'SPHEREx 102 Infrared Bands Selector'}
      className="flex flex-col gap-2 rounded border border-[#222a36] bg-[#0d121b] p-2.5 shadow-sm"
    >
      {/* Header with expand/collapse and active indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222a36] pb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: activeBand.spectralColor }}
            aria-hidden="true"
          />
          <h2 className="text-xs font-semibold text-slate-100 sm:text-sm">
            {lang === 'es' ? '102 Canales Infrarrojos SPHEREx' : 'SPHEREx 102 Infrared Channels'}
          </h2>
          <span className="rounded bg-[#1a2332] px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-300">
            0.75 - 5.00 µm
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-amber-400">
            Ch {activeBand.channel}
          </span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-xs text-slate-300">
            {activeBand.wavelength_um.toFixed(4)} µm
          </span>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="ml-1 rounded border border-[#2a3444] bg-[#090d13] px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-slate-400 hover:text-white"
          >
            {isOpen ? (lang === 'es' ? 'Minimizar' : 'Collapse') : (lang === 'es' ? 'Expandir' : 'Expand')}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-2.5 pt-1">
          {/* Active Band Detail Inspector Card */}
          <div className="grid grid-cols-2 gap-2 rounded border border-[#222a36] bg-[#090d13] p-2 sm:grid-cols-4">
            <div className="border-r border-[#222a36] pr-1">
              <span className="block font-mono text-[10px] text-slate-500 uppercase">
                {lang === 'es' ? 'Canal Espectral' : 'Spectral Channel'}
              </span>
              <span className="font-mono text-sm font-bold text-white tabular-nums">
                #{activeBand.channel}{' '}
                <span className="text-[10px] font-normal text-slate-400">/ 102</span>
              </span>
            </div>

            <div className="border-r border-[#222a36] pr-1">
              <span className="block font-mono text-[10px] text-slate-500 uppercase">
                {lang === 'es' ? 'Longitud Central' : 'Center Wavelength'}
              </span>
              <span
                className="font-mono text-sm font-bold tabular-nums"
                style={{ color: activeBand.spectralColor }}
              >
                {activeBand.wavelength_um.toFixed(4)} µm
              </span>
            </div>

            <div className="border-r border-[#222a36] pr-1">
              <span className="block font-mono text-[10px] text-slate-500 uppercase">
                {lang === 'es' ? 'Arreglo Detector' : 'Detector Array'}
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200">
                Array {activeBand.detector}
              </span>
            </div>

            <div>
              <span className="block font-mono text-[10px] text-slate-500 uppercase">
                {lang === 'es' ? 'Estado en Campo' : 'Field Coverage'}
              </span>
              {matchingEpoch ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {matchingEpoch.id} ({matchingEpoch.lambdaUm.toFixed(2)} µm)
                </span>
              ) : fieldEpochsByDetector.has(activeBand.detector) ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  D{activeBand.detector} {lang === 'es' ? 'cercano' : 'nearby'}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-slate-400">
                  {lang === 'es' ? 'Sin época directa' : 'No direct epoch'}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Stepper & Continuous Slider */}
          <div className="flex flex-col gap-1.5 rounded border border-[#222a36] bg-[#090d13] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  disabled={selectedBandChannel <= 1}
                  aria-label={lang === 'es' ? 'Canal anterior' : 'Previous channel'}
                  className="min-h-[28px] min-w-[28px] rounded border border-[#2a3444] bg-[#141a24] font-mono text-xs text-slate-200 hover:border-slate-400 disabled:opacity-30"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  disabled={selectedBandChannel >= 102}
                  aria-label={lang === 'es' ? 'Canal siguiente' : 'Next channel'}
                  className="min-h-[28px] min-w-[28px] rounded border border-[#2a3444] bg-[#141a24] font-mono text-xs text-slate-200 hover:border-slate-400 disabled:opacity-30"
                >
                  ▶
                </button>
                <span className="font-mono text-xs text-slate-300 ml-1">
                  {lang === 'es' ? 'Alternar canal:' : 'Step channel:'}
                </span>
              </div>

              <span className="font-mono text-xs text-slate-400">
                {activeBand.detector_array}
              </span>
            </div>

            {/* Continuous wavelength gradient slider */}
            <div className="relative flex items-center pt-1">
              <input
                type="range"
                min={1}
                max={102}
                value={selectedBandChannel}
                onChange={(e) => handleChannelClick(Number(e.target.value))}
                aria-label={lang === 'es' ? 'Control deslizante de los 102 canales infrarrojos' : '102 infrared channels slider'}
                className="w-full accent-amber-500 cursor-pointer h-2 rounded bg-gradient-to-r from-sky-500 via-emerald-400 via-lime-400 via-amber-400 via-orange-500 to-red-500"
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-slate-500">
              <span>0.75 µm (NIR)</span>
              <span>2.42 µm</span>
              <span>5.00 µm (MIR)</span>
            </div>
          </div>

          {/* Detector Array Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] text-slate-400 uppercase mr-1">
              {lang === 'es' ? 'Filtro Arreglo:' : 'Array Filter:'}
            </span>
            <button
              type="button"
              onClick={() => setActiveArrayFilter('all')}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                activeArrayFilter === 'all'
                  ? 'border-slate-300 bg-[#222c3c] font-semibold text-white'
                  : 'border-[#222a36] bg-[#090d13] text-slate-400 hover:border-slate-400 hover:text-slate-200'
              }`}
            >
              {lang === 'es' ? 'Todos (102)' : 'All (102)'}
            </button>
            {DETECTOR_ARRAYS.map((arr: DetectorArrayInfo) => {
              const isSelected = activeArrayFilter === arr.detector;
              const hasEpoch = fieldEpochsByDetector.has(arr.detector);
              return (
                <button
                  key={arr.detector}
                  type="button"
                  onClick={() => setActiveArrayFilter(arr.detector)}
                  className={`relative rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    isSelected
                      ? 'border-slate-300 bg-[#222c3c] font-semibold text-white'
                      : 'border-[#222a36] bg-[#090d13] text-slate-400 hover:border-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full mr-1"
                    style={{ backgroundColor: arr.accentColor }}
                  />
                  A{arr.detector}
                  {hasEpoch && (
                    <span
                      title={lang === 'es' ? 'Época observada en este campo' : 'Observed epoch in field'}
                      className="ml-1 inline-block h-1 w-1 rounded-full bg-emerald-400"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Science Jump Targets */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] text-slate-400 uppercase">
              {lang === 'es' ? 'Líneas Espectrales y Características Clave:' : 'Key Science & Spectral Features:'}
            </span>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {SCIENCE_PRESETS.map((p) => {
                const isCurrent = p.channel === selectedBandChannel;
                return (
                  <button
                    key={p.channel}
                    type="button"
                    onClick={() => handleChannelClick(p.channel)}
                    className={`flex items-center justify-between rounded border px-2 py-1 text-left font-mono text-[10px] transition-colors ${
                      isCurrent
                        ? 'border-amber-500/80 bg-[#1e1c15] text-amber-200 font-semibold'
                        : 'border-[#222a36] bg-[#090d13] text-slate-400 hover:border-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">
                      {lang === 'es' ? p.labelEs : p.labelEn}
                    </span>
                    {isCurrent && <span className="ml-1 text-amber-400">●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ribbon of Visible Channels */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>
                {lang === 'es' ? 'Canales filtrados' : 'Filtered Channels'} ({filteredBands.length})
              </span>
              <span className="text-slate-500">
                {lang === 'es' ? 'Haz clic en cualquier canal para seleccionarlo' : 'Click any channel to select'}
              </span>
            </div>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded border border-[#222a36] bg-[#090d13] p-1.5">
              {filteredBands.map((band) => {
                const isSelected = band.channel === selectedBandChannel;
                const hasMatchingEpoch = manifest?.epochs?.some(
                  (ep) =>
                    ep.detector === band.detector &&
                    Math.abs(ep.lambdaUm - band.wavelength_um) < 0.15
                );
                return (
                  <button
                    key={band.channel}
                    type="button"
                    onClick={() => handleChannelClick(band.channel)}
                    title={`Channel ${band.channel}: ${band.wavelength_um.toFixed(4)} µm (${band.detector_array})`}
                    className={`relative rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors ${
                      isSelected
                        ? 'border-white bg-[#2a364a] font-bold text-white shadow-sm ring-1 ring-amber-400'
                        : hasMatchingEpoch
                          ? 'border-emerald-700/70 bg-[#0d2218] text-emerald-200 hover:border-emerald-400'
                          : 'border-[#202735] bg-[#10151f] text-slate-400 hover:border-[#384659] hover:text-slate-200'
                    }`}
                  >
                    {band.channel}
                    {hasMatchingEpoch && (
                      <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
