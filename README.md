# SphereX Viewer and Data Visualizer (SVDV)
### NASA Space Apps Challenge 2026 — Desafío: Planet X and SPHEREx

Plataforma de Exploración y Análisis Astronómico interactiva basada en los datos espectrales y de imagen del telescopio espacial **SPHEREx** de la NASA (102 canales en el infrarrojo cercano entre 0.75 y 5.0 µm, colecciones DR1 y QR3).

> **Acreditación obligatoria:**  
> *SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive.*

---

## 🛠️ Herramientas y Gestores de Paquetes

- **Backend (Python 3.11+ / 3.13):** FastAPI, Astropy, Astroquery, Photutils, Reproject, SciPy, Pytest. Gestionado con `uv` o entorno virtual estándar de Python.
- **Frontend (Node/TypeScript):** React 18, Vite, Three.js, Aladin Lite v3, Tailwind CSS, Lucide Icons, Vitest. Gestionado con `pnpm`.

---

## 🌌 Arquitectura del Proyecto (SVDV)

El sistema se compone de cuatro módulos interconectados diseñados bajo principios de resiliencia astronómica:

1. **Módulo 1: Visor Celestial y HUD Científico (Frontend)**
   - Vista celestial 3D en tiempo real (Aladin Lite v3 / WebGL2) sobre coordenadas ICRS.
   - Visor de parpadeo (Blink Comparator) en Canvas 2D con renderizado nearest-neighbor (`image-rendering: pixelated`) a nivel de píxel del detector.
   - Detección visual de compatibilidad de longitudes de onda (insignia *"Wavelength Matched"* vs *"Wavelength Mismatch"*).
   - Tarjetas de evidencia científica para candidatos astrométricos no validados.

2. **Módulo 2: Conexión con Archivo IRSA de la NASA y Recortes**
   - Servicio backend para consultar el servicio SIA2 de SPHEREx (`spherex_dr1` y `spherex_qr3`).
   - Descarga de recortes FITS de 6 extensiones (`IMAGE`, `FLAGS`, `VARIANCE`, `ZODI`, `EPSF`, `WCS-WAVE`).
   - Degradación elegante ante indisponibilidad o latencia de IRSA mediante campos pre-calculados de alta fidelidad (M101 Control Field, Barnard's Star, WISE 0855).

3. **Módulo 3: Motor de Análisis Científico y Detección de Candidatos**
   - Reproyección astronómica sobre rejilla común TAN mediante `reproject.reproject_interp`.
   - Detección de fuentes puntuales con `photutils.detection.DAOStarFinder`.
   - Búsqueda de vecinos más cercanos con `scipy.spatial.cKDTree` sobre pares de longitud de onda compatible para aislar desplazamientos reales y rechazar estrellas estáticas.
   - Validación cruzada con asteroides conocidos del catálogo JPL Small-Body Identification (SBIdent).

4. **Módulo 4: Reportes Explicativos Validados con IA (Anti-Alucinaciones)**
   - Síntesis en lenguaje claro gobernada por la función `assert_numbers_grounded(text, facts)`: cualquier cifra no presente en los datos fuente provoca rechazo inmediato.
   - Lenguaje riguroso Space Apps: término estricto *"candidato"*, *"posible"*, *"no validado"*; nunca afirmaciones sensacionalistas de *"descubrimiento"*.

---

## 📁 Estructura del Repositorio

```text
svdv/
├── backend/                  # API REST en Python (FastAPI) y Pipeline Científico
│   ├── app/
│   │   ├── api/v1/endpoints/ # Endpoints /health y /field
│   │   ├── core/             # Configuración, CORS y variables de entorno
│   │   ├── data/             # Campos precalculados y metadatos de bandas SPHEREx
│   │   ├── schemas/          # Modelos Pydantic (FieldManifest, Epoch, Candidate)
│   │   ├── services/         # Algoritmos astronómicos (query, cutouts, frames, detect, validate, report)
│   │   └── main.py           # Aplicación principal FastAPI
│   ├── tests/                # Pruebas unitarias completas (37 tests pytest)
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/                 # Aplicación Web SPA (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/       # CelestialViewer (Aladin Lite), BlinkViewer, EvidenceCard, AboutModal
│   │   ├── data/             # Definición de campos curados y fallbacks
│   │   ├── services/         # Cliente HTTP y gestión de caché local
│   │   ├── types/            # Tipos TypeScript espejados con backend
│   │   └── utils/            # Normalización de coordenadas, candidatos, épocas
│   ├── public/               # Fotogramas PNG alineados y manifiestos
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/                     # Documentación técnica, spike de IRSA y planes
├── LICENSE                   # Licencia Apache 2.0 (Open Source)
└── README.md
```

---

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Backend (FastAPI + Astropy)

```bash
cd backend

# Opción A: Con uv
uv venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000

# Opción B: Con Python estándar
python -m venv .venv
.venv\Scripts\activate      # En Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API Docs interactiva: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- Consulta de campo: [http://localhost:8000/api/v1/field?ra=210.8023&dec=54.3490&fov=0.25](http://localhost:8000/api/v1/field?ra=210.8023&dec=54.3490&fov=0.25)

### 2. Frontend (React + Vite + TypeScript)

```bash
cd frontend
pnpm install
pnpm dev
```

La aplicación abrirá en [http://localhost:5173](http://localhost:5173).

---

## 🧪 Ejecución de Pruebas Automatizadas

El proyecto cuenta con cobertura integral tanto en el frontend como en el backend:

### Pruebas de Backend (pytest)
```bash
# Desde la carpeta backend (o con .venv activo):
pytest
```
*37 pruebas unitarias pasando:*
- `test_schemas.py`: Serialización y contratos de datos IVOA / SPHEREx.
- `test_query.py`: Mapeo de detectores, normalización de RA (0–360°) y búsquedas SIA2.
- `test_cutouts.py`: Estructura de 6 HDUs, rangos espectrales y protección de bordes.
- `test_frames.py`: Reproyección a rejilla TAN común y emparejamiento de $\lambda$.
- `test_detect.py`: DAOStarFinder y cKDTree para identificación de candidatos en movimiento.
- `test_validate.py`: Validación de asteroides con JPL SBIdent.
- `test_report.py`: Validación estricta anti-alucinaciones numéricas.
- `test_api.py`: Endpoints REST, CORS y degradación elegante sin cobertura.

### Pruebas de Frontend (vitest)
```bash
# Desde la carpeta frontend:
pnpm test
```
*42 pruebas automatizadas pasando:*
- Parseo de coordenadas sexagesimales y decimales.
- Blink Viewer y compatibilidad de longitudes de onda.
- Tarjeta de evidencia y trayectorias astrométricas.
- Cache en localStorage y fallbacks automáticos ante fallas de red.

---

## 📜 Licencia

Distribuido bajo la **Licencia Apache 2.0**. Consulte el archivo [LICENSE](LICENSE) para más detalles.
