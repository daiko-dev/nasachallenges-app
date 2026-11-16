import { useEffect, useRef } from 'react';
import { SvdvIcon } from '../common/Logo';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

export function AboutModal({ open, onClose, lang }: AboutModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded border border-[#222a36] bg-[#10151e] p-6 text-slate-200 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#222a36] pb-3">
          <div className="flex items-center gap-3">
            <SvdvIcon className="h-8 w-8 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-100">SVDV</span>
                <span className="text-slate-600">/</span>
                <h2 id="about-modal-title" className="text-sm font-semibold text-slate-100 sm:text-base">
                  {lang === 'es'
                    ? 'Guia de Uso y Creditos Cientificos (SVDV)'
                    : 'Field Guide & Scientific Credits (SVDV)'}
                </h2>
              </div>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar ventana' : 'Close dialog'}
            className="min-h-[32px] min-w-[32px] rounded border border-[#2a3444] bg-[#141a24] px-2.5 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs leading-relaxed text-slate-300">
          <div>
            <h3 className="font-semibold text-slate-200">
              {lang === 'es' ? 'Como interpretar las observaciones' : 'How to interpret observations'}
            </h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-slate-300">
              <li>
                <strong className="text-slate-100">
                  {lang === 'es' ? 'GPS Celeste 3D: ' : '3D Sky GPS: '}
                </strong>
                {lang === 'es'
                  ? 'Explora el mapa celeste 3D interactivo (GPS del cielo), haz clic en cualquier punto para extraer coordenadas RA/Dec o usa el buscador superior.'
                  : 'Navigate the interactive 3D celestial sphere (sky GPS), click any sky region to extract RA/Dec coordinates, or enter coordinates in the search bar.'}
              </li>
              <li>
                <strong className="text-slate-100">
                  {lang === 'es' ? 'Comparador Blink 2D: ' : '2D Blink Comparator: '}
                </strong>
                {lang === 'es'
                  ? 'Usa el comparador Blink 2D para alternar epocas (~60x60 px). Verifica siempre la insignia de longitud de onda: SPHEREx usa filtros lineales variables (102 canales, 0.75 a 5.0 um), por lo que comparar longitudes distintas mezcla cambio real con color.'
                  : 'Step through epochs in the 2D Blink Comparator (~60x60 px). Always check the wavelength badge: SPHEREx uses linear variable filters (102 channels, 0.75 to 5.0 um), so comparing different wavelengths mixes real motion with spectral color.'}
              </li>
              <li>
                <strong className="text-slate-100">
                  {lang === 'es' ? 'Evidencia y RAG: ' : 'Evidence & RAG: '}
                </strong>
                {lang === 'es'
                  ? 'Revisa la tarjeta de evidencia de los candidatos. Las explicaciones provienen exclusivamente de datos JSON calculados y no constituyen descubrimientos confirmados.'
                  : 'Inspect flagged candidates in the Evidence Card. Explanations are strictly grounded in computed JSON metrics and never represent confirmed discoveries.'}
              </li>
            </ol>
          </div>

          <div className="rounded border border-[#222a36] bg-[#090d13] p-3">
            <h3 className="font-semibold text-slate-200">
              {lang === 'es' ? 'Autores y Creditos del Proyecto (GitHub)' : 'Project Authors & Credits (GitHub)'}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="https://github.com/Lisamuelpe"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-[#2a3444] bg-[#141a24] px-2.5 py-1 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span>Lisamuelpe</span>
              </a>
              <a
                href="https://github.com/Sherlock_man"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-[#2a3444] bg-[#141a24] px-2.5 py-1 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span>Sherlock_man</span>
              </a>
              <a
                href="https://github.com/daiko-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-[#2a3444] bg-[#141a24] px-2.5 py-1 font-mono text-xs text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span>daiko-dev</span>
              </a>
            </div>
          </div>

          <div className="rounded border border-[#222a36] bg-[#090d13] p-3">
            <h3 className="font-semibold text-slate-200">
              {lang === 'es' ? 'Credito Oficial de Datos y DOIs' : 'Mandatory Data Credit & DOIs'}
            </h3>
            <p className="mt-1 font-mono text-slate-300">
              SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive
            </p>
            <p className="mt-2 text-slate-400">
              {lang === 'es'
                ? 'Colecciones consultadas: SPHEREx DR1 (DOI 10.26131/IRSA678) y QR3 (DOI 10.26131/IRSA662) via SIA2. Visor 3D/WebGL2: Aladin Lite v3 (CDS Strasbourg, LGPL-3.0-or-later) con encuestas infrarrojas AllWISE y 2MASS (ESA ESAC).'
                : 'Collections queried: SPHEREx DR1 (DOI 10.26131/IRSA678) and QR3 (DOI 10.26131/IRSA662) via SIA2. 3D/WebGL2 sky engine: Aladin Lite v3 (CDS Strasbourg, LGPL-3.0-or-later) with AllWISE and 2MASS infrared surveys (ESA ESAC).'}
            </p>
          </div>

          <div className="border-t border-[#222a36] pt-2 font-mono text-[11px] text-slate-500">
            {lang === 'es'
              ? 'Licencia del codigo del proyecto SVDV: Apache-2.0. Herramienta desarrollada para NASA Space Apps Challenge 2026 (Planet X and SPHEREx).'
              : 'SVDV project source license: Apache-2.0. Built for NASA Space Apps Challenge 2026 (Planet X and SPHEREx).'}
          </div>
        </div>
      </div>
    </div>
  );
}
