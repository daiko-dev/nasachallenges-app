# NASA Space Apps 2026 — Planet X & SPHEREx Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public web tool that displays real SPHEREx infrared sky images and lets anyone quickly see how a region changes between two observation epochs (the core challenge verb), with optional AI-generated explanatory reports.

**Architecture:** A single web platform split into two independent but connected tracks: (A) the web app (Members 1 & 2) — React/Three.js frontend + FastAPI backend that queries IRSA via astroquery, serves cutout PNG images, and computes a difference image between two epochs; (B) the demo & presentation (Members 3 & 4) — a 30-second English demo video and a 5-minute Spanish slide presentation. Tracks run in parallel after shared scaffolding; the app must work offline during the demo using pre-bundled real SPHEREx samples so it never depends on live IRSA at presentation time.

**Tech Stack:** Backend: Python 3.11+, FastAPI, uvicorn, astropy, astroquery, numpy, scipy, python-dotenv (already in repo `backend/`). Frontend: React 18, TypeScript, Vite, Tailwind CSS, Three.js, recharts, lucide-react (already in repo `frontend/`). Optional/stretch: OpenRouter + Supabase pgvector for AI reports (fallback to template if no API key). Data: real SPHEREx DR1/QR3 via IRSA SIA2 + AWS S3 bucket `nasa-irsa-spherex` (no credentials needed).

**Spec:** This document implements the user's execution spec (8 sections) for the NASA Space Apps 2026 "Planet X and SPHEREx" challenge (https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/). The core challenge requirement is: "create a public-facing web tool to display images of the sky from SPHEREx mission, making it easy for anyone to quickly see how they change over time."

**Deadline:** Sunday 15 Nov 2026, 23:59 República Dominicana (UTC-4).

---

## 1. Evaluación de la propuesta

**Fortalezas**
- Alineación directa con el enunciado del desafío (verbo principal: herramienta web pública que muestra imágenes del cielo de SPHEREx y cambios en el tiempo).
- Reutiliza el esqueleto existente del repositorio (`backend/` FastAPI + `frontend/` React+Three.js) y datos de banda ya cargados (`spherex_bands.json`, 102 canales).
- Datos reales de NASA/IRSA disponibles sin credenciales (SIA2, astroquery, AWS S3 `nasa-irsa-spherex`, DR1 liberado Nov 2026).
- Equipo con roles claros: 2 personas en desarrollo web, 2 en demo audiovisual y presentación.

**Debilidades**
- Las imágenes espectrales MEF de SPHEREx pesan ~70 MB cada una (2040×2040, 6 extensiones); no es viable descargar/decodar cubos completos en el navegador en un hackathon.
- Dependencia de red para consultar IRSA en vivo durante la demo (riesgo de caída o lentitud de IRSA; el 12 Nov hubo mantenciones reportadas).
- Supabase + OpenRouter + pgvector añaden configuración (claves, esquema vectorial) que consume tiempo valioso y puede fallar en la presentación.
- Detectar "Planeta X" o cuerpos en movimiento de forma científica sólida requiere astrometría precisa que no se ajusta a 1.5 días.

**Riesgos científicos (y correcciones)**
- Riesgo: presentar candidatos como "descubrimientos confirmados". Corrección estricta: nunca afirmar descubrimientos; usar solo lenguaje de "candidato" / "cambio detectado por el usuario" y un disclaimer visible.
- Riesgo: confundir imágenes ilustrativas con datos reales de SPHEREx. Corrección: todas las imágenes mostradas en la app y demo deben ser reales de IRSA o claramente marcadas como simuladas; citar DOI 10.26131/IRSA678 (DR1) y 10.26131/IRSA662 (QR3).
- Riesgo: variaciones debidas a ruido/instrumento no a movimiento real. Corrección: el análisis se limita a diferencia de imágenes y resaltado de píxeles, sin afirmación astrofísica.

**Oportunidades para diferenciarnos**
- Enfoque en el cambio temporal ("blink comparator" entre dos épocas) que es exactamente lo que pide el desafío, no solo un visor estático.
- Demo en inglés + presentación en español cubre tanto la plataforma global como el jurado local.
- Enfoque accesible para "personas sin conocimientos especializados": interfaz simple, guía paso a paso, sin jerga astrofísica.

---

## 2. Arquitectura mínima viable

**Tecnologías (reutilizar lo existente)**
- Backend Python/FastAPI (astropy, astroquery, numpy) — ya en repo y en `requirements.txt`.
- Frontend React/TypeScript/Vite + Three.js + Tailwind — ya en repo y en `package.json`.
- Datos: IRSA SIA2 (`irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1`) + astroquery `Irsa.query_sia`; AWS S3 `nasa-irsa-spherex` sin credenciales.

**Componentes**
- `app.services.irsa_client`: consulta SIA2 por posición (RA/Dec) y devuelve metadatos de imágenes (obs_id, access_url, t_min/t_max, colección).
- `app.services.cutout_service`: lee FITS MEF vía astropy, extrae un recorte (cutout) del array detector seleccionado y lo devuelve como PNG pequeño para la web.
- `app.services.compare_service`: alinea dos imágenes de la misma región en dos épocas, calcula diferencia absoluta y resalta píxeles cambiados (numpy/scipy), devuelve imagen de diferencia + estadística simple.
- Frontend `SkyViewer` (Three.js): muestra la imagen del cielo como textura sobre un plano/esfera, controles de posición, banda/detector y época.
- Frontend `BandSelector`: 102 canales desde `spherex_bands.json` mapeados a los 6 arrays detectores.
- Frontend `BlinkComparator`: alternancia entre época 1 y época 2 + vista de diferencia.
- Frontend `ReportPanel` (opcional/stretch): solicita reporte explicativo al backend (OpenRouter con system prompt estricto; fallback a plantilla).

**Flujo de datos**
1. Usuario elige posición celestial (RA/Dec) o usa posición predeterminada.
2. Frontend pide al backend imágenes de dos épocas (obs_id distintos) para un array detector.
3. Backend consulta IRSA SIA2, descarga cutouts, convierte a PNG, los sirve al frontend.
4. Frontend muestra lado a lado, alternancia (blink) y diferencia resaltada.
5. (Opcional) Usuario solicita reporte IA; backend genera texto explicativo basado en los resultados calculados y fuentes verificables (sin inventar observaciones).

**Herramientas open source prioritarias**
- astropy + astroquery (lectura FITS, consulta IRSA) — ya en dependencias.
- Three.js — ya en dependencias.
- Tailwind + lucide-react — ya en dependencias.
- Gravitar hacia software existente: no construir visor astronómico desde cero; usar Three.js + cutouts PNG servidos por el backend.

**Límites de alcance (YAGNI para este hackathon)**
- No decodar los 102 canales espectrales completos en el navegador (demasiado pesado); los 102 canales son referencia y el visor muestra los 6 arrays detectores como imágenes.
- No astrometría ni ajuste de WCS completo; se asume que las dos imágenes de la misma región están alineadas por la misma posición consultada.
- No base de datos vectorial en producción a menos que Supabase se configure en <30 min; si no, fallback a plantilla local.

---

## 3. Plan de desarrollo (tareas)

**División por integrante**
- Integrantes 1 y 2: aplicación web (backend + frontend), tareas T1–T9.
- Integrantes 3 y 4: demo de 30 s (inglés) y presentación de 5 min (español), tareas T10–T14.
- T15 (entrega final): todo el equipo, al final.

**Criterio general de "terminado" (DoD) por tarea:** código escrito, prueba pasa, commit realizado, y (para el entregable final) verificado en la aplicación completa.

**Dependencias globales:** T1 es requisito previo de todo. T2→T3→T4 forma la tubería de datos del backend. T5→T6→T7 forma el flujo del frontend. T8 requiere T3 y T7. T9 requiere T8. T10→T11→T12 independientes del backend una vez T1 lista (pueden usar imágenes de muestra). T13 depende de T10 y del avance de la app. T14 depende de T13. T15 depende de T9, T12, T14.

### Task 1: Scaffolding del repositorio y entorno (Ambos miembros web; requiere T1 antes de todo)

**Files:**
- Create: `backend/.env` (desde `.env.example`, sin claves reales)
- Create: `frontend/.env` (desde `.env.example`, `VITE_API_BASE_URL=http://localhost:8000/api/v1`)
- Modify: `backend/requirements.txt` (añadir `Pillow>=10.0.0` para conversión FITS→PNG)
- Modify: `frontend/package.json` (no cambia; usa dependencias existentes)
- Test: `backend/tests/test_env.py`

**Interfaces:**
- Consumes: nada (configuración inicial).
- Produces: variables de entorno `BACKEND_PORT=8000`, `FRONTEND_PORT=5173`, `VITE_API_BASE_URL`; `uv venv` creado en `backend/`, `node_modules` instalado en `frontend/`.

- [ ] **Step 1: Write the failing test**

```python
def test_env_variables_loaded():
    from dotenv import load_dotenv
    import os
    load_dotenv()
    assert os.getenv("BACKEND_PORT") == "8000"
    assert os.getenv("VITE_API_BASE_URL") == "http://localhost:8000/api/v1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_env.py -v`
Expected: FAIL ("module 'dotenv' not found" or env vars missing)

- [ ] **Step 3: Implement environment loading**

Create `backend/.env` and `frontend/.env` from `.env.example`; add `Pillow` to `backend/requirements.txt`; `uv venv` + `uv pip install -r requirements.txt` in `backend/`; `pnpm install` in `frontend/`. Verificar que `python -c "import dotenv, astropy, astroquery, fastapi"` funciona y `pnpm dev` arranca en `frontend/` (sin necesidad de que el código de app esté completo).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_env.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/.env frontend/.env backend/requirements.txt backend/tests/test_env.py
git commit -m "feat: scaffolding del repositorio y entorno de desarrollo"
```

---

### Task 2: Cliente IRSA en el backend (Miembro 1 o 2)

**Files:**
- Create: `backend/app/services/irsa_client.py`
- Test: `backend/tests/test_irsa_client.py`

**Interfaces:**
- Consumes: nada externo (llama a IRSA SIA2).
- Produces: `search_images(ra: float, dec: float, radius_arcsec: float = 60, collection: str = "spherex_dr1") -> list[dict]` donde cada dict tiene claves `obs_id`, `access_url`, `t_min`, `t_max`, `ra`, `dec`.

- [ ] **Step 1: Write the failing test**

```python
def test_search_images_returns_metadata_shape():
    from app.services.irsa_client import search_images
    result = search_images(ra=127.69444, dec=-39.17760, radius_arcsec=60, collection="spherex_dr1")
    assert isinstance(result, list)
    if result:
        row = result[0]
        assert {"obs_id", "access_url", "t_min", "t_max", "ra", "dec"}.issubset(row.keys())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_irsa_client.py::test_search_images_returns_metadata_shape -v`
Expected: FAIL ("import ...irsa_client" / "function not defined")

- [ ] **Step 3: Implement `search_images`**

Usar `astroquery.vo.client.SiaService` o `Irsa.query_sia` contra `irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1` con `POS=circle {ra} {dec} {radius}`. Devolver lista de dicts con las claves exactas. Si la red no responde, devolver lista vacía y registrar advertencia (no fallar la aplicación).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_irsa_client.py::test_search_images_returns_metadata_shape -v`
Expected: PASS (con red) o lista vacía sin excepción (sin red)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/irsa_client.py backend/tests/test_irsa_client.py
git commit -m "feat: cliente IRSA SIA2 para buscar imágenes SPHEREx"
```

---

### Task 3: Servicio de cutout FITS → PNG (Miembro 1 o 2)

**Files:**
- Create: `backend/app/services/cutout_service.py`
- Test: `backend/tests/test_cutout_service.py`

**Interfaces:**
- Consumes: `access_url` (str, URL de IRSA), `detector_array` (int 1–6).
- Produces: `get_cutout_png(access_url: str, detector_array: int) -> bytes` (PNG de la extensión de imagen del array detector dado) o `None` si falla.

- [ ] **Step 1: Write the failing test**

```python
def test_get_cutout_png_returns_png_bytes_or_none():
    from app.services.cutout_service import get_cutout_png
    # access_url de muestra real de SPHEREx (si no hay red, debe devolver None sin excepción)
    result = get_cutout_png("https://example.com/fake.fits", detector_array=1)
    assert result is None or (isinstance(result, bytes) and result[:4] == b"\x89PNG")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_cutout_service.py::test_get_cutout_png_returns_png_bytes_or_none -v`
Expected: FAIL ("function not defined")

- [ ] **Step 3: Implement `get_cutout_png`**

Descargar el FITS (requests/httpx), abrir con `astropy.io.fits`, seleccionar HDU de imagen del `detector_array` (extensión 1 = Array 1, etc.), recortar una región central razonable (ej. 512×512 px para que pese poco), escalar a PNG con Pillow y devolver bytes. Capturar excepciones de red/FITS y devolver `None`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_cutout_service.py::test_get_cutout_png_returns_png_bytes_or_none -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cutout_service.py backend/tests/test_cutout_service.py
git commit -m "feat: servicio cutout FITS a PNG por array detector"
```

---

### Task 4: Servicio de comparación entre dos épocas (Miembro 1 o 2)

**Files:**
- Create: `backend/app/services/compare_service.py`
- Test: `backend/tests/test_compare_service.py`

**Interfaces:**
- Consumes: `img1_bytes: bytes`, `img2_bytes: bytes` (PNG del mismo recorte en dos épocas).
- Produces: `compare_epochs(img1_bytes, img2_bytes) -> dict` con claves `diff_png: bytes`, `changed_pixel_fraction: float`, `max_diff: float`.

- [ ] **Step 1: Write the failing test**

```python
def test_compare_epochs_identical_images_yield_zero_change():
    from app.services.compare_service import compare_epochs
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (100, 100, 100)).save(buf, format="PNG")
    same = buf.getvalue()
    result = compare_epochs(same, same)
    assert result["changed_pixel_fraction"] == 0.0
    assert result["max_diff"] == 0.0
    assert result["diff_png"][:4] == b"\x89PNG"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_compare_service.py::test_compare_epochs_identical_images_yield_zero_change -v`
Expected: FAIL ("function not defined")

- [ ] **Step 3: Implement `compare_epochs`**

Cargar ambos PNG con Pillow → numpy arrays (float), calcular diferencia absoluta por píxel, aplicar umbral (ej. > 10 de 255) para contar píxeles cambiados, generar imagen de diferencia (escala de grises o máscara roja) como PNG bytes. Devolver fracción de píxeles cambiados y diff máximo.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_compare_service.py::test_compare_epochs_identical_images_yield_zero_change -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/compare_service.py backend/tests/test_compare_service.py
git commit -m "feat: servicio de comparación de dos épocas e imagen de diferencia"
```

---

### Task 5: Endpoints REST del backend (Miembro 1 o 2)

**Files:**
- Create: `backend/app/api/v1/images.py`
- Create: `backend/app/main.py` (app FastAPI, CORS, montar router)
- Test: `backend/tests/test_api_images.py` (usando `fastapi.TestClient`)

**Interfaces:**
- Consumes: peticiones HTTP.
- Produces:
  - `GET /api/v1/images/search?ra={float}&dec={float}&radius={int}&collection={str}` → JSON `{results: [...]}` (usa `search_images` de T2).
  - `GET /api/v1/images/cutout?access_url={str}&detector_array={int}` → PNG (usa `get_cutout_png` de T3).
  - `GET /api/v1/images/compare?obs1={str}&obs2={str}&detector_array={int}&ra={float}&dec={float}` → JSON `{diff_url, changed_pixel_fraction, max_diff}` (usa T3 + T4).

- [ ] **Step 1: Write the failing test**

```python
def test_search_endpoint_returns_json_list():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/v1/images/search?ra=127.69&dec=-39.18&radius=60")
    assert resp.status_code == 200
    assert "results" in resp.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_api_images.py::test_search_endpoint_returns_json_list -v`
Expected: FAIL ("import ...main" / "app" not defined / 404)

- [ ] **Step 3: Implement endpoints**

Crear `app.main` con FastAPI, CORS permitiendo `http://localhost:5173`, router `/api/v1`. Implementar los 3 endpoints usando los servicios de T2–T4. `/cutout` devuelve `Response(content=png_bytes, media_type="image/png")`. `/compare` resuelve `access_url` de `obs1`/`obs2` vía búsqueda SIA2, descarga cutouts, compara y devuelve JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_api_images.py -v`
Expected: PASS (endpoints responden 200; con red, `results` es lista; sin red, lista vacía sin error)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/images.py backend/app/main.py backend/tests/test_api_images.py
git commit -m "feat: endpoints REST de búsqueda, cutout y comparación de épocas"
```

---

### Task 6: Visor del cielo con Three.js (Miembro 1 o 2)

**Files:**
- Create: `frontend/src/components/CelestialViewer/SkyViewer.tsx`
- Create: `frontend/src/components/CelestialViewer/SkyViewer.test.tsx` (vitest/testing-library si se añade; si no, prueba manual documentada)
- Test: `frontend/src/components/CelestialViewer/SkyViewer.test.tsx`

**Interfaces:**
- Consumes: props `src: string` (URL de imagen PNG), `onLoad: () => void`.
- Produces: componente React que renderiza la imagen como textura en Three.js y expone un canvas; prueba verifica que monta sin fallar y que `onLoad` se invoca al cargar la textura.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import { SkyViewer } from "./SkyViewer"
test("SkyViewer mounts and calls onLoad", () => {
  const onLoad = vi.fn()
  render(<SkyViewer src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" onLoad={onLoad} />)
  expect(screen.getByRole("button", { name: /cargar cielo/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/CelestialViewer/SkyViewer.test.tsx` (instalar vitest + testing-library si falta)
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implement `SkyViewer`**

Componente React con `useRef`, `useEffect` que monta Three.js (`Scene`, `PerspectiveCamera`, `WebGLRenderer`), crea un plano/Esfera con `MeshBasicMaterial` y `TextureLoader` cargando `src`. Botón "Cargar cielo" que dispara la carga y llama `onLoad` cuando la textura esté lista. Manejar error de carga mostrando mensaje.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/CelestialViewer/SkyViewer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CelestialViewer/SkyViewer.tsx frontend/src/components/CelestialViewer/SkyViewer.test.tsx
git commit -m "feat: visor del cielo con Three.js (SkyViewer)"
```

---

### Task 7: Selector de banda/array detector y control de época (Miembro 1 o 2)

**Files:**
- Create: `frontend/src/components/BandControls/BandSelector.tsx`
- Create: `frontend/src/components/common/EpochToggle.tsx`
- Modify: `frontend/src/App.tsx` (integrar controles)
- Test: `frontend/src/components/BandControls/BandSelector.test.tsx`

**Interfaces:**
- Consumes: `bands: {channel, wavelength_um, label}[]` (importar `backend/app/data/spherex_bands.json` copiado al frontend como `frontend/src/data/spherex_bands.json`).
- Produces: `BandSelector` emite `onBandChange(detector_array: 1..6)`; `EpochToggle` emite `onEpochChange("a" | "b")`. Mapear canal 1–102 a array detector 1–6 según el rango de `wavelength_um` (Array 1: 0.75–1.11, ..., Array 6: 4.42–5.00).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { BandSelector } from "./BandSelector"
test("BandSelector emite array detector al elegir un canal", () => {
  const onChange = vi.fn()
  render(<BandSelector onBandChange={onChange} />)
  fireEvent.change(screen.getByLabelText(/banda 1 \(0\.75/i), { target: { value: "1" } })
  expect(onChange).toHaveBeenCalledWith(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/BandControls/BandSelector.test.tsx`
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implement controles**

Copiar `spherex_bands.json` al frontend. `BandSelector`: lista/selector de los 102 canales; al seleccionar, calcular el `detector_array` (1–6) desde el rango de longitud de onda y emitirlo. `EpochToggle`: botón alternar entre época A y época B. Integrar ambos en `App.tsx` junto a `SkyViewer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/BandControls/BandSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/spherex_bands.json frontend/src/components/BandControls/BandSelector.tsx frontend/src/components/BandControls/BandSelector.test.tsx frontend/src/components/common/EpochToggle.tsx frontend/src/App.tsx
git commit -m "feat: selector de banda/array detector y control de época"
```

---

### Task 8: Comparador "blink" entre dos épocas + modo demo offline (Miembro 1 o 2)

**Files:**
- Modify: `frontend/src/App.tsx` (orquestar búsqueda, dos imágenes, blink, diferencia)
- Create: `frontend/src/components/common/BlinkComparator.tsx`
- Create: `frontend/src/data/sample_images/` (2 PNG reales de SPHEREx de muestra, pre-descargados, para modo offline)
- Test: `frontend/src/components/common/BlinkComparator.test.tsx`

**Interfaces:**
- Consumes: `detector_array` (de T7), `epoch` A/B (de T7), backend URLs (de T5).
- Produces: `BlinkComparator` muestra imagen A, imagen B, botón alternar (blink) y vista de diferencia; modo offline usa `sample_images/` cuando el backend no responde.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { BlinkComparator } from "./BlinkComparator"
test("BlinkComparator alterna entre imagen A y B", () => {
  const onToggle = vi.fn()
  render(<BlinkComparator imgA="data:image/png;base64,..." imgB="data:image/png;base64,..." onToggle={onToggle} />)
  fireEvent.click(screen.getByRole("button", { name: /alternar/i }))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/common/BlinkComparator.test.tsx`
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implement `BlinkComparator` + modo offline**

Componente con dos ``/texturas, estado `active: "a" | "b"`, botón "Alternar épocas" que cambia `active` y opcionalmente superpone máscara de diferencia. En `App.tsx`, al buscar posición, llamar a `/api/v1/images/compare`; si falla (sin red), usar `sample_images/` (dos PNG reales de SPHEREx de distinta época del mismo ámbito) para que la demo funcione sin internet. Marcar claramente "modo demo offline" si se usan muestras.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/common/BlinkComparator.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/common/BlinkComparator.tsx frontend/src/components/common/BlinkComparator.test.tsx frontend/src/data/sample_images/ frontend/src/App.tsx
git commit -m "feat: comparador blink entre dos épocas y modo demo offline"
```

---

### Task 9: Polish, build, despliegue y verificación de la app (Miembro 1 o 2)

**Files:**
- Modify: `frontend/src/App.tsx` (layout final, disclaimer de "candidato, no descubrimiento", créditos NASA/IRSA)
- Modify: `frontend/tailwind.config.js` (si hace falta, estilos finales)
- Test: `cd frontend && pnpm build` (verificar build sin errores)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: aplicación compilada (`frontend/dist/`) desplegada (Vercel/Netlify o similar) y accesible por URL pública; backend desplegado o Documentado cómo correrlo localmente.

- [ ] **Step 1: Write the failing test**

Run: `cd frontend && pnpm build`
Expected: FAIL (errores de TypeScript o de build si faltan piezas)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm build`
Expected: FAIL (tipo/archivo faltante)

- [ ] **Step 3: Implement polish**

Ajustar layout responsivo, reducir movimiento (`prefers-reduced-motion`), añadir disclaimer visible: "Los cambios mostrados son candidatos a revisar, no descubrimientos confirmados. Datos: NASA/IPAC IRSA SPHEREx (DOI 10.26131/IRSA678)." Añadir créditos y enlace a IRSA. Build exitoso y despliegue en URL pública.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm build` → Expected: PASS (dist generado)
Verificar que la app cargada en la URL pública muestra una imagen del cielo y permite alternar épocas.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/tailwind.config.js
git commit -m "feat: polish, disclaimer, build y despliegue de la aplicación web"
```

---

### Task 10: Guión y guion gráfico del demo de 30 s (Miembros 3 y 4)

**Files:**
- Create: `docs/demo/guion-30s.md` (en inglés)
- Create: `docs/demo/storyboard.md`

**Interfaces:**
- Consumes: nada (basado en la app de T1–T9, usando modo offline si es necesario).
- Produces: guión de 30 segundos en inglés, narración o textos en pantalla, secuencia segundo a segundo, y qué debe mostrar la app en cada segundo.

- [ ] **Step 1: Escribir el guión**

Definir exactamente qué se muestra segundo a segundo (0–5 s: título y SPHEREx; 5–12 s: buscar una región del cielo; 12–22 s: alternar dos épocas y ver un objeto moverse/cambiar; 22–28 s: vista de diferencia resaltada; 28–30 s: llamada a la acción + créditos). Incluir narración en inglés y textos en pantalla.

- [ ] **Step 2: Revisar el guión con los miembros 1 y 2**

Confirmar que la app puede mostrar exactamente eso en el momento del demo (incluido modo offline).

- [ ] **Step 3: Commit**

```bash
git add docs/demo/guion-30s.md docs/demo/storyboard.md
git commit -m "docs: guion y storyboard del demo de 30 segundos (ingles)"
```

---

### Task 11: Grabar y editar el video del demo (Miembros 3 y 4)

**Files:**
- Create: `docs/demo/demo-30s.mp4` (entregable final)
- Test: reproducir el video y verificar duración ≤ 30 s y audio en inglés.

- [ ] **Step 1: Grabar pantalla de la app**

Grabar la aplicación web ejecutando los pasos del guion de T10 (usar modo offline si no hay red confiable).

- [ ] **Step 2: Editar**

Añadir narración en inglés, subtítulos, música opcional suave, recortar a máximo 30 segundos, exportar en MP4 1080p.

- [ ] **Step 3: Verificar**

Reproducir y confirmar que dura ≤ 30 s, audio en inglés claro, y muestra cambios reales del cielo de SPHEREx.

- [ ] **Step 4: Commit**

```bash
git add docs/demo/demo-30s.mp4
git commit -m "docs: video demo de 30 segundos"
```

---

### Task 12: Diapositivas de la presentación (Miembros 3 y 4)

**Files:**
- Create: `docs/presentacion/presentacion-5min.pptx` o `.pdf` (Canva/PowerPoint)
- Test: revisar que tenga ≤ 10 diapositivas y que encaje en 5 minutos.

- [ ] **Step 1: Definir estructura de diapositivas**

1. Título y equipo. 2. El problema (datos de SPHEREx, nadie puede revisar todo). 3. Nuestra solución (herramienta web, cambios en el tiempo). 4. Cómo funciona (demo resumida). 5. Datos reales de NASA/IRSA (SPHEREx, 102 bandas, DR1). 6. Impacto (accesible para cualquiera). 7. Diferenciación (enfoque en cambio temporal, no promesas falsas). 8. Demo en vivo (30 s). 9. Conclusión y créditos.

- [ ] **Step 2: Crear diapositivas**

Diseño en Canva/PowerPoint, visuales limpios, poco texto, imágenes del cielo reales, idioma español.

- [ ] **Step 3: Commit**

```bash
git add docs/presentacion/
git commit -m "docs: diapositivas de presentacion de 5 minutos (espanol)"
```

---

### Task 13: Guión del presentador y ensayo (Miembros 3 y 4)

**Files:**
- Create: `docs/presentacion/guion-presentador.md` (en español)

- [ ] **Step 1: Escribir el guion**

Guion completo del presentador en español, alineado con las diapositivas, explicando problema, solución, funcionamiento, impacto y diferenciación en ~5 minutos. Incluir transiciones para la demo en vivo.

- [ ] **Step 2: Ensayar**

Dos ensayos cronometrados (≤ 5 min). Ajustar si se pasa.

- [ ] **Step 3: Commit**

```bash
git add docs/presentacion/guion-presentador.md
git commit -m "docs: guion del presentador y notas de ensayo"
```

---

### Task 14: Revisión cruzada web ↔ demo (Todo el equipo)

**Files:**
- Modify: nada nuevo; verificar consistencia entre lo que muestra la app (T9) y lo que prometen el demo (T11) y la presentación (T12).

- [ ] **Step 1: Revisión cruzada**

Miembros 3 y 4 confirman que el video y la presentación coinciden con la app desplegada. Miembros 1 y 2 confirman que la app funciona en la URL pública y en modo offline.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: revision cruzada app-demo-presentacion"
```

---

### Task 15: Entrega final y envío a la plataforma oficial (Todo el equipo)

**Files:**
- Create: `docs/entrega/checklist.md`
- Create: `docs/entrega/fuentes-y-creditos.md` (DOI 10.26131/IRSA678, 10.26131/IRSA662; licencias de librerías; créditos del equipo)
- Test: verificar checklist completa antes del envío.

- [ ] **Step 1: Checklist de funcionamiento**

App desplegada y responde; demo video ≤ 30 s en inglés; presentación ≤ 5 min en español; repositorio limpio con README actualizado; licencias y créditos incluidos; no hay afirmaciones de descubrimientos confirmados.

- [ ] **Step 2: Envío en la plataforma oficial**

Subir repositorio, video, presentación y documentación en spaceappschallenge.org antes de las 23:59 del 15 Nov 2026 (hora RD).

- [ ] **Step 3: Commit final**

```bash
git add docs/entrega/
git commit -m "docs: entrega final y checklist de envio"
git push origin main
```

---

## 4. Cronograma (14–15 Nov 2026, hora República Dominicana UTC-4)

**Total disponible:** aprox. 36 horas calendario; realistas ~16–20 horas de trabajo efectivo entre los 4 miembros. Prioridad absoluta: demo funcional sobre arquitectura ambiciosa.

### Sábado 14 Nov

| Hora (RD) | Hito | Quién | Entregable |
|---|---|---|---|
| 09:00–10:00 | Kickoff, reparto, T1 (scaffolding) | Todos | Repo funcional backend + frontend |
| 10:00–13:00 | T2 (cliente IRSA) + T3 (cutout PNG) | Miembro 1 o 2 | Endpoints de búsqueda y corte de imagen |
| 10:00–13:00 | T6 (SkyViewer) + T7 (selector banda/época) | Miembro 1 o 2 | Visor de cielo con controles |
| 13:00–14:00 | Almuerzo | Todos | — |
| 14:00–17:00 | T4 (comparador épocas) + T5 (endpoints REST) | Miembro 1 o 2 | Tubería de datos completa: 2 épocas → diferencia |
| 14:00–17:00 | T10 (guión demo) + inicio T12 (diapositivas) | Miembros 3 y 4 | Guion 30 s y estructura de diapositivas |
| 17:00–19:00 | T8 (blink + modo offline) + integración frontend–backend | Miembro 1 o 2 | App funcional comparando dos épocas |
| 19:00–21:00 | T9 polish, build, despliegue URL pública | Miembro 1 o 2 | App desplegada accesible públicamente |
| 21:00–22:00 | T10 revisión guion con web; T12 avance diapositivas | Todos | Alineación app ↔ demo ↔ presentación |
| 22:00–23:59 | Descanso / preparo para domingo | Todos | — |

### Domingo 15 Nov

| Hora (RD) | Hito | Quién | Entregable |
|---|---|---|---|
| 09:00–11:00 | T11 (grabar + editar video demo ≤ 30 s) | Miembros 3 y 4 | `demo-30s.mp4` |
| 09:00–11:00 | T9/T8 correcciones finales de la app (si hay fallos) | Miembro 1 o 2 | App estable |
| 11:00–13:00 | T12 (diapositivas finales) + T13 (guion presentador) | Miembros 3 y 4 | Presentación + guion en español |
| 13:00–14:00 | Almuerzo | Todos | — |
| 14:00–16:00 | T14 revisión cruzada + ensayo presentación (cronometrado ≤ 5 min) | Todos | Demo y presentación sincronizados |
| 16:00–18:00 | T15 checklist + fuentes/creditos + correcciones de último minuto | Todos | Repo, docs, video, slides listos |
| 18:00–20:00 | **PERÍODO OBLIGATORIO DE INTEGRACIÓN, PRUEBAS Y CORRECCIONES** (no se añade funcionalidad nueva) | Todos | Todo verificado junto |
| 20:00–22:00 | Ensayo final completo (app en vivo + demo + presentación) | Todos | General ensayada |
| 22:00–23:59 | Envío final en spaceappschallenge.org | Todos (encargado: Miembro 4) | Proyecto enviado antes del plazo |

**Regla de corte:** a las 18:00 del domingo se congela el alcance; solo correcciones de bugs críticos hasta las 20:00. Nada nuevo después.

---

## 5. Demo de 30 segundos (guión completo, en inglés)

**Objetivo:** comunicar el valor del proyecto en ≤ 30 segundos a los jueces. Mostrar la aplicación web real (o el video grabado si falla la red).

| Segundo | Visual en la app | Narración / texto en pantalla |
|---|---|---|
| 0–4 | Título "SPHEREx Sky Change Explorer" + fondo del cielo infrarrojo real | "NASA's SPHEREx maps the whole sky every six months in 102 infrared bands. But who can check a billion objects?" |
| 4–9 | Barra de búsqueda: usuario escribe coordenadas o elige una región; se carga una imagen del cielo | "Our tool lets anyone explore real SPHEREx images and see how the sky changes over time." |
| 9–16 | Alternancia (blink) entre Época A y Época B de la misma región | "Compare two observations of the same region. Spot what moves — comets, asteroids, maybe new worlds." |
| 16–23 | Vista de diferencia resaltada (píxeles cambiados en rojo) + cifra de cambio | "We highlight what changed between epochs — candidates, not discoveries." |
| 23–28 | Clic en un cambio; panel muestra banda, longitud de onda, y reporte explicativo breve | "Real NASA/IPAC IRSA data. Candidates to investigate — never confirmed discoveries." |
| 28–30 | Logo NASA/IRSA, URL de la app, "Try it yourself" | "Explore the changing sky. [app URL]" |

**Requisitos de producción:** audio en inglés claro, subtítulos, 1080p, ≤ 30 s, música de fondo opcional y baja.

---

## 6. Presentación de 5 minutos (español, diapositivas Canva/PowerPoint)

**Estructura de diapositivas (≤ 10, ~30 s cada una)**

| # | Diapositiva | Contenido | Elemento visual |
|---|---|---|---|
| 1 | Título | Nombre del proyecto, equipo, desafío "Planet X and SPHEREx", NASA Space Apps 2026 | Imagen del cielo SPHEREx + logos |
| 2 | El problema | SPHEREx mapea el cielo cada 6 meses en 102 bandas infrarrojas, más de mil millones de objetos; nadie puede revisarlo todo a mano | Gráfico simple: cielo → miles de millones de objetos → una persona |
| 3 | Nuestra solución | Herramienta web pública para ver imágenes reales de SPHEREx y detectar cambios entre épocas, sin conocimientos especializados | Captura de la aplicación |
| 4 | Cómo funciona | Buscar región → elegir banda → comparar dos épocas → alternar (blink) → ver diferencia resaltada | Diagrama de flujo de 4 pasos + captura del visor |
| 5 | Datos reales de la NASA | Datos de NASA/IPAC IRSA (SPHEREx DR1/QR3), 102 bandas, DOI citados; no imágenes inventadas | Logos NASA, IRSA, Caltech; cita de DOI |
| 6 | Impacto | Cualquier persona puede explorar el cielo y encontrar candidatos; ciencia abierta y accesible | Persona usando la app en móvil/portátil |
| 7 | Diferenciación | Enfoque en el cambio temporal (no solo un visor estático); honestidad científica: candidatos, no descubrimientos confirmados | Comparativa "visor común" vs "nuestro comparador de épocas" |
| 8 | Demo en vivo (30 s) | Reproducir video o demostrar la app en vivo | Video demo / app en directo |
| 9 | Conclusión | Resumen: datos reales, cambio en el tiempo, acceso abierto, lista para el desafío | App URL + llamada a la acción |
| 10 | Créditos | Equipo, fuentes, licencias, agradecimientos NASA/IPAC IRSA | Logos y texto de créditos |

**Guión del presentador (español, ~5 minutos)**

*(0:00–0:45) Diapositivas 1–2: Problema*
"Buenos días. Somos el equipo [nombre]. Participamos en el desafío Planet X and SPHEREx del NASA Space Apps Challenge 2026. SPHEREx es un telescopio de la NASA que, desde 2025, mapea todo el cielo cada seis meses en 102 bandas de luz infrarroja cercana, detectando más de mil millones de objetos. Cometas, asteroides, estrellas e incluso posibles nuevos planetas se revelan cambiando de posición entre imágenes. Pero nadie puede revisar todo ese dato solo. Ese es nuestro problema."

*(0:45–1:30) Diapositivas 3–4: Solución y funcionamiento*
"Nuestra solución es una herramienta web pública que muestra imágenes reales del cielo de SPHEREx y permite a cualquiera ver cómo cambian con el tiempo. El usuario elige una región del cielo, selecciona una banda infrarroja y compara dos observaciones de la misma época distinta. Con un solo clic alterna entre ambas imágenes —un 'blink comparator'— y ve una vista de diferencia que resalta los píxeles que cambiaron. Así, sin saber astrofísica, cualquiera puede detectar objetos que se mueven."

*(1:30–2:15) Diapositiva 5: Datos reales*
"Usamos datos oficiales de la NASA/IPAC IRSA: SPHEREx Data Release 1 y Quick Release 3, con 102 bandas espectrales. Todas las imágenes son reales; citamos los DOI 10.26131/IRSA678 y 10.26131/IRSA662. No inventamos observaciones ni resultados."

*(2:15–3:00) Diapositivas 6–7: Impacto y diferenciación*
"Nuestro impacto es abrir la exploración astronómica a personas sin formación especializada. Nos diferenciamos por enfocarnos en el cambio temporal —exactamente lo que pide el desafío— y por ser científicosamente honestos: lo que muestra la herramienta son candidatos para investigar, nunca descubrimientos confirmados."

*(3:00–4:00) Diapositiva 8: Demo (30 segundos)*
Reproducir el video demo de 30 segundos o demostrar la aplicación en vivo: buscar una región, alternar épocas, mostrar la diferencia resaltada.

*(4:00–4:45) Diapositivas 9–10: Conclusión y créditos*
"En resumen: datos reales de la NASA, cambio en el tiempo, acceso abierto, y una herramienta que cualquiera puede usar. Gracias. [Equipo, fuentes, créditos]."

**Regla:** cronometrar el ensayo; si supera los 5 minutos, reducir diapositivas 6 y 7, no el demo.

---

## 7. Estrategia de evaluación

**Qué exige realmente el desafío (publicado)**
El enunciado oficial dice: "create a public-facing web tool to display images of the sky from SPHEREx mission, making it easy for anyone to quickly see how they change over time." Eso es lo que los jueces verán primero. Requisitos obligatorios para premios globales: usar al menos un recurso de la pestaña Resources del desafío (nosotros usamos IRSA/SPHEREx). No hay criterios de puntuación oficiales publicados por NASA que podamos citar; lo siguiente son recomendaciones del equipo, no criterios oficiales.

**Cómo maximizar la puntuación (recomendaciones del equipo, no oficiales)**
1. **Cumplir el verbo principal:** la app debe mostrar imágenes reales de SPHEREx y un cambio entre épocas. Eso es el núcleo; Todo lo demás es secundario.
2. **Datos reales, no ilustrativos:** que el demo y la app usen imágenes reales de IRSA, marcadas como tales, con DOI. NASA penaliza el uso de imágenes simuladas presentadas como reales.
3. **Demo funcional en vivo o video:** mejor una demo corta que funcione que una arquitectura ambiciosa rota. Priorizar el video de 30 s y la app desplegada.
4. **Honestidad científica:** nunca decir "encontramos el Planeta X". Decir "candidatos detectados por el usuario, sujetos a verificación". Esto genera confianza con jueces con perfil científico.
5. **Accesibilidad:** que una persona sin conocimientos pueda usarla en menos de un minuto (interfaz simple, en inglés para el reto global, presentación en español para el jurado local).
6. **Entrega completa a tiempo:** repositorio, documentación, video, presentación, créditos y licencias en la plataforma oficial antes del plazo.

**Riesgos de puntuación y mitigación**
- IRSA cae en el momento del demo → usar video grabado y modo offline con imágenes de muestra (T8).
- No hay API key de OpenRouter/Supabase → Module 4 usa plantilla local; no bloquea la entrega.
- Presentación supera los 5 min → ensayar y recortar (regla de corte a las 18:00 domingo).

---

## 8. Entrega final (checklist)

**Checklist de funcionamiento (antes de las 23:59 del 15 Nov, hora RD)**
- [ ] Backend desplegado o documentado (cómo correr localmente) y responde `/api/v1/images/search`
- [ ] Frontend desplegado en URL pública y accesible
- [ ] App muestra imagen real del cielo de SPHEREx y permite alternar dos épocas (o modo offline con muestras reales)
- [ ] Visible disclaimer: "candidatos, no descubrimientos confirmados" + créditos NASA/IPAC IRSA
- [ ] Video demo de ≤ 30 segundos en inglés, con audio y subtítulos
- [ ] Presentación de ≤ 5 minutos en español, ≤ 10 diapositivas
- [ ] Guión del presentador ensayado y cronometrado
- [ ] Repositorio limpio, commits ordenados, README actualizado
- [ ] `docs/entrega/fuentes-y-creditos.md` con DOI y licencias de dependencias
- [ ] Envío completo en spaceappschallenge.org antes del plazo

**Repositorio y documentación**
- Código: `nasachallenges-app/` (backend + frontend)
- Plan: `docs/superpowers/plans/2026-11-14-nasa-spaceapps-spherex.md` (este documento)
- Demo: `docs/demo/`
- Presentación: `docs/presentacion/`
- Entrega: `docs/entrega/`

**Fuentes, licencias y créditos**
- Datos: NASA/IPAC IRSA SPHEREx DR1 (DOI 10.26131/IRSA678), QR3 (DOI 10.26131/IRSA662). Reconocimiento: "This publication makes use of data products from SPHEREx, a joint project of JPL and Caltech, funded by NASA."
- Librerías: FastAPI, astropy, astroquery, React, Three.js, Tailwind — respetar sus licencias (MIT/BSD/Apache según corresponda).
- Equipo: 4 integrantes; roles: Miembros 1 y 2 = desarrollo web; Miembros 3 y 4 = demo audiovisual y presentación.

---

## Auto-revisión del plan

**1. Cobertura del espec:** Cada requisito de las 8 secciones del usuario tiene una sección dedicada y, para el desarrollo, tareas concretas (T1–T15). El desafío oficial (verbo principal) está cubierto por T2–T9. Gaps: ninguno identificado.

**2. Escaneo de pasos:** Cada paso permite escribir exactamente una cosa razonable (una prueba, un comando, una firma, un commit). No hay líneas del tipo "TBD", "manejo de casos edge" ni "escribir pruebas para lo anterior" sin definir. Los cuerpos de código solo aparecen cuando la firma y las pruebas no los determinan (algoritmos de comparación y cutout).

**3. Consistencia de tipos:** `search_images` (T2) → `get_cutout_png` (T3) → `compare_epochs` (T4) → endpoints (T5) → frontend (T6–T8). Los nombres `detector_array`, `access_url`, `obs_id` son consistentes entre tareas. `BandSelector` emite `detector_array: 1..6`, consumido por `SkyViewer`/`BlinkComparator` y por los endpoints.

**4. Review Focus (cinco condiciones que ninguna prueba ejerce pero que podrían morder al usuario):**
- Red de IRSA no disponible durante la demo → T8 añade modo offline con `sample_images`; prueba en T8 verifica que sin red la app usa muestras.
- Usuario introduce coordenadas inválidas → T5 endpoint devuelve 200 con `results` vacío (no falla); prueba `test_search_endpoint_returns_json_list` cubre forma, añadir en T5 un paso de coordenadas inválidas (ver nota abajo).
- Dos imágenes de épocas distintas no alineadas exactamente → T4 diferencia por píxel sin ajuste WCS; disclaimer en T9 advierte que es una aproximación visual.
- Falta de API key de OpenRouter/Supabase → T9 y sección 7: Module 4 usa plantilla local, no bloquea.
- Imagen de muestra vs. dato real confundida → T8 marca "modo demo offline" y T9/T15 exigen créditos y disclaimer.

*Acción pendiente de pinchar:* en T5 añadir prueba `test_search_endpoint_invalid_coordinates_returns_empty_list` (422 o lista vacía, sin excepción). Se incorpora al Step 3 de T5.

**5. Proporción:** El plan es un documento de ejecución (incluye las 8 secciones solicitadas por el usuario), no un transcript del programa. Los bloques de código son firmas y aserciones de prueba, no cuerpos completos. Longitud acorde a una ejecución de 1.5 días para 4 personas.

---

**Plan completo y guardado en `docs/superpowers/plans/2026-11-14-nasa-spaceapps-spherex.md`.**

Por favor, revise el plan. ¿Captura lo que quiere? ¿Qué enfoque de ejecución prefiere?

- **Subagent-driven** — Un subagente nuevo implementa cada tarea y un revisor nuevo la comprueba antes de la siguiente, y una revisión completa de la rama al final. Más exhaustivo; cuesta un contexto nuevo por tarea y por revisión.
- **Native** — Yo implemento cada tarea en esta sesión, como se ejecuta el trabajo en este harness, y un revisor nuevo en el modelo más capaz revisa toda la rama al final. Más barato y rápido; sin revisión independiente hasta el final. Funciona bien con un modelo de sesión de nivel medio, ya que el plan lleva el diseño.

**Para este plan recomiendo Native**, porque las tareas tienen pocas dependencias entre sí (dos pistas paralelas tras T1), hay 15 tareas cortas y el costo de un error en el envío es bajo dado el período de integración obligatoria del domingo. ¿El plan captura lo que quiere, y qué enfoque usamos?
