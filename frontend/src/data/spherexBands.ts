import rawBands from './spherex_bands.json';

export interface SpherexBand {
  channel: number; // 1 to 102
  wavelength_um: number; // e.g. 0.75 to 5.00
  detector_array: string; // e.g. "Array 1 (0.75 - 1.11 um)"
  label: string; // e.g. "Band 1 (0.75 µm)"
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  spectralColor: string; // Color representative of this IR regime
}

export interface DetectorArrayInfo {
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  rangeUm: string;
  minUm: number;
  maxUm: number;
  channels: [number, number]; // [minChannel, maxChannel]
  accentColor: string;
}

export const DETECTOR_ARRAYS: DetectorArrayInfo[] = [
  {
    detector: 1,
    name: 'Array 1 (NIR Short)',
    rangeUm: '0.75 - 1.11 µm',
    minUm: 0.75,
    maxUm: 1.11,
    channels: [1, 21],
    accentColor: '#38bdf8', // sky-400
  },
  {
    detector: 2,
    name: 'Array 2 (NIR Intermediate)',
    rangeUm: '1.11 - 1.64 µm',
    minUm: 1.11,
    maxUm: 1.64,
    channels: [22, 42],
    accentColor: '#34d399', // emerald-400
  },
  {
    detector: 3,
    name: 'Array 3 (NIR Long)',
    rangeUm: '1.64 - 2.42 µm',
    minUm: 1.64,
    maxUm: 2.42,
    channels: [43, 63],
    accentColor: '#a3e635', // lime-400
  },
  {
    detector: 4,
    name: 'Array 4 (MIR Short / Ice Features)',
    rangeUm: '2.42 - 3.82 µm',
    minUm: 2.42,
    maxUm: 3.82,
    channels: [64, 87],
    accentColor: '#fbbf24', // amber-400
  },
  {
    detector: 5,
    name: 'Array 5 (MIR CO₂ / Cold Dust)',
    rangeUm: '3.82 - 4.42 µm',
    minUm: 3.82,
    maxUm: 4.42,
    channels: [88, 95],
    accentColor: '#fb923c', // orange-400
  },
  {
    detector: 6,
    name: 'Array 6 (MIR Thermal Deep)',
    rangeUm: '4.42 - 5.00 µm',
    minUm: 4.42,
    maxUm: 5.0,
    channels: [96, 102],
    accentColor: '#f87171', // red-400
  },
];

function getDetectorFromChannel(ch: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (ch <= 21) return 1;
  if (ch <= 42) return 2;
  if (ch <= 63) return 3;
  if (ch <= 87) return 4;
  if (ch <= 95) return 5;
  return 6;
}

function getSpectralColor(wavelengthUm: number): string {
  // Map 0.75 um (cool cyan) to 5.0 um (deep warm orange/red)
  if (wavelengthUm < 1.11) return '#38bdf8'; // short NIR
  if (wavelengthUm < 1.64) return '#34d399'; // NIR 2
  if (wavelengthUm < 2.42) return '#a3e635'; // NIR 3
  if (wavelengthUm < 3.82) return '#fbbf24'; // MIR 4
  if (wavelengthUm < 4.42) return '#fb923c'; // MIR 5
  return '#f87171'; // thermal MIR 6
}

export const SPHEREX_BANDS: SpherexBand[] = (
  rawBands as Array<{
    channel: number;
    wavelength_um: number;
    detector_array: string;
    label: string;
  }>
).map((b) => ({
  channel: b.channel,
  wavelength_um: b.wavelength_um,
  detector_array: b.detector_array,
  label: b.label,
  detector: getDetectorFromChannel(b.channel),
  spectralColor: getSpectralColor(b.wavelength_um),
}));

export function getBandByChannel(channel: number): SpherexBand | undefined {
  return SPHEREX_BANDS[channel - 1];
}

export function findClosestBand(wavelengthUm: number): SpherexBand {
  let closest = SPHEREX_BANDS[0];
  let minDiff = Math.abs(closest.wavelength_um - wavelengthUm);

  for (let i = 1; i < SPHEREX_BANDS.length; i++) {
    const band = SPHEREX_BANDS[i];
    const diff = Math.abs(band.wavelength_um - wavelengthUm);
    if (diff < minDiff) {
      minDiff = diff;
      closest = band;
    }
  }

  return closest;
}
