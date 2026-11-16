import { useState } from 'react';
import type { Candidate, FieldManifest } from '../../types/spherex';
import { candidateLabel } from '../../utils/candidates';
import { ReportModal } from '../ReportModal';

interface EvidenceCardProps {
  manifest: FieldManifest;
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  lang: 'en' | 'es';
}

export function EvidenceCard({
  manifest,
  selectedCandidateId,
  onSelectCandidate,
  lang,
}: EvidenceCardProps) {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const candidates = manifest.candidates;
  const active: Candidate | undefined =
    candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];

  const irsaExplorerUrl = `https://irsa.ipac.caltech.edu/applications/spherex/?ra=${manifest.ra.toFixed(
    4
  )}&dec=${manifest.dec.toFixed(4)}`;

  return (
    <section
      aria-label={lang === 'es' ? 'Candidatos y tarjeta de evidencia' : 'Candidates and evidence card'}
      className="flex flex-col gap-2 pt-0.5"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222a36] pb-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-200 sm:text-sm">
            {lang === 'es' ? 'Evidencia de Candidatos' : 'Candidate Evidence'}
          </h2>
          {candidates.length > 0 ? (
            <span className="font-mono text-xs text-slate-400">
              ({candidates.length})
            </span>
          ) : (
            <span className="font-mono text-[11px] text-slate-400">
              {lang === 'es'
                ? 'Sin fuentes moviles candidatas en este campo'
                : 'No moving-source candidates flagged in this field'}
            </span>
          )}
        </div>

        <a
          href={irsaExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[30px] items-center rounded border border-[#2a3444] bg-[#090d13] px-2.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
        >
          {lang === 'es' ? 'Abrir espectro en IRSA' : 'Open IRSA Spectrophotometry'} ↗
        </a>
      </div>

      {candidates.length === 0 || !active ? (
        <div className="rounded border border-[#222a36] bg-[#090d13] p-2.5 text-xs text-slate-400">
          <p>
            {lang === 'es'
              ? 'No se detectaron desplazamientos por encima del umbral S/N en los pares compatibles de longitud de onda. Esto es esperado en campos de control estaticos.'
              : 'No positional shifts exceeded the S/N threshold across wavelength-matched epoch pairs. This is expected for static control fields.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Candidate selector tabs */}
          {candidates.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-[#222a36] bg-[#090d13] p-1.5">
              <span className="px-1 font-mono text-[10px] text-slate-400 uppercase">
                {lang === 'es' ? 'Candidato:' : 'Target:'}
              </span>
              {candidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => onSelectCandidate(cand.id)}
                  className={`min-h-[30px] rounded border px-2.5 font-mono text-xs transition-colors ${
                    cand.id === active.id
                      ? 'border-slate-400 bg-[#202936] font-medium text-white shadow-sm'
                      : 'border-[#222a36] bg-[#10151e] text-slate-400 hover:border-[#384659] hover:text-slate-200'
                  }`}
                >
                  {cand.id}
                </button>
              ))}
            </div>
          )}

          {/* Active Candidate Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#222a36] bg-[#090d13] px-2.5 py-1.5">
            <span className="font-mono text-xs font-medium text-slate-200">
              {candidateLabel(active, lang)}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase">Significance</span>
              <span className="rounded border border-[#2a3444] bg-[#141a24] px-2 py-0.5 font-mono text-xs text-slate-200 tabular-nums">
                S/N {active.snr.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Classification & Cross-match Grid */}
          <dl className="grid grid-cols-1 gap-2 rounded border border-[#222a36] bg-[#090d13] p-2 sm:grid-cols-2">
            <div className="border-b border-[#222a36] pb-1.5 sm:border-b-0 sm:border-r sm:pr-2">
              <dt className="font-mono text-[10px] text-slate-400 uppercase">
                {lang === 'es' ? 'Clasificacion algoritmica' : 'Algorithmic kind'}
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] text-slate-200">
                {active.kind === 'moved_source'
                  ? lang === 'es'
                    ? 'Fuente con desplazamiento entre epocas'
                    : 'Source with cross-epoch offset'
                  : lang === 'es'
                    ? 'Fuente sin coincidencia en epoca base'
                    : 'Unmatched transient source'}
              </dd>
            </div>

            <div className="pt-1.5 sm:pt-0 sm:pl-1">
              <dt className="font-mono text-[10px] text-slate-400 uppercase">
                {lang === 'es' ? 'Cruce de catalogos' : 'Catalog cross-match'}
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] text-slate-300 tabular-nums">
                {active.match
                  ? `${active.match.name} (${active.match.catalog}, ${active.match.sepArcsec.toFixed(1)}")`
                  : lang === 'es'
                    ? 'Sin coincidencia en JPL SBIdent / Gaia / SIMBAD'
                    : 'No match in JPL SBIdent / Gaia / SIMBAD'}
              </dd>
            </div>
          </dl>

          {/* Grounded RAG Section */}
          <div className="rounded border border-[#222a36] bg-[#090d13] p-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222a36] pb-1">
              <h3 className="font-mono text-xs font-medium text-slate-300 uppercase">
                {lang === 'es' ? 'Resumen explicativo validado (RAG)' : 'Grounded Explanation (RAG)'}
              </h3>
              {active.explanation && (
                <span className="font-mono text-[10px] text-slate-400">
                  {active.explanation.source === 'llm'
                    ? lang === 'es'
                      ? 'Fuente: OpenRouter + JSON verificado'
                      : 'Source: OpenRouter + grounded JSON'
                    : lang === 'es'
                      ? 'Fuente: plantilla determinista'
                      : 'Source: deterministic template'}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              {active.explanation?.text ??
                (lang === 'es'
                  ? `Objeto candidato detectado en ${active.track.length} epocas con S/N ${active.snr.toFixed(1)}. Requiere inspeccion fotometrica adicional en IRSA.`
                  : `Candidate object tracked across ${active.track.length} epochs at S/N ${active.snr.toFixed(1)}. Requires additional photometric verification in IRSA.`)}
            </p>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="inline-flex min-h-[30px] items-center gap-1.5 rounded border border-[#2a3444] bg-[#141a24] px-2.5 py-1 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
              >
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4 1h5.5L13 4.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm5 1v3h3L9 2z" />
                </svg>
                <span>{lang === 'es' ? 'Ver informe RAG detallado' : 'View detailed RAG report'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory scientific caveat (Fixed & Always Visible) */}
      <div className="rounded border border-[#333d4b] bg-[#10151e] px-3 py-2 text-[11px] text-slate-300">
        <span className="font-mono font-medium text-slate-200 uppercase">
          {lang === 'es' ? 'Que NO es esto: ' : 'What this is NOT: '}
        </span>
        <span className="text-slate-300">
          {lang === 'es'
            ? 'no es un descubrimiento confirmado ni una deteccion de Planet X. Toda firma requiere validacion astronomica independiente.'
            : 'not a confirmed discovery and not a Planet X detection. Every candidate requires independent astronomical validation.'}
        </span>
      </div>

      {active && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          manifest={manifest}
          candidate={active}
          lang={lang}
        />
      )}
    </section>
  );
}
