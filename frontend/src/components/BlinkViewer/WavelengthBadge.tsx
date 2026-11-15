interface WavelengthBadgeProps {
  status: 'matched' | 'mismatch';
  lambdaA: number;
  lambdaB: number;
  lang: 'en' | 'es';
}

export function WavelengthBadge({
  status,
  lambdaA,
  lambdaB,
  lang,
}: WavelengthBadgeProps) {
  if (status === 'matched') {
    return (
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-md border border-emerald-500/80 bg-emerald-950/90 px-3 py-2 text-xs text-emerald-100"
      >
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.42l2.543 2.544 6.543-6.544a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="font-semibold text-emerald-200">
            {lang === 'es' ? 'Longitud de onda compatible' : 'Wavelength Matched'}
          </p>
          <p className="font-mono text-[11px] text-emerald-200/95 tabular-nums">
            {lambdaA.toFixed(3)} um vs {lambdaB.toFixed(3)} um.{' '}
            <span className="font-sans">
              {lang === 'es'
                ? 'Comparacion valida para detectar cambios reales.'
                : 'Valid spectral pair for temporal brightness comparison.'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-md border border-amber-500/80 bg-amber-950/90 px-3 py-2 text-xs text-amber-100"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6.75a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5a.75.75 0 01.75-.75zm0 7.75a.75.75 0 100-1.5.75.75 0 000 1.5z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="font-semibold text-amber-200">
          {lang === 'es' ? 'Longitud de onda distinta (Mismatch)' : 'Wavelength Mismatch'}
        </p>
        <p className="font-mono text-[11px] text-amber-200/95 tabular-nums">
          {lambdaA.toFixed(3)} um vs {lambdaB.toFixed(3)} um:{' '}
          <span className="font-sans">
            {lang === 'es'
              ? 'las diferencias de brillo pueden deberse al color espectral y no a variabilidad real.'
              : 'Different wavelength: brightness differences may not be real change.'}
          </span>
        </p>
      </div>
    </div>
  );
}
