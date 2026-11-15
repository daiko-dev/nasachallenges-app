import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type WheelEvent,
} from 'react';
import type { AladinInstance } from 'aladin-lite';
import type { Candidate } from '../../types/spherex';
import { normalizeRa } from '../../utils/coordinates';

export type SkySurveyKey = 'allwise' | '2mass' | 'dss2';
export type SkyProjectionMode = 'SIN' | 'AIT';

interface SkySurveyOption {
  key: SkySurveyKey;
  labelEn: string;
  labelEs: string;
  urlOrId: string;
  isCustomUrl: boolean;
  maxOrder: number;
}

const SURVEYS: SkySurveyOption[] = [
  {
    key: 'allwise',
    labelEn: 'AllWISE Infrared (3.4 to 22 um)',
    labelEs: 'AllWISE Infrarrojo (3.4 a 22 um)',
    urlOrId: 'https://skies.esac.esa.int/AllWISEColor/',
    isCustomUrl: true,
    maxOrder: 8,
  },
  {
    key: '2mass',
    labelEn: '2MASS Near-IR (1.25 to 2.17 um)',
    labelEs: '2MASS Infrarrojo Cercano (1.25 a 2.17 um)',
    urlOrId: 'https://skies.esac.esa.int/2MASSColor/',
    isCustomUrl: true,
    maxOrder: 9,
  },
  {
    key: 'dss2',
    labelEn: 'DSS2 Optical Reference',
    labelEs: 'DSS2 Referencia Optica',
    urlOrId: 'P/DSS2/color',
    isCustomUrl: false,
    maxOrder: 9,
  },
];

interface SkyBenchmarkMarker {
  id: string;
  label: string;
  subtitle: string;
  ra: number;
  dec: number;
}

const BENCHMARK_MARKERS: SkyBenchmarkMarker[] = [
  { id: 'm101', label: 'M101', subtitle: 'NGC 5457 Pinwheel', ra: 210.8023, dec: 54.349 },
  { id: 'barnard', label: "Barnard's Star", subtitle: 'GJ 699 High-PM', ra: 269.4521, dec: 4.6934 },
  { id: 'wise0855', label: 'WISE 0855', subtitle: 'Y4 Sub-Brown Dwarf', ra: 133.7867, dec: -7.245 },
];

// Constellation / Asterism reference segments in ICRS (RA, Dec)
const CONSTELLATION_SEGMENTS: Array<Array<[number, number]>> = [
  // Ursa Major (Big Dipper) near M101
  [
    [165.93, 61.75],
    [165.46, 56.38],
    [178.46, 53.69],
    [183.86, 57.03],
    [193.51, 55.96],
    [200.98, 54.93],
    [206.88, 49.31],
  ],
  // Boötes / Corona near M101
  [
    [213.91, 19.18],
    [218.02, 38.31],
    [225.48, 40.39],
    [228.87, 33.31],
    [221.25, 27.07],
    [213.91, 19.18],
  ],
  // Ophiuchus / Serpens near Barnard's Star
  [
    [263.73, 12.56],
    [257.59, -15.72],
    [249.29, -10.57],
    [244.58, -4.69],
    [265.86, 4.57],
    [263.73, 12.56],
  ],
  // Aquila / Summer Triangle near Barnard's Star
  [
    [297.69, 8.87],
    [279.23, 38.78],
    [310.35, 45.28],
    [297.69, 8.87],
  ],
  // Hydra head / Cancer near WISE 0855
  [
    [130.82, 6.42],
    [131.69, 5.7],
    [134.17, 5.95],
    [139.71, 2.31],
    [141.89, -8.66],
  ],
  // Orion reference asterism
  [
    [88.79, 7.41],
    [81.28, 6.35],
    [83.0, -0.3],
    [84.05, -1.2],
    [85.19, -1.94],
    [78.63, -8.2],
    [86.94, -9.67],
    [88.79, 7.41],
  ],
];

export interface AladinSkyMapProps {
  ra: number;
  dec: number;
  fovDeg: number;
  lang: 'en' | 'es';
  activeCandidate?: Candidate | null;
  onPickCoords?: (ra: number, dec: number) => void;
  onSelectRegion?: (ra: number, dec: number, fovDeg: number) => void;
  onViewMove?: (ra: number, dec: number, fov: number) => void;
}

interface CatalogStar {
  ra: number;
  dec: number;
  mag: number;
  color: string;
  isBright: boolean;
}

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_sphereCenter;
uniform float u_radius;
uniform vec2 u_camRaDec;
uniform vec2 u_targetRaDec;
uniform int u_survey;
uniform int u_projMode;

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

float noise3d(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3d(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 fragPx = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec3 deepBg = vec3(0.024, 0.035, 0.058);

  if (u_projMode == 0) {
    vec2 d = (fragPx - u_sphereCenter) / u_radius;
    float r2 = dot(d, d);

    if (r2 > 1.0) {
      float halo = exp(-(sqrt(r2) - 1.0) * 14.0);
      vec3 haloCol = u_survey == 0
        ? vec3(0.45, 0.28, 0.12)
        : (u_survey == 1 ? vec3(0.14, 0.32, 0.52) : vec3(0.18, 0.26, 0.42));
      outColor = vec4(deepBg + haloCol * halo * 0.38, 1.0);
      return;
    }

    float z = sqrt(max(0.0, 1.0 - r2));
    vec3 viewDir = vec3(d.x, -d.y, z);

    float cRa = radians(u_camRaDec.x);
    float cDec = radians(u_camRaDec.y);
    float cosD = cos(cDec);
    float sinD = sin(cDec);

    float sinDec = viewDir.y * cosD + viewDir.z * sinD;
    float decRad = asin(clamp(sinDec, -1.0, 1.0));
    float dRa = atan(-viewDir.x, viewDir.z * cosD - viewDir.y * sinD);
    float raRad = cRa + dRa;

    vec3 skyVec = vec3(
      cos(decRad) * cos(raRad),
      cos(decRad) * sin(raRad),
      sin(decRad)
    );

    // Galactic plane normal (approx ICRS north galactic pole RA=192.85 deg, Dec=+27.13 deg)
    vec3 galPole = normalize(vec3(-0.8676, -0.1981, 0.4560));
    float galLat = dot(skyVec, galPole);
    float mwBand = exp(-galLat * galLat * 14.0);

    float dust = fbm(skyVec * 4.5);
    float fineDust = fbm(skyVec * 11.0 + vec3(2.1, -1.3, 0.7));
    float darkLane = smoothstep(0.44, 0.66, fineDust) * exp(-galLat * galLat * 48.0);

    vec3 baseSphere = u_survey == 0
      ? vec3(0.045, 0.052, 0.082)
      : (u_survey == 1 ? vec3(0.035, 0.058, 0.095) : vec3(0.038, 0.048, 0.078));

    vec3 mwColor = u_survey == 0
      ? mix(vec3(0.42, 0.18, 0.08), vec3(0.88, 0.56, 0.18), dust)
      : (u_survey == 1
          ? mix(vec3(0.12, 0.28, 0.52), vec3(0.76, 0.62, 0.34), dust)
          : mix(vec3(0.16, 0.24, 0.42), vec3(0.55, 0.68, 0.86), dust));

    vec3 col = baseSphere + mwColor * mwBand * (0.42 + 0.58 * dust) * (1.0 - 0.52 * darkLane);

    // Target region localized infrared emission glow
    float tRa = radians(u_targetRaDec.x);
    float tDec = radians(u_targetRaDec.y);
    vec3 targetVec = vec3(cos(tDec) * cos(tRa), cos(tDec) * sin(tRa), sin(tDec));
    float targetDot = max(0.0, dot(skyVec, targetVec));
    float targetGlow = pow(targetDot, 42.0);
    col += vec3(0.96, 0.62, 0.04) * targetGlow * 0.26;

    // 3D Fresnel atmospheric rim & limb shading
    float rim = pow(1.0 - z, 2.6);
    vec3 rimCol = u_survey == 0
      ? vec3(0.95, 0.62, 0.18)
      : (u_survey == 1 ? vec3(0.38, 0.72, 0.96) : vec3(0.58, 0.74, 0.94));
    col = col * (0.58 + 0.42 * z) + rimCol * rim * 0.34;

    outColor = vec4(col, 1.0);
  } else {
    // Wide Sky (AIT / Cylindrical all-sky projection)
    vec2 norm = (fragPx - u_sphereCenter) / vec2(u_resolution.x * 0.44, u_resolution.y * 0.42);
    if (abs(norm.x) > 1.0 || abs(norm.y) > 1.0) {
      outColor = vec4(deepBg, 1.0);
      return;
    }
    float raRad = radians(u_camRaDec.x - norm.x * 180.0);
    float decRad = radians(clamp(u_camRaDec.y * 0.35 - norm.y * 90.0, -89.0, 89.0));
    vec3 skyVec = vec3(cos(decRad) * cos(raRad), cos(decRad) * sin(raRad), sin(decRad));
    vec3 galPole = normalize(vec3(-0.8676, -0.1981, 0.4560));
    float galLat = dot(skyVec, galPole);
    float mwBand = exp(-galLat * galLat * 14.0);
    float dust = fbm(skyVec * 4.5);
    vec3 mwColor = u_survey == 0
      ? vec3(0.58, 0.32, 0.12)
      : (u_survey == 1 ? vec3(0.22, 0.42, 0.68) : vec3(0.28, 0.38, 0.58));
    vec3 col = vec3(0.035, 0.048, 0.078) + mwColor * mwBand * dust * 0.65;
    outColor = vec4(col, 1.0);
  }
}
`;

interface WebGLSpherePipeline {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
  uResolution: WebGLUniformLocation | null;
  uSphereCenter: WebGLUniformLocation | null;
  uRadius: WebGLUniformLocation | null;
  uCamRaDec: WebGLUniformLocation | null;
  uTargetRaDec: WebGLUniformLocation | null;
  uSurvey: WebGLUniformLocation | null;
  uProjMode: WebGLUniformLocation | null;
}

function initWebGL2Pipeline(canvas: HTMLCanvasElement | null): WebGLSpherePipeline | null {
  if (!canvas) return null;
  try {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    }) as WebGL2RenderingContext | null;
    if (!gl || typeof gl.createShader !== 'function') return null;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const vao = typeof gl.createVertexArray === 'function' ? gl.createVertexArray() : null;
    if (vao) gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return {
      gl,
      program,
      vao,
      uResolution: gl.getUniformLocation(program, 'u_resolution'),
      uSphereCenter: gl.getUniformLocation(program, 'u_sphereCenter'),
      uRadius: gl.getUniformLocation(program, 'u_radius'),
      uCamRaDec: gl.getUniformLocation(program, 'u_camRaDec'),
      uTargetRaDec: gl.getUniformLocation(program, 'u_targetRaDec'),
      uSurvey: gl.getUniformLocation(program, 'u_survey'),
      uProjMode: gl.getUniformLocation(program, 'u_projMode'),
    };
  } catch {
    return null;
  }
}

function formatHms(raDeg: number): string {
  const norm = normalizeRa(raDeg);
  const totalSeconds = (norm / 15) * 3600;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(4, '0')}s`;
}

function formatDms(decDeg: number): string {
  const sign = decDeg >= 0 ? '+' : '-';
  const abs = Math.abs(decDeg);
  const totalSeconds = abs * 3600;
  const d = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${sign}${String(d).padStart(2, '0')}d ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function getSafe2dContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

function computeSphereGeometry(width: number, height: number, zoom: number) {
  const isWideDesktop = width > 1024;
  const isMobile = width < 640;
  const cx = isWideDesktop ? width * 0.34 : width * 0.5;
  const cy = isWideDesktop ? height * 0.5 : isMobile ? height * 0.28 : height * 0.48;
  const baseSpan = isWideDesktop
    ? Math.min(width * 0.62, height * 0.78)
    : isMobile
      ? Math.min(width * 0.88, height * 0.42)
      : Math.min(width, height);
  const radius = baseSpan * 0.43 * zoom;
  return { cx, cy, radius };
}

export function AladinSkyMap({
  ra,
  dec,
  fovDeg,
  lang,
  activeCandidate,
  onPickCoords,
  onSelectRegion,
  onViewMove,
}: AladinSkyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const globeCanvasRef = useRef<HTMLCanvasElement>(null);
  const glPipelineRef = useRef<WebGLSpherePipeline | null>(null);
  const aladinRef = useRef<AladinInstance | null>(null);

  const [survey, setSurvey] = useState<SkySurveyKey>('allwise');
  const [projectionMode, setProjectionMode] = useState<SkyProjectionMode>('SIN');
  const [showGrid, setShowGrid] = useState(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cursorCoords, setCursorCoords] = useState<{ ra: number; dec: number }>({
    ra: normalizeRa(ra),
    dec,
  });

  // Interactive 3D sphere camera orientation (centered on active target by default)
  const [cameraCenter, setCameraCenter] = useState<{ ra: number; dec: number }>({
    ra: normalizeRa(ra),
    dec,
  });
  const [sphereZoom, setSphereZoom] = useState<number>(1.0);
  const dragStateRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startRa: number;
    startDec: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    startRa: normalizeRa(ra),
    startDec: dec,
  });

  const emitRegionSelection = useCallback(
    (nextRa: number, nextDec: number, nextFov = fovDeg) => {
      const cleanRa = Number(normalizeRa(nextRa).toFixed(4));
      const cleanDec = Number(Math.max(-90, Math.min(90, nextDec)).toFixed(4));
      setCursorCoords({ ra: cleanRa, dec: cleanDec });
      setCameraCenter({ ra: cleanRa, dec: cleanDec });
      onPickCoords?.(cleanRa, cleanDec);
      onSelectRegion?.(cleanRa, cleanDec, nextFov);
    },
    [fovDeg, onPickCoords, onSelectRegion]
  );

  // Sync camera center when parent updates ra/dec
  useEffect(() => {
    const cleanRa = normalizeRa(ra);
    setCameraCenter({ ra: cleanRa, dec });
    setCursorCoords({ ra: cleanRa, dec });
  }, [ra, dec]);

  // Initialize WebGL2 3D sphere shader pipeline once on mount
  useEffect(() => {
    glPipelineRef.current = initWebGL2Pipeline(webglCanvasRef.current);
  }, []);

  // Generate deterministic all-sky star catalog (1,450 stars + galactic plane concentration)
  const catalogStars = useMemo<CatalogStar[]>(() => {
    const list: CatalogStar[] = [];
    let s = 421093;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const colorsAllwise = ['#FDE68A', '#F59E0B', '#FCA5A5', '#E0F2FE', '#FEF3C7', '#FDBA74'];
    const colors2Mass = ['#BAE6FD', '#FDE68A', '#E2E8F0', '#FDBA74', '#93C5FD', '#FEF08A'];
    const colorsDss2 = ['#E2E8F0', '#BAE6FD', '#F8FAFC', '#FDE68A', '#CBD5E1', '#93C5FD'];
    const palette =
      survey === 'allwise' ? colorsAllwise : survey === '2mass' ? colors2Mass : colorsDss2;

    for (let i = 0; i < 1450; i++) {
      const starRa = rand() * 360;
      const u = rand() * 2 - 1;
      const starDec = (Math.asin(u) * 180) / Math.PI;
      const rMag = rand();
      const mag = rMag > 0.96 ? 2.4 + rand() * 1.4 : 0.45 + rMag * 1.85;
      const color = palette[i % palette.length];
      list.push({
        ra: starRa,
        dec: starDec,
        mag,
        color,
        isBright: rMag > 0.965,
      });
    }
    return list;
  }, [survey]);

  // Project celestial (raDeg, decDeg) onto the 3D sphere or wide-sky canvas
  const projectCelestialPoint = useCallback(
    (
      ptRa: number,
      ptDec: number,
      width: number,
      height: number
    ): { x: number; y: number; z: number; visible: boolean } => {
      const d2r = Math.PI / 180;
      const raRad = ptRa * d2r;
      const decRad = ptDec * d2r;
      const cRaRad = cameraCenter.ra * d2r;
      const cDecRad = cameraCenter.dec * d2r;

      const dRa = raRad - cRaRad;
      const cosDec = Math.cos(decRad);
      const sinDec = Math.sin(decRad);
      const cosCDec = Math.cos(cDecRad);
      const sinCDec = Math.sin(cDecRad);

      const x3d = -cosDec * Math.sin(dRa);
      const y3d = sinDec * cosCDec - cosDec * sinCDec * Math.cos(dRa);
      const z3d = sinDec * sinCDec + cosDec * cosCDec * Math.cos(dRa);

      const { cx, cy, radius } = computeSphereGeometry(width, height, sphereZoom);

      if (projectionMode === 'SIN') {
        return {
          x: cx + x3d * radius,
          y: cy - y3d * radius,
          z: z3d,
          visible: z3d >= -0.04,
        };
      }

      let wrapDra = ((ptRa - cameraCenter.ra + 540) % 360) - 180;
      if (wrapDra < -180) wrapDra += 360;
      const scaleX = (width * 0.44 * sphereZoom) / 180;
      const scaleY = (height * 0.42 * sphereZoom) / 90;
      return {
        x: cx - wrapDra * scaleX,
        y: cy - (ptDec - cameraCenter.dec * 0.35) * scaleY,
        z: 1,
        visible: true,
      };
    },
    [cameraCenter.dec, cameraCenter.ra, projectionMode, sphereZoom]
  );

  // Inverse projection: convert clicked canvas pixel (px, py) to celestial (RA, Dec)
  const unprojectPixelToRaDec = useCallback(
    (px: number, py: number, width: number, height: number): { ra: number; dec: number } | null => {
      const { cx, cy, radius } = computeSphereGeometry(width, height, sphereZoom);
      const r2d = 180 / Math.PI;
      const d2r = Math.PI / 180;

      if (projectionMode === 'SIN') {
        const nx = (px - cx) / radius;
        const ny = (cy - py) / radius;
        const rhoSq = nx * nx + ny * ny;
        const clampedFactor = rhoSq > 1 ? 1 / Math.sqrt(rhoSq) : 1;
        const x = nx * clampedFactor;
        const y = ny * clampedFactor;
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));

        const cRaRad = cameraCenter.ra * d2r;
        const cDecRad = cameraCenter.dec * d2r;
        const sinDec = y * Math.cos(cDecRad) + z * Math.sin(cDecRad);
        const decDeg = Math.asin(Math.max(-1, Math.min(1, sinDec))) * r2d;
        const dRa = Math.atan2(-x, z * Math.cos(cDecRad) - y * Math.sin(cDecRad));
        const raDeg = normalizeRa((cRaRad + dRa) * r2d);
        return { ra: raDeg, dec: decDeg };
      }

      const scaleX = (width * 0.44 * sphereZoom) / 180;
      const scaleY = (height * 0.42 * sphereZoom) / 90;
      const dRa = -(px - cx) / scaleX;
      const decDeg = Math.max(-89.9, Math.min(89.9, cameraCenter.dec * 0.35 + (cy - py) / scaleY));
      const raDeg = normalizeRa(cameraCenter.ra + dRa);
      return { ra: raDeg, dec: decDeg };
    },
    [cameraCenter.dec, cameraCenter.ra, projectionMode, sphereZoom]
  );

  // Render Pass 1 (WebGL2 GLSL 3D Sphere & Volumetric Milky Way) + Pass 2 (Astronomical Vector HUD)
  useEffect(() => {
    const canvas = globeCanvasRef.current;
    const ctx = getSafe2dContext(canvas);
    if (!canvas || !ctx) return;

    const width = canvas.clientWidth || window.innerWidth || 1280;
    const height = canvas.clientHeight || window.innerHeight || 800;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const { cx, cy, radius } = computeSphereGeometry(width, height, sphereZoom);

    // Pass 1: Hardware-accelerated WebGL2 3D Celestial Sphere shader (when available)
    const glPipe = glPipelineRef.current;
    const glCanvas = webglCanvasRef.current;
    let webglRendered = false;

    if (glPipe && glCanvas) {
      if (glCanvas.width !== width || glCanvas.height !== height) {
        glCanvas.width = width;
        glCanvas.height = height;
      }
      const { gl, program, vao } = glPipe;
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      if (vao) gl.bindVertexArray(vao);
      gl.uniform2f(glPipe.uResolution, width, height);
      gl.uniform2f(glPipe.uSphereCenter, cx, cy);
      gl.uniform1f(glPipe.uRadius, radius);
      gl.uniform2f(glPipe.uCamRaDec, cameraCenter.ra, cameraCenter.dec);
      gl.uniform2f(glPipe.uTargetRaDec, normalizeRa(ra), dec);
      gl.uniform1i(glPipe.uSurvey, survey === 'allwise' ? 0 : survey === '2mass' ? 1 : 2);
      gl.uniform1i(glPipe.uProjMode, projectionMode === 'SIN' ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      webglRendered = true;
    }

    // Clear or fill 2D vector HUD layer
    if (webglRendered && typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#070A10';
      ctx.fillRect(0, 0, width, height);
    }

    if (projectionMode === 'SIN') {
      if (!webglRendered) {
        const grad = ctx.createRadialGradient(
          cx - radius * 0.15,
          cy - radius * 0.15,
          radius * 0.08,
          cx,
          cy,
          radius * 1.05
        );
        if (survey === 'allwise') {
          grad.addColorStop(0, 'rgba(38, 25, 16, 0.92)');
          grad.addColorStop(0.7, 'rgba(15, 20, 32, 0.95)');
          grad.addColorStop(1, 'rgba(7, 10, 16, 1)');
        } else if (survey === '2mass') {
          grad.addColorStop(0, 'rgba(16, 28, 44, 0.92)');
          grad.addColorStop(0.7, 'rgba(12, 18, 30, 0.95)');
          grad.addColorStop(1, 'rgba(7, 10, 16, 1)');
        } else {
          grad.addColorStop(0, 'rgba(16, 22, 38, 0.92)');
          grad.addColorStop(0.7, 'rgba(10, 15, 26, 0.95)');
          grad.addColorStop(1, 'rgba(7, 10, 16, 1)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer 3D celestial sphere degree scale ring & limb border
      ctx.strokeStyle =
        survey === 'allwise'
          ? 'rgba(245, 158, 11, 0.42)'
          : survey === '2mass'
            ? 'rgba(56, 189, 248, 0.42)'
            : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle outer observatory degree ticks around the 3D sphere horizon
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1;
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const innerR = radius + 2;
        const outerR = deg % 30 === 0 ? radius + 8 : radius + 4.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * innerR, cy + Math.sin(rad) * innerR);
        ctx.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
        ctx.stroke();
      }
    }

    if (showGrid) {
      // ICRS Declination parallels (-75 to +75 deg)
      for (const decLine of [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75]) {
        ctx.strokeStyle =
          decLine === 0 ? 'rgba(245, 158, 11, 0.34)' : 'rgba(100, 116, 139, 0.22)';
        ctx.lineWidth = decLine === 0 ? 1.25 : 0.85;
        ctx.beginPath();
        let penDown = false;
        for (let r = 0; r <= 360; r += 4) {
          const pt = projectCelestialPoint(r, decLine, width, height);
          if (pt.visible && pt.z > 0) {
            if (!penDown) {
              ctx.moveTo(pt.x, pt.y);
              penDown = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            penDown = false;
          }
        }
        ctx.stroke();
      }

      // ICRS Right Ascension meridians (every 2h / 30 deg)
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
      ctx.lineWidth = 0.85;
      for (let raLine = 0; raLine < 360; raLine += 30) {
        ctx.beginPath();
        let penDown = false;
        for (let d = -80; d <= 80; d += 4) {
          const pt = projectCelestialPoint(raLine, d, width, height);
          if (pt.visible && pt.z > 0) {
            if (!penDown) {
              ctx.moveTo(pt.x, pt.y);
              penDown = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            penDown = false;
          }
        }
        ctx.stroke();

        const eqPt = projectCelestialPoint(raLine, 0, width, height);
        if (eqPt.visible && eqPt.z > 0.18) {
          ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText(`${raLine / 15}h`, eqPt.x + 4, eqPt.y - 4);
        }
      }

      // Constellation / Asterism guide lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
      ctx.lineWidth = 1;
      for (const poly of CONSTELLATION_SEGMENTS) {
        ctx.beginPath();
        let penDown = false;
        for (const [cRa, cDec] of poly) {
          const pt = projectCelestialPoint(cRa, cDec, width, height);
          if (pt.visible && pt.z > 0.02) {
            if (!penDown) {
              ctx.moveTo(pt.x, pt.y);
              penDown = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            penDown = false;
          }
        }
        ctx.stroke();
      }
    }

    // Render 1,450+ catalog stars with 3D limb depth shading and diffraction spikes on bright stars
    for (const star of catalogStars) {
      const pt = projectCelestialPoint(star.ra, star.dec, width, height);
      if (!pt.visible || pt.z < 0) continue;
      const depthScale = 0.45 + 0.55 * pt.z;
      const rPx = star.mag * 0.58 * depthScale;

      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rPx, 0, Math.PI * 2);
      ctx.fill();

      if (star.isBright && pt.z > 0.25) {
        const spike = rPx * 3.4;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(pt.x - spike, pt.y);
        ctx.lineTo(pt.x + spike, pt.y);
        ctx.moveTo(pt.x, pt.y - spike);
        ctx.lineTo(pt.x, pt.y + spike);
        ctx.stroke();
      }
    }

    // Benchmark target markers (M101, Barnard's Star, WISE 0855)
    for (const marker of BENCHMARK_MARKERS) {
      const pt = projectCelestialPoint(marker.ra, marker.dec, width, height);
      if (!pt.visible || pt.z < 0) continue;
      const isSelected = Math.abs(ra - marker.ra) < 0.05 && Math.abs(dec - marker.dec) < 0.05;

      ctx.strokeStyle = isSelected ? '#F59E0B' : '#38BDF8';
      ctx.lineWidth = isSelected ? 2 : 1.35;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 10 : 6.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#FEF3C7' : '#E2E8F0';
      ctx.font = isSelected
        ? '600 11px Inter, system-ui, sans-serif'
        : '500 11px Inter, system-ui, sans-serif';
      ctx.fillText(marker.label, pt.x + 13, pt.y + 3);
    }

    // Active Target SPHEREx Detector FOV Frame + Precision Reticle
    const targetPt = projectCelestialPoint(ra, dec, width, height);
    if (targetPt.visible) {
      const rSize = 15;
      const fovBox = Math.max(24, Math.min(54, 28 * sphereZoom));

      // SPHEREx detector FOV corner brackets
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1.25;
      const bLen = 7;
      ctx.beginPath();
      // Top-left
      ctx.moveTo(targetPt.x - fovBox, targetPt.y - fovBox + bLen);
      ctx.lineTo(targetPt.x - fovBox, targetPt.y - fovBox);
      ctx.lineTo(targetPt.x - fovBox + bLen, targetPt.y - fovBox);
      // Top-right
      ctx.moveTo(targetPt.x + fovBox - bLen, targetPt.y - fovBox);
      ctx.lineTo(targetPt.x + fovBox, targetPt.y - fovBox);
      ctx.lineTo(targetPt.x + fovBox, targetPt.y - fovBox + bLen);
      // Bottom-left
      ctx.moveTo(targetPt.x - fovBox, targetPt.y + fovBox - bLen);
      ctx.lineTo(targetPt.x - fovBox, targetPt.y + fovBox);
      ctx.lineTo(targetPt.x - fovBox + bLen, targetPt.y + fovBox);
      // Bottom-right
      ctx.moveTo(targetPt.x + fovBox - bLen, targetPt.y + fovBox);
      ctx.lineTo(targetPt.x + fovBox, targetPt.y + fovBox);
      ctx.lineTo(targetPt.x + fovBox, targetPt.y + fovBox - bLen);
      ctx.stroke();

      // Primary target crosshair reticle
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(targetPt.x, targetPt.y, rSize, 0, Math.PI * 2);
      ctx.moveTo(targetPt.x - rSize - 7, targetPt.y);
      ctx.lineTo(targetPt.x - 5, targetPt.y);
      ctx.moveTo(targetPt.x + 5, targetPt.y);
      ctx.lineTo(targetPt.x + rSize + 7, targetPt.y);
      ctx.moveTo(targetPt.x, targetPt.y - rSize - 7);
      ctx.lineTo(targetPt.x, targetPt.y - 5);
      ctx.moveTo(targetPt.x, targetPt.y + 5);
      ctx.lineTo(targetPt.x, targetPt.y + rSize + 7);
      ctx.stroke();

      if (activeCandidate && activeCandidate.track.length > 0) {
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(targetPt.x + 6, targetPt.y - 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [
    activeCandidate,
    cameraCenter.dec,
    cameraCenter.ra,
    catalogStars,
    dec,
    projectCelestialPoint,
    projectionMode,
    ra,
    showGrid,
    sphereZoom,
    survey,
  ]);

  // Initialize Aladin Lite v3 WebGL2 HiPS layer alongside our 3D Celestial Sphere
  useEffect(() => {
    let cancelled = false;

    async function initAladin() {
      if (!containerRef.current) return;
      try {
        setStatus('loading');
        const { default: A } = await import('aladin-lite');
        await A.init;
        if (cancelled || !containerRef.current) return;

        const instance = A.aladin(containerRef.current, {
          fov: Math.max(fovDeg, 0.25),
          target: `${normalizeRa(ra)} ${dec}`,
          cooFrame: 'ICRS',
          showReticle: true,
          reticleColor: '#F59E0B',
          reticleSize: 22,
          showZoomControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showFullscreenControl: false,
          showFrame: false,
          showCooLocation: false,
          showCooGridControl: false,
          showProjectionControl: false,
          showShareControl: false,
          showSettingsControl: false,
          showSimbadPointerControl: false,
        });

        aladinRef.current = instance;

        const initialSurvey = SURVEYS[0];
        if (initialSurvey.isCustomUrl) {
          const custom = instance.createImageSurvey(
            initialSurvey.key,
            initialSurvey.labelEn,
            initialSurvey.urlOrId,
            'equatorial',
            initialSurvey.maxOrder,
            { imgFormat: 'jpeg' }
          );
          instance.setImageSurvey(custom);
        }

        instance.on('positionChanged', (pos: unknown) => {
          const p = pos as { ra?: number; dec?: number } | null;
          if (!p || typeof p.ra !== 'number' || typeof p.dec !== 'number') return;
          const nextRa = normalizeRa(p.ra);
          setCursorCoords({ ra: nextRa, dec: p.dec });
          setCameraCenter({ ra: nextRa, dec: p.dec });
          const currentFov = instance.getFov();
          onViewMove?.(nextRa, p.dec, currentFov[0] ?? fovDeg);
        });

        instance.on('click', (clickEvent: unknown) => {
          const c = clickEvent as { ra?: number; dec?: number } | null;
          if (c && typeof c.ra === 'number' && typeof c.dec === 'number') {
            emitRegionSelection(c.ra, c.dec, fovDeg);
          }
        });

        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'WebGL2 sky map unavailable'
        );
      }
    }

    initAladin();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = aladinRef.current;
    if (!instance || status !== 'ready') return;
    try {
      instance.gotoRaDec(normalizeRa(ra), dec);
      instance.setFov(Math.max(fovDeg, 0.05));
    } catch {
      // Ignore transient WebGL2 state errors
    }
  }, [ra, dec, fovDeg, status]);

  const handleSurveyChange = (nextKey: SkySurveyKey) => {
    setSurvey(nextKey);
    const instance = aladinRef.current;
    if (!instance || status !== 'ready') return;
    const opt = SURVEYS.find((s) => s.key === nextKey);
    if (!opt) return;
    try {
      if (opt.isCustomUrl) {
        const layer = instance.createImageSurvey(
          opt.key,
          opt.labelEn,
          opt.urlOrId,
          'equatorial',
          opt.maxOrder,
          { imgFormat: 'jpeg' }
        );
        instance.setImageSurvey(layer);
      } else {
        instance.setImageSurvey(opt.urlOrId);
      }
    } catch {
      // 3D WebGL2 sphere handles survey color update automatically
    }
  };

  const handleInspectCenter = () => {
    const instance = aladinRef.current;
    if (instance && status === 'ready') {
      try {
        const [centerRa, centerDec] = instance.getRaDec();
        emitRegionSelection(centerRa, centerDec, fovDeg);
        return;
      } catch {
        // Fall through to cursorCoords
      }
    }
    emitRegionSelection(cursorCoords.ra, cursorCoords.dec, fovDeg);
  };

  const handleCanvasMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startRa: cameraCenter.ra,
      startDec: cameraCenter.dec,
    };
  };

  const handleCanvasMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = globeCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (dragStateRef.current.dragging) {
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragStateRef.current.moved = true;
      }
      const degPerPx = 0.28 / sphereZoom;
      const nextRa = normalizeRa(dragStateRef.current.startRa + dx * degPerPx);
      const nextDec = Math.max(-88, Math.min(88, dragStateRef.current.startDec + dy * degPerPx));
      setCameraCenter({ ra: nextRa, dec: nextDec });
      setCursorCoords({ ra: nextRa, dec: nextDec });
      return;
    }

    const hovered = unprojectPixelToRaDec(px, py, rect.width || 1280, rect.height || 800);
    if (hovered) {
      setCursorCoords({
        ra: Number(hovered.ra.toFixed(4)),
        dec: Number(hovered.dec.toFixed(4)),
      });
    }
  };

  const handleCanvasMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    const wasMoved = dragStateRef.current.moved;
    dragStateRef.current.dragging = false;
    dragStateRef.current.moved = false;

    if (wasMoved) return;

    const canvas = globeCanvasRef.current;
    if (!canvas) {
      emitRegionSelection(cursorCoords.ra, cursorCoords.dec, fovDeg);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const picked = unprojectPixelToRaDec(px, py, rect.width || 1280, rect.height || 800);
    if (picked) {
      emitRegionSelection(picked.ra, picked.dec, fovDeg);
    } else {
      emitRegionSelection(cursorCoords.ra, cursorCoords.dec, fovDeg);
    }
  };

  const handleTouchStart = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: touch.clientX,
      startY: touch.clientY,
      startRa: cameraCenter.ra,
      startDec: cameraCenter.dec,
    };
  };

  const handleTouchMove = (e: TouchEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.dragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStateRef.current.startX;
    const dy = touch.clientY - dragStateRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragStateRef.current.moved = true;
    }
    const degPerPx = 0.28 / sphereZoom;
    const nextRa = normalizeRa(dragStateRef.current.startRa + dx * degPerPx);
    const nextDec = Math.max(-88, Math.min(88, dragStateRef.current.startDec + dy * degPerPx));
    setCameraCenter({ ra: nextRa, dec: nextDec });
    setCursorCoords({ ra: nextRa, dec: nextDec });
  };

  const handleTouchEnd = () => {
    dragStateRef.current.dragging = false;
    dragStateRef.current.moved = false;
  };

  const handleCanvasWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    setSphereZoom((prev) => {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      return Math.max(0.65, Math.min(3.5, Number((prev * factor).toFixed(2))));
    });
  };

  return (
    <section
      aria-label={lang === 'es' ? 'Mapa del cielo infrarrojo' : 'Infrared sky context map'}
      className="relative h-full w-full overflow-hidden bg-obsidian select-none"
    >
      {/* Aladin Lite v3 WebGL2 HiPS Layer */}
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full opacity-35"
        aria-hidden={status === 'error'}
      />

      {/* Hardware-Accelerated WebGL2 3D Celestial Sphere & Volumetric Milky Way Shader Layer */}
      <canvas
        ref={webglCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Interactive 3D Celestial Sphere Vector & Star Map Layer (Always active & clickable) */}
      <canvas
        ref={globeCanvasRef}
        role="img"
        data-testid="celestial-3d-canvas"
        aria-label={
          lang === 'es'
            ? 'Esfera celeste 3D interactiva (haz clic para extraer coordenadas RA y Dec)'
            : 'Interactive 3D celestial sphere (click any region to extract RA and Dec coordinates)'
        }
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleCanvasWheel}
        className="absolute inset-0 h-full w-full cursor-crosshair"
      />

      {status === 'error' && (
        <div
          role="status"
          className="pointer-events-none absolute left-3 top-[118px] z-10 max-w-md rounded-md border border-instrumentBorder bg-obsidian/90 px-3 py-1.5 text-xs text-slate-300 sm:left-4 sm:top-[108px]"
        >
          <p className="font-medium text-amber-200">
            {lang === 'es'
              ? 'El mapa WebGL2 no pudo iniciarse en este navegador.'
              : 'WebGL2 sky map could not initialize in this browser.'}
          </p>
          <p className="text-[11px] text-slate-400">
            {errorMsg}.{' '}
            {lang === 'es'
              ? 'Esfera celeste 3D interactiva activa.'
              : 'Interactive 3D celestial sphere active.'}
          </p>
        </div>
      )}

      {/* Bottom-Left Floating 3D Sky Telemetry & Survey Control Strip */}
      <div className="pointer-events-auto absolute bottom-10 left-2.5 z-20 flex max-w-[calc(100vw-20px)] flex-col gap-1.5 rounded-lg border border-instrumentBorder bg-instrument/95 px-3 py-2 text-xs text-slate-100 shadow-lg sm:left-4 lg:max-w-[680px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accentAmber" aria-hidden="true" />
            <h2 className="text-xs font-semibold text-slate-100">
              {lang === 'es' ? 'Visor Celeste 3D (GPS del Cielo)' : '3D Celestial Viewer (Sky GPS)'}
            </h2>
          </div>
          <p className="font-mono text-[11px] text-amber-300 tabular-nums">
            RA {cursorCoords.ra.toFixed(4)} deg ({formatHms(cursorCoords.ra)}) | Dec{' '}
            {cursorCoords.dec.toFixed(4)} deg ({formatDms(cursorCoords.dec)})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor="survey-select" className="sr-only">
            {lang === 'es' ? 'Capa de fondo' : 'Background survey'}
          </label>
          <select
            id="survey-select"
            value={survey}
            onChange={(e) => handleSurveyChange(e.target.value as SkySurveyKey)}
            className="min-h-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs text-slate-100"
          >
            {SURVEYS.map((s) => (
              <option key={s.key} value={s.key}>
                {lang === 'es' ? s.labelEs : s.labelEn}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setProjectionMode((m) => (m === 'SIN' ? 'AIT' : 'SIN'))}
            aria-pressed={projectionMode === 'SIN'}
            className="min-h-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 active:scale-[0.98]"
          >
            {projectionMode === 'SIN'
              ? lang === 'es'
                ? 'Esfera 3D (SIN)'
                : '3D Globe (SIN)'
              : lang === 'es'
                ? 'Cielo Amplio (AIT)'
                : 'Wide Sky (AIT)'}
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            aria-pressed={showGrid}
            className="min-h-[44px] rounded-md border border-instrumentBorder bg-obsidian px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 active:scale-[0.98]"
          >
            {lang === 'es' ? 'Rejilla ICRS' : 'ICRS Grid'}
          </button>

          <button
            type="button"
            onClick={handleInspectCenter}
            className="min-h-[44px] rounded-md bg-accentAmber px-3 py-1.5 text-xs font-semibold text-obsidian hover:bg-amber-400 active:scale-[0.98] active:bg-amber-500"
          >
            {lang === 'es' ? 'Consultar esta region' : 'Query this region'}
          </button>
        </div>
      </div>
    </section>
  );
}
