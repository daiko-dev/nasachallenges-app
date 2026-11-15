import { useEffect, useState } from 'react';
import { fetchCandidateReport, CandidateReportResponse } from '../../services/reportService';
import type { Candidate, FieldManifest } from '../../types/spherex';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: FieldManifest;
  candidate: Candidate;
  lang: 'en' | 'es';
}

export function ReportModal({
  isOpen,
  onClose,
  manifest,
  candidate,
  lang,
}: ReportModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<CandidateReportResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);

    fetchCandidateReport(manifest.id, candidate.id, lang)
      .then((data) => {
        if (mounted) {
          setReportData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, manifest.id, candidate.id, lang]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl rounded-lg border border-instrumentBorder bg-[#0B0F19] p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-instrumentBorder pb-3">
          <h2 id="report-modal-title" className="text-lg font-semibold text-amber-300">
            {lang === 'es' ? 'Informe Científico RAG' : 'Scientific RAG Report'} — {candidate.id}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white"
            aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          {loading ? (
            <div className="py-8 text-center text-slate-400 animate-pulse">
              {lang === 'es' ? 'Consultando vector store y generando informe...' : 'Querying vector store and generating report...'}
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  {lang === 'es' ? 'Explicación Validada' : 'Validated Explanation'}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">
                  {reportData?.report.text ?? candidate.explanation?.text}
                </p>
                <div className="mt-1 text-[11px] text-amber-400/80 font-mono">
                  {lang === 'es' ? 'Fuente: ' : 'Source: '}
                  {reportData?.report.source ?? 'grounded template'}
                </div>
              </div>

              {reportData?.report.rag_context && reportData.report.rag_context.length > 0 && (
                <div className="rounded border border-instrumentBorder/70 bg-obsidian/50 p-3">
                  <h4 className="text-xs font-semibold text-slate-300">
                    {lang === 'es' ? 'Contexto de Recuperación Supabase pgvector' : 'Supabase pgvector Retrieval Context'}
                  </h4>
                  <ul className="mt-2 space-y-2 text-xs text-slate-300">
                    {reportData.report.rag_context.map((ctx) => (
                      <li key={ctx.id} className="border-l-2 border-accentAmber pl-2">
                        <div className="font-mono text-[10px] text-slate-400">
                          {lang === 'es' ? 'Similitud: ' : 'Similarity: '}
                          {(ctx.similarity * 100).toFixed(1)}%
                        </div>
                        <div>{ctx.content_text}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded border border-instrumentBorder bg-obsidian p-3 text-xs text-slate-400">
                <span className="font-semibold text-amber-300">
                  {lang === 'es' ? 'Descargo de responsabilidad de la NASA: ' : 'NASA Scientific Disclaimer: '}
                </span>
                {lang === 'es'
                  ? 'Esta salida es un candidato algorítmico y no constituye un descubrimiento confirmado. Todos los datos proceden del Archivo de Ciencia Infrarroja (IRSA).'
                  : 'This output represents an algorithmic candidate and does not constitute a confirmed discovery. All data originates from the Infrared Science Archive (IRSA).'}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-instrumentBorder bg-obsidian px-4 py-2 text-xs font-medium text-slate-200 hover:border-amber-400"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
