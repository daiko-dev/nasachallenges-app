export type Release = 'dr1' | 'qr3';

export interface Epoch {
  id: string;
  obsId: string;
  utc: string;
  release: Release;
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  lambdaUm: number;
  bandwidthUm: number;
  frameUrl: string;
  sourceUrl: string;
}

export interface CandidateTrackPoint {
  epochId: string;
  x: number;
  y: number;
  ra: number;
  dec: number;
}

export interface Candidate {
  id: string;
  kind: 'moved_source' | 'unmatched_source';
  status: 'candidate';
  track: CandidateTrackPoint[];
  snr: number;
  match: {
    catalog: string;
    name: string;
    sepArcsec: number;
  } | null;
  explanation: {
    text: string;
    source: 'template' | 'llm';
  } | null;
}

export interface FieldManifest {
  schemaVersion: '1.0';
  id: string;
  name: string;
  ra: number;
  dec: number;
  fovDeg: number;
  grid: {
    widthPx: number;
    heightPx: number;
    pixScaleArcsec: number;
  };
  epochs: Epoch[];
  matchedPairs: [string, string][];
  candidates: Candidate[];
  message: string | null;
  provenance: {
    collection: string;
    retrievedUtc: string;
    synthetic: boolean;
    credit: string;
  };
}

export interface FieldError {
  status: number;
  message: string;
  fallbackAvailable: boolean;
}

export interface ViewState {
  ra: number;
  dec: number;
  fovDeg: number;
}

export interface BandInfo {
  channel: number;
  wavelength_um: number;
  detector_array: string;
  label: string;
}
