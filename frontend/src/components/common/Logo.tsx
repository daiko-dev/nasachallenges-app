import React from 'react';

interface SvdvIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Official SVDV Mission Icon:
 * Blue planet with tilted orbital ring and orange signal waveform.
 */
export function SvdvIcon({ className = 'h-6 w-6', size, ...props }: SvdvIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="450 90 476 440"
      width={size}
      height={size}
      role="img"
      aria-label="SVDV Logo"
      className={className}
      {...props}
    >
      <title>SVDV Planetary Signal Emblem</title>
      <desc>Planeta azul con anillo orbital inclinado y onda de señal naranja.</desc>

      {/* Tilted orbital ring */}
      <ellipse
        cx="688"
        cy="310"
        rx="220"
        ry="40"
        transform="rotate(-20 688 310)"
        fill="none"
        stroke="#0f7edf"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Planetary main ring */}
      <circle
        cx="688"
        cy="310"
        r="155"
        fill="none"
        stroke="#0f7edf"
        strokeWidth="36"
      />

      {/* Signal / waveform */}
      <path
        d="M 488 310
           L 581 310
           C 594 310, 600 301, 607 285
           L 620 258
           C 626 245, 635 239, 644 239
           C 654 239, 661 252, 667 269
           L 704 363
           C 712 384, 722 395, 736 395
           C 749 395, 756 385, 763 365
           L 779 322
           C 783 313, 789 310, 800 310
           L 888 310"
        fill="none"
        stroke="#ec9625"
        strokeWidth="16"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SvdvBrandProps {
  layout?: 'horizontal' | 'vertical' | 'compact';
  title?: string;
  subtitle?: string;
  className?: string;
}

export function SvdvBrand({
  layout = 'horizontal',
  title = 'SphereX Viewer and Data Visualizer (SVDV)',
  subtitle,
  className = '',
}: SvdvBrandProps) {
  if (layout === 'vertical') {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${className}`}>
        <SvdvIcon className="h-14 w-14" />
        <span className="mt-1.5 font-mono text-xl font-bold tracking-wider text-slate-100">SVDV</span>
        {title && <span className="mt-0.5 text-xs font-medium text-slate-300">{title}</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <SvdvIcon className="h-6 w-6 shrink-0" />
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold tracking-wider text-slate-100">SVDV</span>
        <span className="text-slate-600">/</span>
        <h1 className="text-xs font-semibold text-slate-200 sm:text-sm">
          {title}
        </h1>
        {subtitle && (
          <span className="hidden text-[11px] text-slate-400 xl:inline">
            · {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
