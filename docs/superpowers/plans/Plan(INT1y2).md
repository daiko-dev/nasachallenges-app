# NASA Space Apps 2026 · Planet X and SPHEREx — Plan de Ejecución Técnico

*Preparado el sábado 14 de noviembre de 2026 · Equipo de Desarrollo (Integrantes 1 y 2) · Entrega límite: domingo 15 de noviembre, 11:59 p. m. (hora de RD). Nombre provisional del proyecto: **SkyShift**.*

**Cómo leer las etiquetas de confianza:** **\[Verificado\]** = leído en documentación oficial de NASA/IRSA o en las reglas de Space Apps. **\[Terceros\]** = lo vi en repos, artículos o páginas que no son oficiales; confirmar antes de depender de ello. **\[Mi criterio\]** = decisión o estimación mía, no un hecho publicado.

---

## Cabecera del plan (formato técnico)

**Goal:** Publicar antes del límite una web pública que, con datos reales de SPHEREx (DR1 y QR3 vía IRSA), permita a cualquier persona ver cómo cambia una región del cielo entre observaciones y marque candidatos a objetos en movimiento, explicando hallazgos de forma validada con IA.

**Architecture:** Pipeline Python offline (pyvo/astroquery + astropy) que genera por campo un `manifest.json`, fotogramas alineados y `candidates.json`; frontend estático en TypeScript (Vite) con Aladin Lite v3 como contexto del cielo y un visor de parpadeo (blink) en Canvas 2D; API FastAPI opcional para búsquedas en vivo; explicaciones en lenguaje sencillo generadas con IA solo a partir de JSON calculado y validadas por código.

**Tech Stack:** TypeScript + Vite + vitest; Aladin Lite v3; Python 3.11 + astropy + pyvo/astroquery + reproject + photutils + scipy + pytest; FastAPI; OpenRouter (solo offline); GitHub Pages (estático) + Render (API).

### Global Constraints (Técnicas)

- Datos: SPHEREx tiene **102 canales espectrales entre 0.75 y 5.0 µm**. Usar **DR1 + QR3** (colecciones SIA2 `spherex_dr1`, `spherex_qr3`). **QR2 ya no es buscable.** \[Verificado\]
- Crédito obligatorio en la UI: «SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive».
- Ningún dato sintético o ilustrativo puede aparecer sin una etiqueta visible «SYNTHETIC TEST DATA — not SPHEREx».
- Lenguaje de interfaz: «candidato», «posible», «no validado». Nunca «descubrimiento» ni «Planet X encontrado».

### Review Focus (los 5 casos que más probablemente rompan la herramienta)

1. **Coordenada sin cobertura SPHEREx o con una sola época** → mensaje claro y vista vacía útil, nunca pantalla en blanco ni error 500. Test en Tarea P6 y F5.
2. **Recorte con el objetivo en el borde del detector o píxeles marcados en FLAGS** → la época se excluye o se marca; no genera candidatos. Test en P2 y P4.
3. **Épocas con longitud de onda distinta** → una diferencia de brillo entre longitudes de onda distintas no es variabilidad; la UI lo avisa. Test en P3 y F2.
4. **IRSA lento o caído / retraso de \~1 día de SIA2** → degradación a campos precalculados con banner de estado. Test en P6 y F5.
5. **Coordenadas mal escritas**: sexagesimal vs decimal, RA fuera de 0–360. Test en F1 y P6.

---

## 1. Evaluación de la Arquitectura de Datos (NASA / IRSA)

### 1.1 Datos de SPHEREx: qué existe hoy (documentación IRSA fechada 12-nov-2026)

- **DR1** (publicado nov-2026) = Surveys 1 y 2. **QR3** = Surveys 3 y 4. No mezclar QR2 con DR1/QR3 por cambios de calibración. \[Verificado\]
- **Búsqueda:** SIA2 en `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1|spherex_qr3&POS=circle+RA+DEC+RADIO`.
- **Recortes (cutouts):** A la `access_url` de la imagen se le añade `?center=RA,Dec&size=<grados>`. (Tamaño \~0.1°).
- **Contenido de cada imagen FITS:** 6 extensiones: IMAGE, FLAGS, VARIANCE, ZODI, EPSF/PSF y WCS-WAVE.
- **Riesgo científico clave:** Cada imagen es de **un solo detector (6 bandas, 0.75–5 µm)** y la longitud de onda varía a lo largo del detector. Por tanto, comparar dos fechas sin igualar longitud de onda mezcla cambio real con cambio de color. \[Verificado\]. **Solución:** Emparejar épocas por longitud de onda en el pipeline (Tarea P3).

### 1.2 Riesgos científicos mitigados

| Riesgo | Por qué importa | Mitigación |
| --- | --- | --- |
| Comparar épocas de distinta longitud de onda | Falsos «cambios» visuales | Emparejar épocas por longitud de onda (Tarea P3) y mostrar insignia matched/mismatch en la UI |
| Artefactos (bordes, píxeles malos) | Falsos candidatos | Enmascarar FLAGS, ignorar bordes, exigir S/N mínimo |
| Mezclar calibraciones | Saltos de brillo | Solo usar DR1+QR3 |

---

## 2. Arquitectura de Software (Mínima Viable)

```text
IRSA (SIA2 · Cutout)  ──►  pipeline/ (Python, offline)  ──►  web/public/data/<campo>/
                                   │       ▲                        ├─ manifest.json
                                   ▼       │                        ├─ frames/*.png
                    JPL SBIdent · Gaia (TAP) · SIMBAD               └─ candidates.json
                                                                          │
   FastAPI /api/field (en vivo, P1) ◄─────────── fetch ───────────  web/ (Vite + TS)
   OpenRouter (solo offline, P2) ─► texto en candidates.json         ├─ Aladin Lite v3 (contexto)
                                                                     └─ Visor blink (Canvas 2D)
```

| Decisión | Justificación |
| --- | --- |
| **Estático primero, en vivo después** | Un proyecto con datos pre-calculados garantiza funcionar ante los jueces aunque la red falle. |
| **Aladin Lite v3** como contexto | Ya es WebGL2 y soporta HiPS. No reinventar la rueda con Three.js desde cero. |
| **Canvas 2D** para épocas | Los recortes son \~58×58 px; `image-rendering: pixelated` es suficiente. |
| **Python offline para la ciencia** | astropy/photutils ya hacen el trabajo pesado; el frontend (TypeScript) solo consume JSON ligero. |
| **IA solo offline y con validador** | La IA no calcula nada en vivo. Solo recibe JSON duro y escupe una explicación. |

---

## 3. Plan de Desarrollo (División de Tareas Técnicas)

### 3.1 Contrato de Datos (T0: Integrantes 1 y 2, 30 min)
Ambos desarrolladores deben definir el formato de intercambio entre Python y TypeScript.

```ts
// web/src/types.ts  (espejo en pipeline/skyshift/manifest.py como dataclasses)
export type Release = 'dr1' | 'qr3';
export interface Epoch {
  id: string;             
  obsId: string;          
  utc: string;            
  release: Release;
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  lambdaUm: number;       
  bandwidthUm: number;
  frameUrl: string;       // PNG alineado
  sourceUrl: string;      
}
export interface FieldManifest {
  schemaVersion: '1.0';
  id: string; name: string;
  epochs: Epoch[];
  matchedPairs: [string, string][];  
  candidates: any[];
}
```

### 3.2 Backend y Ciencia de Datos (Integrante 2 - Python)

**P0 · Spike de IRSA (45 min, primero de todo)**
* Probar búsqueda `Irsa.query_sia` en una posición de prueba.
* Descargar recorte `access_url + '?center=RA,Dec&size=0.1'`.
* Guardar respuestas en `pipeline/tests/fixtures/` para tests offline.

**P1 · Búsqueda de épocas**
* `search_epochs(ra, dec)` usando astroquery ordenado por fecha MJD.
* Test de fallos (sin cobertura, coordenadas al límite).

**P2 · Recortes y longitud de onda**
* Descargar el recorte y usar `astropy` para leer WCS-WAVE y extraer la longitud de onda central del objetivo. Lanza error si el objetivo está muy al borde.

**P3 · Fotogramas, manifest y campos de muestra**
* Alinear imágenes a una rejilla común usando `reproject_interp`.
* Determinar qué épocas hacen `matchedPairs` (misma longitud de onda).
* Generar los PNGs y el `manifest.json`.
* **Hito:** Hornear 3 campos reales (Ej. una estrella de alto movimiento propio, un objeto conocido, y un campo de control estático).

**P4 · Detección de candidatos (Prioridad Media)**
* Usar `photutils` (DAOStarFinder) sobre pares de imágenes con misma longitud de onda para detectar movimiento real.

**P6 · API en vivo (FastAPI) (Prioridad Media)**
* Crear endpoints `GET /api/health` y `GET /api/field?ra=&dec=`.
* Desplegar en Render (con CORS hacia el frontend).

**P7 · Explicaciones con IA validadas (Opcional/Final)**
* Conectar `OpenRouter` offline.
* Pasar el `manifest.json` y exigir un reporte en texto plano. 
* Crear función `assert_numbers_grounded(text, facts)` que provoque un fallo si el LLM inventa algún número que no estaba en el JSON.

### 3.3 Frontend y Visualización (Integrante 1 - TypeScript)

**F1 · Scaffold, estado en URL y mapa**
* Crear proyecto Vite (`vanilla-ts`).
* Integrar **Aladin Lite v3** para el fondo estelar.
* Leer coordenadas desde la URL (ej. `?ra=120&dec=40`).

**F2 · Visor blink de épocas (Core)**
* UI para reproducir, pausar y usar un slider (deslizador) entre las épocas del `manifest.json`.
* Dibujar los fotogramas en Canvas 2D (`image-rendering: pixelated`).
* Mostrar insignia: "Wavelength Matched" (verde) o "Wavelength Mismatch" (naranja, con alerta).

**F3 · Candidatos y tarjeta de evidencia**
* UI para leer la lista de `candidates.json` y pintar su trayectoria en el Canvas.
* Mostrar el reporte de la IA (si está disponible) asegurando el título "Candidate · Unvalidated".

**F4 y F5 · Modo en vivo y UX**
* Conectar la UI al backend FastAPI (P6). Si falla, cargar silenciosamente uno de los 3 campos pre-calculados (fallback).

---

## 4. Cronograma de Desarrollo Técnico

### Sábado 14 de noviembre

| Hora Relativa | Integrante 1 (Frontend) | Integrante 2 (Backend/Datos) |
| --- | --- | --- |
| **H0:00–0:45** | Inicializar Vite, integrar Aladin Lite. | **P0 spike** (pruebas de descarga IRSA). |
| **H0:45–1:15** | **T0** Acordar contrato de datos. | **T0** Generar fixture falso. |
| **H1:15–2:45** | F1: Componente de coordenadas. | P1 → P2 (Script de astroquery y WCS). |
| **H2:45–4:45** | F2: Programar el Blink Comparator. | **P3:** Procesar recortes y exportar el primer campo real a JSON. |
| **H4:45 = M2** | \> **Hito: Esqueleto andando. El frontend lee el JSON real del backend.** |
| **H4:45–7:00** | F3: UI de candidatos. | P3 (Terminar 3 campos) → P4 (photutils). |
| **H7:00–8:00** | Despliegue en GitHub Pages. | Conectar FastAPI (P6) y probar CORS. |

### Domingo 15 de noviembre

| Hora Relativa | Integrante 1 (Frontend) | Integrante 2 (Backend/Datos) |
| --- | --- | --- |
| **08:30–12:00** | F4 (UX) y F5 (Integrar API en vivo). | P6 (Desplegar Render), P7 (Pipeline IA). |
| **12:00 = M4** | \> **Congelación de nuevas funciones.** Lo que no esté terminado se corta. |
| **12:00–15:00** | Integración profunda, control de errores y fallbacks. | Pruebas unitarias de validador de IA y extracción WCS. |
| **15:00 = M5** | \> **URL pública estable + repo público actualizado.** |
| **15:00–17:30** | Resolución de bugs críticos únicamente. | Preparar documentación técnica (README). |
| **17:30 = M6** | \> **Congelación de código total.** Entregar versión final al equipo de presentación. |

---

## 5. Estrategia de Evaluación Técnica

Para maximizar la puntuación en **Validity** e **Impact**:
1. **Datos Reales Visibles:** Asegurarse de que el frontend imprima claramente la fecha de observación y la longitud de onda de cada imagen renderizada.
2. **Robustez ante fallos:** Los jueces probarán el sistema. Si la NASA (IRSA) se cae, la app frontend debe capturar el error `504` de la API e inyectar inmediatamente el `manifest.json` pre-calculado del Campo de Control, evitando pantallas blancas.
3. **Rigurosidad (Sin Alucinaciones):** El código backend (P7) garantiza que ningún LLM se invente descubrimientos. Esto es crucial para la credibilidad técnica del proyecto.

## 6. Checklist de Entrega Técnica (Antes de las 17:30 del domingo)

- [ ] La URL pública abre en móvil (390 px) y en ventana de incógnito.
- [ ] Los 3 campos pre-calculados cargan con datos reales y se ven fotogramas en el Canvas.
- [ ] El Blink Comparator, la línea de tiempo y la insignia de "Matched/Mismatch" funcionan correctamente.
- [ ] Una coordenada aleatoria (modo en vivo) busca en el backend; si falla, degrada amablemente.
- [ ] Repo GitHub público, limpio, con `LICENSE` (Apache 2.0).
- [ ] `README.md` técnico completo: cómo ejecutar Vite, cómo levantar FastAPI, cómo correr los scripts de Python.
- [ ] Dependencias documentadas (astropy, Three/Aladin, Vite, photutils).