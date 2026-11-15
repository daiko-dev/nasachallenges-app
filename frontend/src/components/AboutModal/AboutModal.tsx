import { useEffect, useRef } from 'react';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-lg border border-instrumentBorder bg-instrument p-6 text-slate-200"
      >
        <div className="flex items-start justify-between gap-4 border-b border-instrumentBorder pb-3">
          <h2 id="about-modal-title" className="text-lg font-semibold text-slate-100">
            {lang === 'es'
              ? 'Guia de Uso y Creditos Cientificos (SVDV)'
              : 'Field Guide & Scientific Credits (SVDV)'}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar ventana' : 'Close dialog'}
            className="min-h-[44px] min-w-[44px] rounded border border-instrumentBorder bg-obsidian px-3 text-xs font-medium text-slate-100 hover:border-amber-400"
          >
            {lang === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold text-amber-300">
              {lang === 'es' ? 'Como interpretar las observaciones' : 'How to interpret observations'}
            </h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-slate-200">
              <li>
                {lang === 'es'
                  ? 'Explora el mapa celeste 3D interactivo (GPS del cielo), haz clic en cualquier punto para extraer coordenadas RA/Dec o usa el buscador superior.'
                  : 'Navigate the interactive 3D celestial sphere (sky GPS), click any sky region to extract RA/Dec coordinates, or enter coordinates in the search bar.'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Usa el comparador Blink 2D para alternar epocas (~60x60 px). Verifica siempre la insignia de longitud de onda: SPHEREx usa filtros lineales variables (102 canales, 0.75 a 5.0 um), por lo que comparar longitudes distintas mezcla cambio real con color.'
                  : 'Step through epochs in the 2D Blink Comparator (~60x60 px). Always check the wavelength badge: SPHEREx uses linear variable filters (102 channels, 0.75 to 5.0 um), so comparing different wavelengths mixes real motion with spectral color.'}
              </li>
              <li>
                {lang === 'es'
                  ? 'Revisa la tarjeta de evidencia de los candidatos. Las explicaciones provienen exclusivamente de datos JSON calculados y no constituyen descubrimientos confirmados.'
                  : 'Inspect flagged candidates in the Evidence Card. Explanations are strictly grounded in computed JSON metrics and never represent confirmed discoveries.'}
              </li>
            </ol>
          </div>

          <div className="rounded-md border border-instrumentBorder bg-obsidian p-3.5 text-xs">
            <h3 className="font-semibold text-slate-100">
              {lang === 'es' ? 'Credito Oficial de Datos y DOIs' : 'Mandatory Data Credit & DOIs'}
            </h3>
            <p className="mt-1 font-medium text-amber-200">
              SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive
            </p>
            <p className="mt-2 text-slate-300">
              {lang === 'es'
                ? 'Colecciones consultadas: SPHEREx DR1 (DOI 10.26131/IRSA678) y QR3 (DOI 10.26131/IRSA662) via SIA2. Visor 3D/WebGL2: Aladin Lite v3 (CDS Strasbourg, LGPL-3.0-or-later) con encuestas infrarrojas AllWISE y 2MASS (ESA ESAC).'
                : 'Collections queried: SPHEREx DR1 (DOI 10.26131/IRSA678) and QR3 (DOI 10.26131/IRSA662) via SIA2. 3D/WebGL2 sky engine: Aladin Lite v3 (CDS Strasbourg, LGPL-3.0-or-later) with AllWISE and 2MASS infrared surveys (ESA ESAC).'}
            </p>
          </div>

          <div className="text-xs text-slate-300">
            {lang === 'es'
              ? 'Licencia del codigo del proyecto SVDV: Apache-2.0. Herramienta desarrollada para NASA Space Apps Challenge 2026 (Planet X and SPHEREx).'
              : 'SVDV project source license: Apache-2.0. Built for NASA Space Apps Challenge 2026 (Planet X and SPHEREx).'}
          </div>
        </div>
      </div>
    </div>
  );
}
