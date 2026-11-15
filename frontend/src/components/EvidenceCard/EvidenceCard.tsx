import type { Candidate, FieldManifest } from '../../types/spherex';
import { candidateLabel } from '../../utils/candidates';

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {lang === 'es' ? 'Evidencia de Candidatos' : 'Candidate Evidence'}
          </h2>
          <p className="text-[11px] text-slate-300">
            {candidates.length === 0
              ? lang === 'es'
                ? 'Sin fuentes moviles candidatas en este campo'
                : 'No moving-source candidates flagged in this field'
              : `${candidates.length} ${
                  lang === 'es' ? 'candidatos detectados' : 'flagged candidates'
                }`}
          </p>
        </div>

        <a
          href={irsaExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-medium text-amber-300 hover:border-amber-400"
        >
          {lang === 'es' ? 'Abrir espectro en IRSA' : 'Open IRSA Spectrophotometry'}
        </a>
      </div>

      {candidates.length === 0 || !active ? (
        <div className="border-y border-instrumentBorder/50 py-2 text-xs text-slate-300">
          <p>
            {lang === 'es'
              ? 'No se detectaron desplazamientos por encima del umbral S/N en los pares compatibles de longitud de onda. Esto es esperado en campos de control estaticos.'
              : 'No positional shifts exceeded the S/N threshold across wavelength-matched epoch pairs. This is expected for static control fields.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => onSelectCandidate(cand.id)}
                  className={`min-h-[44px] rounded border px-3 font-mono text-xs font-medium ${
                    cand.id === active.id
                      ? 'border-accentAmber bg-amber-950/80 text-amber-200'
                      : 'border-instrumentBorder bg-obsidian text-slate-200 hover:border-amber-400'
                  }`}
                >
                  {cand.id}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-instrumentBorder/50 pt-2">
            <span className="text-xs font-semibold text-amber-300">
              {candidateLabel(active, lang)}
            </span>
            <span className="rounded border border-instrumentBorder bg-obsidian px-2 py-0.5 font-mono text-xs font-semibold text-slate-100 tabular-nums">
              S/N {active.snr.toFixed(1)}
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-2 border-y border-instrumentBorder/50 py-1.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                {lang === 'es' ? 'Clasificacion algoritmica' : 'Algorithmic kind'}
              </dt>
              <dd className="mt-0.5 text-[11px] font-medium text-slate-100">
                {active.kind === 'moved_source'
                  ? lang === 'es'
                    ? 'Fuente con desplazamiento entre epocas'
                    : 'Source with cross-epoch offset'
                  : lang === 'es'
                    ? 'Fuente sin coincidencia en epoca base'
                    : 'Unmatched transient source'}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">
                {lang === 'es' ? 'Cruce de catalogos' : 'Catalog cross-match'}
              </dt>
              <dd className="mt-0.5 font-mono text-[11px] font-medium text-slate-100 tabular-nums">
                {active.match
                  ? `${active.match.name} (${active.match.catalog}, ${active.match.sepArcsec.toFixed(1)}")`
                  : lang === 'es'
                    ? 'Sin coincidencia en JPL SBIdent / Gaia / SIMBAD'
                    : 'No match in JPL SBIdent / Gaia / SIMBAD'}
              </dd>
            </div>
          </dl>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-200">
                {lang === 'es' ? 'Resumen explicativo validado (RAG)' : 'Grounded Explanation (RAG)'}
              </h3>
              {active.explanation && (
                <span className="font-mono text-[10px] text-slate-300">
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
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">
              {active.explanation?.text ??
                (lang === 'es'
                  ? `Objeto candidato detectado en ${active.track.length} epocas con S/N ${active.snr.toFixed(1)}. Requiere inspeccion fotometrica adicional en IRSA.`
                  : `Candidate object tracked across ${active.track.length} epochs at S/N ${active.snr.toFixed(1)}. Requires additional photometric verification in IRSA.`)}
            </p>
          </div>
        </div>
      )}

      {/* Mandatory scientific caveat (Fixed & Always Visible) */}
      <div className="rounded-md border border-instrumentBorder bg-obsidian px-2.5 py-1.5 text-[11px] text-slate-200">
        <span className="font-semibold text-amber-300">
          {lang === 'es' ? 'Que NO es esto: ' : 'What this is NOT: '}
        </span>
        {lang === 'es'
          ? 'no es un descubrimiento confirmado ni una deteccion de Planet X. Toda firma requiere validacion astronomica independiente.'
          : 'not a confirmed discovery and not a Planet X detection. Every candidate requires independent astronomical validation.'}
      </div>
    </section>
  );
}
