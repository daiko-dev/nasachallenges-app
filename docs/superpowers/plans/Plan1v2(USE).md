# NASA Space Apps 2026 · Planet X and SPHEREx — Plan de ejecución

*Preparado el sábado 14 de noviembre de 2026 · Equipo de 4 · Entrega límite: domingo 15 de noviembre, 11:59 p. m. (hora de RD). Nombre provisional del proyecto: **SkyShift**.*

**Cómo leer las etiquetas de confianza:** **\[Verificado\]** = leído en documentación oficial de NASA/IRSA o en las reglas de Space Apps. **\[Terceros\]** = lo vi en repos, artículos o páginas que no son oficiales; confirmar antes de depender de ello. **\[Mi criterio\]** = decisión o estimación mía, no un hecho publicado. **\[Por verificar\]** = no pude comprobarlo; tiene una tarea asignada en la sección 0.3.

---

## Cabecera del plan (formato writing-plans)

**Goal:** publicar antes del domingo 11:59 p. m. una web pública que, con datos reales de SPHEREx (DR1 y QR3 vía IRSA), permita a cualquier persona ver cómo cambia una región del cielo entre observaciones y marque candidatos a objetos en movimiento, sin presentarlos nunca como descubrimientos.

**Architecture:** pipeline Python offline (pyvo/astroquery + astropy) que genera por campo un `manifest.json`, fotogramas alineados y `candidates.json`; frontend estático en TypeScript (Vite) con Aladin Lite v3 como contexto del cielo y un visor de parpadeo (blink) en Canvas 2D para las épocas; API FastAPI opcional para búsquedas en vivo; explicaciones en lenguaje sencillo generadas con IA solo a partir de JSON calculado y validadas por código.

**Tech Stack:** TypeScript + Vite + vitest; Aladin Lite v3; Python 3.11 + astropy + pyvo/astroquery + reproject + photutils + scipy + pytest; FastAPI; OpenRouter (solo offline); GitHub Pages (estático) + Render (API).

**Spec:** el brief del equipo (4 módulos), el desafío «Planet X and SPHEREx», los términos de participación 2026 y la guía de entrega 2026.

### Global Constraints (valores exactos, aplican a todas las tareas)

- Demo: **video de 30 s o menos** o **presentación de máximo 7 diapositivas** (incluyendo portada e introducción). Exceder el límite = no elegible para Global Judging. \[Verificado\]
- Entrega: botón **Submit for Judging** antes del **domingo 15 de noviembre, 11:59 p. m. (hora local)**. La entrega abre el sábado 14 a las 9:00 a. m. Equipos de máximo 6. \[Verificado\]
- Criterios publicados: **Impact, Creativity, Validity, Relevance, Presentation**. \[Verificado\]
- Licencia: todo contenido original debe ser de uso libre u OSI; si no se especifica, NASA lo distribuye como Apache 2.0. Material de terceros debe ser público/libre o OSI, con su licencia identificada. **Hay que citar toda fuente, incluso open source.** \[Verificado\]
- No incluir información personal. **No incluir nombres, voces ni imágenes reconocibles de menores de 18 años en ningún video.** \[Verificado\]
- El video debe ser trabajo original del equipo; música e imágenes no pueden infringir derechos. \[Verificado\]
- Datos: SPHEREx tiene **102 canales espectrales entre 0.75 y 5.0 µm**. Usar **DR1 + QR3** (colecciones SIA2 `spherex_dr1`, `spherex_qr3`). **QR2 ya no es buscable.** \[Verificado\]
- Crédito obligatorio en la UI y el video: «SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive». \[Terceros: forma usada por otros equipos; el texto exacto de crédito debe confirmarse en IRSA\]
- Ningún dato sintético o ilustrativo puede aparecer sin una etiqueta visible «SYNTHETIC TEST DATA — not SPHEREx».
- Lenguaje: «candidato», «posible», «no validado». Nunca «descubrimiento» ni «Planet X encontrado».

### Review Focus (los 5 casos que más probablemente rompan la herramienta)

1. **Coordenada sin cobertura SPHEREx o con una sola época** → mensaje claro y vista vacía útil, nunca pantalla en blanco ni error 500. Test en Tarea P6 y F5.
2. **Recorte con el objetivo en el borde del detector o píxeles marcados en FLAGS** → la época se excluye o se marca; no genera candidatos. Test en P2 y P4.
3. **Épocas con longitud de onda distinta** → una diferencia de brillo entre longitudes de onda distintas no es variabilidad; la UI lo avisa. Test en P3 y F2.
4. **IRSA lento o caído / retraso de \~1 día de SIA2** → degradación a campos precalculados con banner de estado. Test en P6 y F5.
5. **Coordenadas mal escritas**: sexagesimal vs decimal, RA fuera de 0–360, cruce del 0°/360° y polos. Test en F1 y P6.

---

## 0. Hallazgos de la investigación (lo que cambia el plan)

### 0.1 Qué exige NASA realmente

- **El desafío** (resumen oficial replicado por sedes del evento): crear una **herramienta web pública que muestre imágenes del cielo de SPHEREx y permita a cualquiera ver rápidamente cómo cambian con el tiempo.** \[Terceros: la página oficial bloquea acceso automatizado, así que no pude leer sus «considerations» ni recursos recomendados. Tarea V1.\] Etiquetado nivel **Advanced**. \[Terceros: HackAthlone\]
- **Las soluciones deben abordar directamente un desafío publicado** para ser elegibles. \[Verificado: [términos 2026](https://www.spaceappschallenge.org/legal/)\]
- **La entrega oficial es un demo de ≤30 s en video o ≤7 diapositivas**; no hay una «presentación de 5 minutos» en la guía de entrega que pude leer. \[Verificado: [guía de entrega](https://www.spaceappschallenge.org/resources/project-submission-guide/)\] Los 5 minutos serán útiles si su evento local los pide. \[Por verificar: V2\]
- **Decisión:** el mazo de 5 minutos tendrá **exactamente 7 diapositivas**, así sirve para ambos casos.

### 0.2 Datos de SPHEREx: qué existe hoy (documentación IRSA fechada 12-nov-2026)

- **DR1** (publicado en noviembre de 2026) = Surveys 1 y 2 reprocesados con la misma calibración que QR3. **QR3** = Surveys 3 y 4, liberado semanalmente desde septiembre de 2026. **QR2 no es buscable** y solo se puede descargar hasta febrero de 2027; evitar mezclar QR2 con DR1/QR3 por cambios de calibración. \[Verificado: [Data Releases](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-releases)\]
- **Búsqueda:** SIA2 en `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1|spherex_qr3&POS=circle+RA+DEC+RADIO`. Hay colecciones `_deep`. SIA2 tiene un retraso de \~1 día; TAP (tabla `spherex.artifact`) ve datos recién ingeridos. \[Verificado: [Data Access](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/)\]
- **Recortes (cutouts):** a la `access_url` de la imagen se le añade `?center=RA,Dec&size=<grados>`. El ejemplo oficial usa `size=0.1`. Los límites de tamaño \[Terceros: 0.01–0.5°\] se confirman en el spike. \[Verificado + Terceros\]
- **Contenido de cada imagen:** 6 extensiones: IMAGE (2040×2040, MJy/sr, sin sustraer luz zodiacal), FLAGS, VARIANCE, ZODI, EPSF/PSF y WCS-WAVE (mapa píxel→longitud de onda). Los recortes conservan las mismas extensiones. \[Verificado: [Data Products](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-products)\]
- **Dato científico clave:** cada imagen es de **un solo detector/banda (6 bandas, 0.75–5 µm)** y la longitud de onda **varía a lo largo del detector** (filtros lineales variables). Un mismo punto del cielo cae a distinta longitud de onda en cada exposición. Por tanto, **comparar dos fechas sin igualar longitud de onda mezcla cambio real con cambio de color.** \[Verificado: Data Products\] Es el punto de validez más importante del proyecto.
- **Cobertura temporal:** el cielo completo se cubre 4 veces en 25 meses (\~cada 6 meses). \[Terceros: [arXiv 2607.00543](https://arxiv.org/pdf/2607.00543)\]
- **Imagen de cielo completo para navegar:** DR1 trae un All-Sky Cube con árbol HiPS de PNG (un fotograma por canal) solo para visualización, con estiramiento fijo 0–40 MJy/sr. \[Verificado\] Su URL pública exacta no la pude confirmar. CDS lista HiPS de SPHEREx QR2 (D1–D6 y color), que son mosaicos de una sola época. \[Terceros: [lista HiPS de CDS](https://aladin.cds.unistra.fr/java/nph-aladin.pl?frame=aladinHpxList)\] **Conclusión:** el HiPS sirve de contexto, no de comparación temporal; el tiempo viene de SIA2 + recortes.
- **Acceso en nube:** bucket S3 público `nasa-irsa-spherex` (us-east-1, anónimo) como alternativa si el servicio de recortes falla. \[Verificado: [tutorial IRSA](https://caltech-ipac.github.io/irsa-tutorials/spherex-source-discovery-tool-demo/)\]

### 0.3 Verificaciones obligatorias en los primeros 30 minutos

| ID | Responsable | Qué comprobar | Resultado esperado |
| --- | --- | --- | --- |
| V1 | Integrante 4 | Abrir [la página del desafío](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/): leer «considerations», recursos y datos recomendados | Lista de 5–8 requisitos copiada a `docs/CHALLENGE.md` |
| V2 | Integrante 3 | Preguntar a la organización de su evento local: ¿presentación de 5 min?, ¿idioma?, ¿hora límite exacta? | Respuesta escrita en el canal del equipo |
| V3 | Integrante 4 | Leer Participant FAQs y la **Judging and Awards Guide 2026** (publicada el 13-nov): política de IA, idioma de la entrega, si el video va como archivo o enlace | Notas en `docs/RULES.md` |
| V4 | Integrante 2 | Spike de IRSA (Tarea P0) | `docs/SPIKE.md` con Go/No-go |
| V5 | Integrante 1 | Versión estable de Aladin Lite v3 y HiPS de contexto que cargue | Versión fijada en `package.json` |
| V6 | Integrante 4 | Revisar «Global Offers» 2026 (herramientas gratuitas de colaboradores) | Lista de créditos útiles, si los hay |

> No encontré una política específica de Space Apps 2026 sobre uso de IA. **Regla del equipo:** declarar en el README y en la entrega qué partes se hicieron con asistencia de IA y qué datos son calculados vs. explicados por IA.

---

## 1. Evaluación de la propuesta

### 1.1 Módulo por módulo frente al desafío

| Módulo | ¿Responde al desafío? | Veredicto | Cambio |
| --- | --- | --- | --- |
| 1. Explorador visual | **Sí, es el núcleo** | Conservar | Sustituir Three.js a medida por **Aladin Lite v3** (ya usa WebGL2) + visor 2D de épocas |
| 2. Datos oficiales IRSA | **Sí, obligatorio** (datos reales) | Conservar, es la prioridad 1 | Usar DR1/QR3 (no QR2); pre-hornear campos y añadir modo en vivo |
| 3. Análisis científico | **Parcial.** El desafío pide ver cambios, no detectar objetos | Conservar como valor añadido, acotado | Comparación temporal + candidatos + validación con objetos conocidos. Espectros: solo vínculo a la herramienta de IRSA |
| 4. Informes con IA | **No lo pide el desafío** | Reducir a P2 | Sin Supabase/pgvector; explicaciones precalculadas y validadas por código |

### 1.2 Fortalezas

- Dirección correcta: datos reales, lenguaje honesto («no presentar predicciones como descubrimientos») y enfoque en público no especialista, que es lo que pide el desafío.
- La regla «la IA no calcula, solo explica» es sólida y se puede demostrar con un test automático.
- Equipo bien dividido: 2 construyen, 2 comunican.

### 1.3 Debilidades

- **Alcance excesivo para \~1.5 días**: visor 3D propio + IRSA + análisis + RAG con pgvector + IA no cabe. Cada módulo extra le quita tiempo a lo que sí puntúa: que el visor funcione con datos reales.
- **Three.js desde cero** reinventa lo que Aladin Lite ya resuelve. Para recortes de \~60×60 píxeles basta un Canvas 2D.
- **Supabase + pgvector** necesitan un corpus que no tenemos; no aportan a Validity.
- La presentación de 5 min no es el entregable oficial; el demo de 30 s sí.

### 1.4 Riesgos científicos y cómo los tratamos

| Riesgo | Por qué importa | Mitigación |
| --- | --- | --- |
| Comparar épocas de distinta longitud de onda | Falsos «cambios» | Emparejar épocas por longitud de onda (Tarea P3) y mostrar insignia matched/mismatch |
| Esperar detectar Planet X | Una búsqueda con WISE ya excluyó Planet Nine en el espacio de parámetros que buscó hasta W1 < 16.7 \[Terceros: [Meisner et al.](https://portal.nersc.gov/project/cosmo/temp/ameisner/p9/ms.pdf)\]. Con exposiciones individuales de SPHEREx, **no esperamos** detectarlo \[Mi criterio\] | Planet X es motivación, no resultado. Se dice en la UI y en los guiones |
| Artefactos (bordes, píxeles malos, rayos cósmicos, luz zodiacal sin sustraer en recortes) | Falsos candidatos | Enmascarar FLAGS, ignorar bordes, exigir S/N mínimo y mostrar «evidencia» por candidato |
| Mezclar calibraciones | Saltos de brillo | Solo DR1+QR3; indicar la liberación de cada época |
| Velocidades: ¿qué se mueve de verdad entre épocas? | Un asteroide cambia de posición en horas/días; objetos lejanos y estrellas de gran movimiento propio, entre meses | Dos regímenes en la UI: «movimiento rápido (dentro de una visita)» y «cambio lento (entre estudios)» |

### 1.5 Correcciones al brief

1. «102 bandas» → son **102 canales espectrales repartidos en 6 detectores/bandas**; cada recorte tiene una longitud de onda por píxel.
2. «Explorar fechas» → fechas **por exposición**, agrupadas por visita/estudio.
3. «Anomalías» → llamarlas **candidatos no validados**.
4. «Moléculas/espectros» → fuera del MVP; enlazar la [herramienta de espectrofotometría de IRSA](https://irsa.ipac.caltech.edu/applications/spherex/toolspectrophotometry) \[Terceros: citada en [arXiv 2604.26771](https://arxiv.org/pdf/2604.26771)\] en lugar de reimplementarla.

### 1.6 Competencia: el terreno está lleno

Hoy mismo hay **al menos 12 repositorios públicos** para este mismo desafío (p. ej. [spherex-blink](https://github.com/pythonhack000/spherex-blink), [spherex-moving-sky](https://github.com/shrestha-droid/spherex-moving-sky), [SPHEREx Blink](https://github.com/mateibut/SPHEREx), [Planetes](https://github.com/t-valand/Planetes), [spherex-planet-x](https://github.com/epsretriever/spherex-planet-x), [PhotonX](https://github.com/Mazonia/photonx), [Orbital](https://github.com/FaizeenHoque/Orbital), [spherex-motion-explorer](https://github.com/shree-aru/spherex-motion-explorer)). \[Terceros: solo vi sus extractos\]

- **Implicación:** «blink + candidatos + comparar con asteroides conocidos» **no diferencia por sí solo**; es lo común.
- **Regla:** estudiar qué hacen, **no copiar código** (los términos exigen que tengan los derechos de lo que entregan). Partimos de los [tutoriales oficiales de IRSA](https://caltech-ipac.github.io/irsa-tutorials/spherex/).

### 1.7 Dónde sí podemos diferenciarnos en 1.5 días

1. **Honestidad científica visible**: insignia λ-matched/mismatch en cada comparación, panel «Qué NO es esto» y un campo de control estático donde no aparece nada.
2. **Recorridos guiados para no especialistas** (3 casos con una frase cada uno) en vez de solo un cuadro de coordenadas.
3. **Explicaciones con IA que no pueden inventar números**: el test `assert_numbers_grounded` rechaza cualquier cifra que no esté en los datos calculados. En los extractos que vi no aparece algo equivalente; no lo afirmo como exclusivo.
4. **Interfaz bilingüe EN/ES** y URL compartible por vista.

---

## 2. Arquitectura mínima viable

```
IRSA (SIA2 · TAP · Cutout)  ──►  pipeline/ (Python, offline)  ──►  web/public/data/<campo>/
                                   │       ▲                        ├─ manifest.json
                                   ▼       │                        ├─ frames/*.png
                    JPL SBIdent · Gaia (TAP) · SIMBAD               └─ candidates.json
                                                                          │
   FastAPI /api/field (en vivo, P1) ◄─────────── fetch ───────────  web/ (Vite + TS)
   OpenRouter (solo offline, P2) ─► texto en candidates.json         ├─ Aladin Lite v3 (contexto)
                                                                     └─ Visor blink (Canvas 2D)
```

### 2.1 Decisiones técnicas y por qué

| Decisión | Justificación |
| --- | --- |
| **Estático primero, en vivo después** | Un demo con datos reales garantizado aunque IRSA falle durante el juicio |
| **Aladin Lite v3** como contexto | Ya es WebGL2 y soporta HiPS y FITS; GPL-3.0 \[Verificado: [repo](https://github.com/cds-astro/aladin-lite)\] |
| **Canvas 2D** para épocas | Los recortes son \~58×58 px (0.1° a \~6.2″/px, cálculo propio); `image-rendering: pixelated` basta |
| **Vite + TypeScript sin framework** | Arranque inmediato; menos que depurar |
| **Python offline para la ciencia** | astropy/photutils ya hacen el trabajo; el navegador solo consume JSON |
| **GitHub Pages + Render (API)** | Sin fricción de cuentas; Render gratuito duerme (\~1 min en despertar) \[Terceros\], por eso lo en vivo es P1 |
| **IA solo offline y con validador** | La clave nunca está en el navegador; sin fallos en vivo |
| **Sin Supabase / pgvector / Three.js** | No hay corpus ni escena 3D que los justifique |

### 2.2 Software que se reutiliza

| Necesidad | Se reutiliza | Enlace |
| --- | --- | --- |
| Mapa del cielo | Aladin Lite v3 (GPL-3.0) | [github.com/cds-astro/aladin-lite](https://github.com/cds-astro/aladin-lite) |
| Consultas IRSA | astroquery.ipac.irsa y pyvo | [astroquery](https://astroquery.readthedocs.io/en/latest/ipac/irsa/irsa.html) · [pyvo](https://pyvo.readthedocs.io/en/latest/) |
| Recortes y λ por píxel | Tutorial oficial de recortes | [spherex\_cutouts](https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts/) |
| Alineación | reproject | [reproject.readthedocs.io](https://reproject.readthedocs.io) |
| Detección de fuentes | photutils | [photutils.readthedocs.io](https://photutils.readthedocs.io) |
| Objetos conocidos | JPL SBIdent / Horizons | [sb\_ident](https://ssd-api.jpl.nasa.gov/doc/sb_ident.html) · [Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) |
| Explorar/descargar a mano | SPHEREx Data Explorer | [irsa.ipac.caltech.edu/applications/spherex](https://irsa.ipac.caltech.edu/applications/spherex) |
| Espectros | Herramienta de espectrofotometría de IRSA (vínculo) | ver 1.5 |

### 2.3 Licencias

**Decisión \[Mi criterio, no es asesoría legal\]:** código propio bajo **Apache-2.0** (coincide con el valor por defecto de NASA). Aladin Lite (GPL-3.0) se carga como dependencia de terceros, citada. Si prefieren eliminar cualquier ambigüedad por la combinación, licencien el repositorio completo como **GPL-3.0**; ambas son licencias OSI. Decidirlo en 5 minutos al crear el repo y no cambiarlo.

---

## 3. Plan de desarrollo

### 3.1 Reglas de trabajo

- Un repositorio público (`skyshift-spherex`) con licencia elegida en el minuto 5. Commits pequeños; **cada tarea termina con un commit**.
- El contrato de datos (3.2) se congela en T0. Un cambio posterior se avisa en el canal del equipo antes de tocarlo.
- Pruebas solo donde protegen la validez científica o evitan fallos visibles: longitud de onda, máscaras, candidatos, validador de IA, parseo de coordenadas, estados vacíos. No se escriben tests de UI.
- **Datos sintéticos:** `provenance.synthetic = true` + banner rojo en la UI. El script `scripts/check_no_synthetic.py` falla el despliegue si hay datos sintéticos fuera de `web/public/data/_fixture/`, y esa carpeta se excluye del build de producción.
- Uso de IA para acelerar código, texto y diseño: permitido; se declara en `docs/AI-USE.md`. Cada cifra científica del producto sale de código, no de un modelo.

### 3.2 Contrato de datos (T0: Integrantes 1 y 2, 30 min)

```ts
// web/src/types.ts  (espejo en pipeline/skyshift/manifest.py como dataclasses)
export type Release = 'dr1' | 'qr3';
export interface Epoch {
  id: string;             // 'e03'
  obsId: string;          // p. ej. '2026W21_2A_0001_1' (formato de IRSA)
  utc: string;            // ISO-8601
  release: Release;
  detector: 1 | 2 | 3 | 4 | 5 | 6;
  lambdaUm: number;       // longitud de onda en la posición del objetivo
  bandwidthUm: number;
  frameUrl: string;       // PNG ya alineado a la rejilla común
  sourceUrl: string;      // access_url de IRSA
}
export interface Candidate {
  id: string;
  kind: 'moved_source' | 'unmatched_source';
  status: 'candidate';    // nunca 'confirmed'
  track: { epochId: string; x: number; y: number; ra: number; dec: number }[];
  snr: number;
  match: { catalog: string; name: string; sepArcsec: number } | null;
  explanation: { text: string; source: 'template' | 'llm' } | null;
}
export interface FieldManifest {
  schemaVersion: '1.0';
  id: string; name: string;
  ra: number; dec: number; fovDeg: number;
  grid: { widthPx: number; heightPx: number; pixScaleArcsec: number };
  epochs: Epoch[];
  matchedPairs: [string, string][];  // épocas con longitud de onda compatible
  candidates: Candidate[];
  message: string | null;            // p. ej. 'No SPHEREx coverage at this position'
  provenance: { collection: string; retrievedUtc: string; synthetic: boolean; credit: string };
}
```

**Entregable de T0:** `web/public/data/_fixture/manifest.json` generado a mano con 4 épocas, 1 candidato y `synthetic: true`, para que el Integrante 1 trabaje sin esperar al pipeline.

### 3.3 Mapa de tareas

| ID | Dueño | Tarea | Prior. | Duración | Depende de |
| --- | --- | --- | --- | --- | --- |
| P0 | I2 | Spike de IRSA (Go/No-go) | P0 | 0:45 | — |
| T0 | I1 + I2 | Contrato + fixture | P0 | 0:30 | — |
| P1 | I2 | Búsqueda de épocas | P0 | 1:00 | P0 |
| P2 | I2 | Recortes y longitud de onda | P0 | 1:30 | P1 |
| P3 | I2 | Fotogramas + manifest + 3 campos | P0 | 2:00 | P2 |
| P4 | I2 | Detección de candidatos | P1 | 2:00 | P3 |
| P5 | I2 | Validación con objetos conocidos | P1 | 1:30 | P4 |
| P6 | I2 | API en vivo (FastAPI) | P1 | 1:30 | P3 |
| P7 | I2 | Explicaciones con IA validadas | P2 | 1:00 | P4 |
| F1 | I1 | Scaffold, estado en URL, Aladin Lite | P0 | 1:30 | T0 |
| F2 | I1 | Visor blink de épocas | P0 | 2:00 | F1, T0 |
| F3 | I1 | Candidatos y tarjeta de evidencia | P1 | 1:30 | F2 |
| F4 | I1 | Recorrido guiado, About, EN/ES | P1 | 1:30 | F2 |
| F5 | I1 | Modo en vivo | P1 | 1:00 | P6, F2 |
| F6 | I1 | Mini-espectro | P2 | 1:00 | P3 |
| C1 | I3 | Demo de 30 s | P0 | \~6:00 repartido | F2 (planos finales) |
| C2 | I4 | Mazo de 7 diapositivas + guion | P0 | \~4:00 repartido | — |
| C3 | I4 | README, fuentes, licencias, formulario | P0 | \~3:00 repartido | — |

### 3.4 Integrante 2 — datos y ciencia (Python)

#### P0 · Spike de IRSA (45 min, primero de todo)

**Files:** Create `pipeline/scripts/spike.py`, `docs/SPIKE.md`.

- [ ] **Paso 1: búsqueda.** Con `Irsa.query_sia(pos=(coord, 0.05*u.deg), collection=['spherex_dr1','spherex_qr3'])` en una posición de prueba (método del [tutorial oficial](https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/)). Anotar nº de filas y `results.colnames`.
- [ ] **Paso 2: recorte.** Descargar `access_url + '?center=RA,Dec&size=0.1'`; abrir con astropy; confirmar 6 extensiones y medir el tiempo.
- [ ] **Paso 3: CORS.** `curl -I -H 'Origin: https://example.github.io' <url SIA>` y lo mismo con un recorte; anotar si aparece `Access-Control-Allow-Origin`.
- [ ] **Paso 4: límites de tamaño.** Probar `size=0.01`, `0.5` y `1.0`; anotar errores.
- [ ] **Paso 5: fixtures.** Guardar una respuesta VOTable y un recorte pequeño en `pipeline/tests/fixtures/` para tests offline.
- [ ] **Paso 6: commit** `chore: spike IRSA + fixtures`.

**Hecho cuando:** `docs/SPIKE.md` dice **Go** (recorte < 20 s y 6 extensiones) o **No-go** (usar lectura anónima del bucket S3 `nasa-irsa-spherex` con astropy + fsspec, como en el [tutorial](https://caltech-ipac.github.io/irsa-tutorials/spherex-source-discovery-tool-demo/)). Si no hay CORS, **el navegador nunca llama a IRSA directamente**: ya es nuestro diseño (pipeline offline + API intermedia).

#### P1 · Búsqueda de épocas

**Files:** Create `pipeline/skyshift/query.py`; Test `pipeline/tests/test_query.py`.

**Interfaces:** Produces `EpochRecord(obs_id: str, collection: str, access_url: str, t_mjd: float, detector: int)` y `search_epochs(ra: float, dec: float, radius_deg: float = 0.05, collections: tuple[str, ...] = ('spherex_dr1', 'spherex_qr3')) -> list[EpochRecord]`, ordenada por `t_mjd`.

- [ ] Tests (con la VOTable guardada): `test_search_epochs_sorted_by_time`; `test_detector_parsed_from_filename` (`...1D3_spx...` → 3; el patrón `level2_[ObsID]D[Detector]_spx_l2b-...` es oficial); `test_no_coverage_returns_empty_list` (**Review Focus 1**); `test_ra_wraps_to_0_360` (`-0.01` → `359.99`, **RF5**).
- [ ] Ejecutar y ver fallar. Implementar con astroquery; mapear columnas según `SPIKE.md`. Ejecutar y ver pasar. Commit.

#### P2 · Recortes y longitud de onda

**Files:** Create `pipeline/skyshift/cutouts.py`; Test `pipeline/tests/test_cutouts.py`.

**Interfaces:** `fetch_cutout(access_url: str, ra: float, dec: float, size_deg: float = 0.1, cache_dir: Path = Path('.cache')) -> Path`; `read_cutout(path: Path) -> Cutout` (`image`, `flags`, `variance`: ndarray; `wcs`: WCS); `lambda_at(path: Path, ra: float, dec: float) -> tuple[float, float]` (λ en µm, ancho de banda en µm); `class TargetOutsideError(Exception)`.

Enfoque para λ: si astropy no interpreta WCS-WAVE, interpolar bilinealmente los 4 puntos de control más cercanos (la documentación indica \~1 nm de precisión; es para visualización). Para máscaras, elegir los bits de FLAGS de la Tabla 16 del [Explanatory Supplement](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf).

- [ ] Tests: `test_cutout_has_six_hdus`; `test_lambda_within_instrument_range` (0.75 ≤ λ ≤ 5.0); `test_target_near_edge_raises` (objetivo a ≤ 3 px del borde → `TargetOutsideError`, **RF2**); `test_masked_pixels_become_nan` (**RF2**).
- [ ] Ver fallar → implementar → ver pasar → commit.

#### P3 · Fotogramas, manifest y 3 campos reales

**Files:** Create `pipeline/skyshift/frames.py`, `manifest.py`, `fields.py`, `build.py`; Test `pipeline/tests/test_frames.py`.

**Interfaces:** `FieldSpec(id: str, name: str, ra: float, dec: float, fov_deg: float = 0.1, max_epochs: int = 10)`; `lambda_matched(a: Epoch, b: Epoch, frac: float = 0.5) -> bool` (|Δλ| ≤ frac × max(bw); **heurística propia a validar visualmente**); `build_field(spec: FieldSpec, out_dir: Path) -> FieldManifest`; CLI `python -m skyshift.build --field <id>`.

- [ ] Tests: `test_lambda_matched_true_within_tolerance`; `test_lambda_matched_false_for_different_bands` (1.0 vs 2.0 µm, **RF3**); `test_all_frames_share_one_grid`; `test_manifest_has_required_keys` (`schemaVersion == '1.0'`); `test_real_build_marks_synthetic_false`.
- [ ] Implementar: rejilla TAN común centrada en el objetivo, `reproject_interp`; estiramiento asinh con **los mismos percentiles para todas las épocas del campo** (así el estiramiento no inventa cambios); PNG RGBA con alfa 0 en píxeles enmascarados.
- [ ] Hornear **3 campos** (decisión): **HERO-MOVER** (objeto móvil conocido elegido con P5), **HERO-PM** (la estrella de mayor movimiento propio con ≥ 3 épocas de λ compatible, probando Barnard's Star, WISE 0855−0714 y Epsilon Indi B \[Terceros: lista usada por otros equipos\]) y **CONTROL** (campo estático con ≥ 6 épocas, p. ej. M101 en RA 210.80227, Dec +54.34895 \[Terceros\] si el spike muestra cobertura DR1/QR3). Posiciones por nombre con `SkyCoord.from_name` o SIMBAD.
- [ ] Commit `feat: build_field + 3 campos reales`.

**Hecho cuando:** existe `web/public/data/<campo>/manifest.json` real para al menos 1 campo, con ≥ 3 épocas y `matchedPairs` no vacío. **Este es el hito M2: avisar al Integrante 1 de inmediato.**

#### P4 · Detección de candidatos (P1)

**Files:** Create `pipeline/skyshift/detect.py`; Test `pipeline/tests/test_detect.py`.

**Interfaces:** `detect_candidates(stack: FrameStack, matched_pairs: list[tuple[str, str]], nsigma: float = 5.0, match_radius_px: float = 1.5, max_shift_px: float = 8.0) -> list[Candidate]`. Usa `photutils` DAOStarFinder y `scipy.spatial.cKDTree`. Solo compara **pares λ-compatibles**.

- [ ] Tests (arrays sintéticos solo en tests, nunca en la UI): `test_injected_mover_is_recovered` (gaussiana inyectada con desplazamiento de 4 px → 1 candidato `moved_source`, error < 0.5 px); `test_static_field_yields_no_candidates` (semilla fija); `test_flagged_pixels_never_produce_candidates` (**RF2**); `test_mismatched_lambda_pairs_are_skipped` (**RF3**).
- [ ] Implementar y ajustar umbrales **solo con el campo CONTROL**; meta propia: ≤ 3 candidatos espurios por campo con `nsigma = 5`. Commit.

#### P5 · Validación con objetos conocidos (P1)

**Files:** Create `pipeline/skyshift/validate.py`; Test `pipeline/tests/test_validate.py`.

**Interfaces:** `match_known(c: Candidate, epoch: Epoch, tol_arcsec: float = 30.0) -> dict | None` devolviendo `{catalog, name, sepArcsec}`.

- [ ] **Spike de 20 min:** leer [sb\_ident](https://ssd-api.jpl.nasa.gov/doc/sb_ident.html) para ver cómo declarar el observador. Si no admite una nave en órbita, usar posición geocéntrica con tolerancia de 30″ \[Mi criterio: la paralaje de una órbita baja es pequeña para objetos del cinturón, pero no para asteroides cercanos\].
- [ ] Tests con respuestas JSON grabadas: `test_known_asteroid_matched_within_tolerance`; `test_no_match_returns_none`; `test_network_error_returns_none_and_does_not_raise` (**RF4**).
- [ ] Usar P5 para **elegir HERO-MOVER**: una exposición donde SBIdent prediga un objeto brillante dentro del campo. Si no hay ninguno utilizable a las 14:00 del domingo, ver plan B (3.8).

#### P6 · API en vivo (P1)

**Files:** Create `api/main.py`; Test `api/tests/test_api.py`.

**Interfaces:** `GET /api/health -> {irsa: 'up' | 'down', checkedUtc: str}`; `GET /api/field?ra=&dec=&fov=0.1&max_epochs=8 -> FieldManifest`.

- [ ] Tests: `test_field_no_coverage_returns_200_with_message` (**RF1**); `test_ra_out_of_range_is_normalized` (**RF5**); `test_health_down_does_not_500` (**RF4**); `test_field_timeout_returns_504_with_fallback_fields` (**RF4**).
- [ ] Implementar con caché en disco por (ra, dec) redondeados a 1e-3; CORS solo para el origen de GitHub Pages; despliegue en Render. Commit.

#### P7 · Explicaciones con IA validadas (P2)

**Files:** Create `pipeline/skyshift/report.py`; Test `pipeline/tests/test_report.py`.

**Interfaces:** `facts_for(c: Candidate, m: FieldManifest) -> dict`; `explain_template(facts: dict, lang: Literal['en', 'es']) -> str`; `explain_llm(facts: dict, lang: Literal['en', 'es']) -> str` (OpenRouter; el id del modelo va en `config.toml` y se elige al momento en [openrouter.ai/models](https://openrouter.ai/models) \[Por verificar disponibilidad\]); `assert_numbers_grounded(text: str, facts: dict) -> None` lanza `UngroundedNumberError`.

- [ ] Tests: `test_numbers_in_text_all_present_in_facts`; `test_invented_number_is_rejected`; `test_llm_failure_falls_back_to_template`.
- [ ] Instrucción de sistema: solo usar los datos del JSON; no calcular, estimar ni añadir cifras; decir candidato y nunca descubrimiento; si falta un dato, decirlo.
- [ ] Ejecutar **offline** durante `build` y guardar en `candidates.json`. La clave va en la variable de entorno `OPENROUTER_API_KEY`: jamás en el repo ni en el navegador. Commit.

### 3.5 Integrante 1 — aplicación web (TypeScript)

#### F1 · Scaffold, estado en URL y mapa

**Files:** Create `web/package.json`, `web/vite.config.ts`, `web/src/types.ts`, `state.ts`, `sky.ts`, `main.ts`; Test `web/src/state.test.ts`.

**Interfaces:** `parseCoords(input: string): { ra: number; dec: number } | null` (acepta `210.80 54.35` y `13h 03m 31s +54d 20m 56s`); `parseView(search: string): View`; `formatView(v: View): string`; `mountSky(el: HTMLElement, view: View, onPick: (ra: number, dec: number) => void): SkyHandle`.

- [ ] Tests: `test_parse_decimal`; `test_parse_sexagesimal`; `test_ra_wraps_to_0_360`; `test_invalid_returns_null`; `test_view_url_roundtrip` (**RF5**).
- [ ] Crear el proyecto con Vite (plantilla `vanilla-ts`), **fijar la versión de Aladin Lite** hallada en V5 y montar el mapa con un HiPS de contexto verificado. Commit.

**Hecho cuando:** el mapa se ve, pegar coordenadas lo centra y recargar mantiene la vista.

#### F2 · Visor blink de épocas

**Files:** Create `web/src/blink.ts`, `epochs.ts`; Test `web/src/blink.test.ts`.

**Interfaces:** Consumes `FieldManifest`, `Epoch`. Produces `class BlinkViewer { constructor(canvas: HTMLCanvasElement, m: FieldManifest); setEpoch(i: number): void; play(fps: number): void; pause(): void; compare(a: number, b: number, split: number): void }`; `lambdaBadge(a: Epoch, b: Epoch, m: FieldManifest): 'matched' | 'mismatch'`; `sortedEpochs(m: FieldManifest): Epoch[]`.

- [ ] Tests: `test_epochs_sorted_by_utc`; `test_lambda_badge_matched_pair`; `test_lambda_badge_mismatch_pair` (**RF3**).
- [ ] UI: línea de tiempo con un punto por época (color por liberación DR1/QR3), chip con fecha UTC, λ y detector, botón blink, deslizador de comparación, teclas ←/→, `image-rendering: pixelated`. Si el par es `mismatch`, el chip dice: «Different wavelength — brightness differences may not be real change».
- [ ] Si `provenance.synthetic` es `true`, mostrar el banner rojo «SYNTHETIC TEST DATA — not SPHEREx». Commit.

**Hecho cuando:** con el fixture, y luego con el campo real de P3, se puede reproducir, pausar y comparar; se ve bien en pantalla de 390 px.

#### F3 · Candidatos y tarjeta de evidencia (P1)

**Files:** Create `web/src/candidates.ts`; Test `web/src/candidates.test.ts`.

**Interfaces:** `candidateLabel(c: Candidate, lang: 'en' | 'es'): string` → «Candidate · unvalidated» o «Candidate · matches known object: \<nombre>».

- [ ] Test: `test_label_never_says_discovery` (recorre todos los tipos e idiomas; regex `/discover|descubr/i` no debe coincidir). Dibujar marcadores y la trayectoria sobre el canvas; tarjeta con S/N, coincidencia, explicación y panel fijo «What this is NOT: a confirmed discovery, a Planet X detection». Commit.

#### F4 · Recorrido guiado, About e idioma (P1)

**Files:** Create `web/src/tour.ts`, `i18n.ts`, `web/about.html`; Test `web/src/i18n.test.ts`.

- [ ] Test `test_all_keys_exist_in_both_languages`. Recorrido de 3 pasos por campo HERO (qué mirar, qué se mueve, qué significa). Página About con créditos, licencias y la lista de fuentes. EN por defecto, ES con un interruptor. Commit.

#### F5 · Modo en vivo (P1)

**Files:** Create `web/src/live.ts`; Test `web/src/live.test.ts`.

**Interfaces:** `fetchField(ra: number, dec: number, fov: number): Promise<FieldManifest | FieldError>`.

- [ ] Tests: `test_empty_epochs_shows_message` (**RF1**); `test_api_down_falls_back_to_curated_fields` (**RF4**). Estados: cargando (mensaje «Waking up the server, up to 60 s»), sin cobertura, error. Commit.

#### F6 · Mini-espectro (P2, solo si sobra tiempo)

Por defecto: **enlace** a la herramienta de espectrofotometría de IRSA desde la tarjeta del candidato. Solo si sobran 2 h, graficar λ vs. flujo en el objetivo con uPlot, etiquetado «preliminary».

### 3.6 Integrante 3 — demo de 30 s

- [ ] **H0:30** Leer la sección 5, fijar la lista de planos y elegir herramienta de edición (CapCut, DaVinci o Canva). Elegir música CC0 o con licencia comprobada y anotar la licencia en `docs/SOURCES.md`.
- [ ] **H+4:45 (M2)** Ensayar la captura con la UI real o el fixture. **Los planos de ensayo no se publican.**
- [ ] **Domingo 15:00–17:30** Grabar planos finales a 1080p con datos reales. Subtítulos incrustados. Créditos: «SPHEREx data: NASA/JPL-Caltech/IPAC» al final.
- [ ] Exportar MP4 y verificar con `ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4` que la duración sea **menor de 30.0**.
- [ ] Subir también como enlace no listado (V3 dirá si el formulario pide archivo o enlace).

**Hecho cuando:** dura ≤ 29.5 s, el texto se lee en móvil, **no hay caras ni voces de menores de 18**, la música tiene licencia, el crédito se ve ≥ 2 s y cada frase del guion corresponde a algo que la app hace de verdad.

### 3.7 Integrante 4 — presentación, documentación y entrega

- [ ] **H0:00** Ejecutar V1, V3 y V6. Crear el repo, `LICENSE`, `README.md` esqueleto, `docs/SOURCES.md` (con las fuentes de la sección 0), `docs/AI-USE.md` y `CREDITS.md`.
- [ ] **H+1:15** Esqueleto del mazo de 7 diapositivas en Canva o PowerPoint (sección 6), **textos de las diapositivas en inglés** y guion del presentador en español.
- [ ] **H+7:00 y domingo** Probar la web desplegada en móvil, en ventana de incógnito y con la red lenta; registrar errores en issues con prioridad.
- [ ] **Domingo 19:20** Completar el borrador del formulario de entrega (sección 8).

### 3.8 Versión mínima funcional, opcionales y plan B

**MVP (P0):** P0, T0, P1, P2, P3, F1, F2, C1, C2, C3 → web pública con **3 campos reales**, visor blink, insignia de longitud de onda, créditos y demo.

**P1:** P4, P5, P6, F3, F4, F5. **P2:** P7, F6, HiPS de DR1 como fondo.

| Si ocurre... | Entonces |
| --- | --- |
| El spike da No-go para los recortes | Leer el bucket S3 anónimo; si también falla, bajar imágenes completas de un solo campo y recortar localmente |
| No hay objeto móvil conocido utilizable | HERO-MOVER = la estrella de movimiento propio; el demo usa «cambio lento» y el control estático |
| P4 produce demasiados falsos candidatos | Mostrar solo el seguimiento manual del objeto conocido (par de coordenadas fijo) y marcar P4 como «experimental» |
| Render no despierta a tiempo | Desactivar el modo en vivo en la versión entregada; se mantienen los 3 campos precalculados |
| La IA no funciona a la primera | Usar `explain_template`; la IA no aparece en el demo |

---

## 4. Cronograma

**Supuestos \[Mi criterio\]:** no conozco la hora exacta en que empiezan hoy. Los bloques del sábado son **relativos a H0 (el momento en que arrancan)** y asumen unas 8 horas de trabajo. Si tienen menos, recorten P1 del sábado y muévanlo al domingo por la mañana. Los horarios del domingo son fijos (hora de RD).

### 4.1 Sábado 14 de noviembre

| Bloque | Integrante 1 | Integrante 2 | Integrante 3 | Integrante 4 |
| --- | --- | --- | --- | --- |
| H0:00–0:45 | V5 (Aladin, HiPS) | **P0 spike** | V2 (evento local) | V1, V3, V6; crear repo y licencia |
| H0:45–1:15 | **T0** contrato + fixture | **T0** | Lista de planos | `SOURCES.md` inicial |
| H1:15–2:45 | F1 | P1 → P2 | Música y plantilla de edición | Esqueleto del mazo + README |
| H2:45–4:45 | F2 | P2 → **P3 (1.er campo real)** | Guion final de narración | Guion del presentador (borrador) |
| **H4:45 = M2** | **Esqueleto andante: 1 campo real visible en la web (local)** |  |  |  |
| H4:45–7:00 | F2 final + F3 con fixture | P3 (2 campos más) → P4 | Ensayo de captura | Mazo completo (borrador) |
| H7:00–8:00 | Despliegue en GitHub Pages | Subir los 3 campos | Revisar planos | QA móvil + incógnito |
| **H8:00 = M3** | **Tag `v0.1` desplegado con ≥ 1 campo real, mazo y storyboard listos** |  |  |  |

### 4.2 Domingo 15 de noviembre (hora de RD)

| Hora | Hito / actividad |
| --- | --- |
| 08:00–08:30 | Reunión corta: qué quedó del sábado, qué se corta |
| 08:30–12:00 | I1: F3, F4. I2: P4 → P5, P6. I3: afinar guion. I4: mazo final |
| **12:00 · M4** | **Congelación de funcionalidades.** Lo que no esté terminado se corta (reglas de 3.8) |
| 12:00–15:00 | Integración y pruebas (I1 + I2). I2: P7 si hay tiempo. I4: QA en móvil, incógnito y red lenta |
| **15:00 · M5** | **URL pública estable + repo público + README completo** |
| 15:00–17:30 | Solo errores críticos. I3 graba los planos finales con datos reales |
| **17:30 · M6** | **Congelación de código.** Solo textos y créditos |
| 17:30–19:00 | I3 edita y exporta. I4 ensaya el mazo (1.er ensayo) |
| **19:00 · M7** | **Video v1 verificado (< 30.0 s)**; revisión del equipo, 20 min |
| 19:20–20:30 | 2 ensayos cronometrados de la presentación; formulario completo en borrador |
| **20:30–21:30 · M8** | **Entrega: subir video, enlaces, mazo y fuentes → Submit for Judging.** Meta: enviado a las 21:30, 2 h 29 min antes del límite |
| 21:30–23:00 | Verificar la página del proyecto desde incógnito. **Sin cambios de código** |
| **23:59** | Límite duro |

> El enunciado dice 11:59 p. m. **hora local**; confirmen en la plataforma que su evento muestra el mismo huso horario (V2). Si el formulario permite editar tras enviar, ese dato también aparece en V3 y no se debe asumir.

---

## 5. Demo de 30 segundos (en inglés)

**Reglas de producción:** duración final ≤ 29.5 s · 1080p 16:9 · textos en pantalla de gran tamaño (legibles en móvil) · crédito NASA visible ≥ 2 s · música sin derechos reservados · **si algún integrante es menor de 18, no aparece su cara ni su voz**: usar la versión silenciosa con subtítulos (abajo).

**Campo HERO:** el que se elija en P3/P5. Cada frase del guion debe corresponder a algo que la app hace de verdad el domingo a las 15:00; si algo no existe, se usa la variante B.

### 5.1 Guion segundo a segundo

| Tiempo | Qué se ve | Texto en pantalla | Narración |
| --- | --- | --- | --- |
| 0–3 s | Mapa de cielo completo en Aladin Lite, oscuro, zoom lento. Sin interfaz | THE SKY IS NEVER THE SAME TWICE | The sky is never the same twice. |
| 3–7 s | El zoom llega al campo HERO; aparecen seis chips de banda de 0.75 a 5 µm | SPHEREx · 102 infrared colors · the whole sky, again and again | NASA's SPHEREx maps the whole sky in 102 infrared colors, again and again. |
| 7–12 s | La app: línea de tiempo con puntos de épocas (DR1 y QR3); el cursor elige una fecha | Real SPHEREx data · DR1 + QR3 | We turn that archive into a time machine anyone can use. |
| 12–20 s | Blink entre dos épocas de longitud de onda compatible del campo HERO: estrellas quietas, una fuente se desplaza; aparecen el círculo y la trayectoria | Stars stay still. Movers stand out. | Flip through the dates. Stars stay put. Things that move stand out. |
| 20–25 s | Tarjeta del candidato con la insignia «Wavelength matched» y la línea «Matches known object: \<nombre>» o «Candidate · unvalidated» | Candidate — not a discovery | Every candidate is checked against known objects, and labeled honestly. |
| 25–30 s | Tarjeta final con nombre, URL, «Open source · Apache-2.0» y créditos | SkyShift · \<URL> · SPHEREx data: NASA/JPL-Caltech/IPAC | Real data. Open source. Explore the changing sky. |

≈ 62 palabras de narración (≈ 2.1 palabras/s). Si la voz suena apurada, quitar «again and again» del segundo bloque.

### 5.2 Variante B (si los candidatos no se terminan)

Sustituir los segundos 20–25 por: planos de dos épocas con la insignia de longitud de onda. Texto: **Only matching wavelengths are compared**. Narración: *Only matching wavelengths are compared, so color isn't mistaken for change.* Y quitar «Candidate — not a discovery».

### 5.3 Versión silenciosa

Mismos tiempos, sin narración. Los textos en pantalla pasan a ser los subtítulos de la columna «Narración». Música baja y constante.

### 5.4 Qué debe mostrar la app para comunicar el valor en 30 s

1. Datos reales de SPHEREx identificables (DR1/QR3, fecha UTC, longitud de onda en el chip).
2. Un cambio visible en menos de 10 s de interacción (blink o deslizador).
3. La insignia de longitud de onda y la etiqueta «candidate».
4. La URL pública y el crédito a NASA.

### 5.5 Prohibido en el demo

«Discovery», «Planet X found», imágenes de archivo o ilustraciones presentadas como datos, datos con banner SYNTHETIC, cualquier cifra que el código no calcule.

---

## 6. Presentación de 5 minutos (7 diapositivas)

**Formato:** exactamente **7 diapositivas** (portada incluida) para cumplir el límite oficial. **Texto en pantalla en inglés** (por si se sube como demo para Global Judging); **guion del presentador en español**, salvo que V2/V3 indiquen otra cosa. Exportar a PDF. Si algún integrante es menor de 18, la portada usa solo el nombre del equipo y no incluye fotos ni nombres personales.

Los campos entre llaves, como {N\_CONTROL}, se rellenan con el valor medido el domingo. **Si no se midió, borrar esa frase.** Nunca inventar la cifra.

### Diapositiva 1 · 0:00–0:30 · «SkyShift — See how the infrared sky changes»

**Visual:** captura del blink del campo HERO a pantalla completa, título encima, logo de Space Apps solo si las normas de marca lo permiten (V3).

**Guion:** Buenas. El cielo no es una foto fija: cambia. La misión SPHEREx de NASA lo mapea completo en infrarrojo, una y otra vez. Nosotros construimos SkyShift, una herramienta web pública para que cualquier persona vea esos cambios sin ser astrónoma ni astrónomo. Es nuestro proyecto para el desafío Planet X and SPHEREx.

### Diapositiva 2 · 0:30–1:15 · «The sky changes — the data is hard to see»

**Contenido:** 102 canales, 0.75–5.0 µm · cielo completo 4 veces en 25 meses · 1 archivo = 2040×2040 px por detector, \~70 MB. **Visual:** comparar el tamaño de un FITS completo con el recorte que usamos (\~58×58 px).

**Guion:** SPHEREx observa el cielo en 102 colores infrarrojos, entre 0,75 y 5 micrómetros, y cubre el cielo completo cuatro veces en 25 meses. Los datos reales están en el archivo de IRSA, pero cada imagen es un archivo FITS de unos 70 megabytes de un solo detector, y cada punto del cielo cae a una longitud de onda distinta en cada exposición. Para el público general, eso es una pared. El desafío pide justo lo contrario: una herramienta pública que permita ver rápido cómo cambian las imágenes.

### Diapositiva 3 · 1:15–2:30 · «Pick a place. Flip through time.» (demostración en vivo)

**Visual:** la app abierta. Plan B: video de pantalla de 60 s ya grabado.

**Pasos del presentador:** (1) abrir la URL pública; (2) elegir el campo HERO; (3) reproducir el blink; (4) señalar la insignia de longitud de onda; (5) abrir la tarjeta del candidato; (6) copiar el enlace compartible.

**Guion:** Voy a mostrarles la herramienta con datos reales. Elijo un campo del cielo: {HERO\_NOMBRE}. Aquí está la línea de tiempo: cada punto es una observación de SPHEREx, de las liberaciones DR1 y QR3. Al pasar de una fecha a otra, las estrellas se quedan quietas y esta fuente se mueve. Fíjense en la insignia: solo comparamos imágenes con longitud de onda compatible, para no confundir un cambio de color con un cambio en el cielo. Y aquí está el candidato, con su evidencia: {LECTURA\_TARJETA}. Todo se puede compartir con un enlace.

### Diapositiva 4 · 2:30–3:15 · «How it works»

**Visual:** diagrama de una línea: IRSA SIA2 → recortes → rejilla común → pares de misma longitud de onda → candidatos → objetos conocidos → web. Debajo, logotipos/nombres del software reutilizado.

**Guion:** Por dentro, consultamos el archivo oficial de IRSA con el protocolo estándar SIA2, pedimos recortes pequeños en lugar de imágenes completas, los alineamos en una misma rejilla, comparamos solo pares con la misma longitud de onda y detectamos fuentes con photutils. Cada candidato se contrasta con objetos conocidos, como los asteroides de la base de datos del JPL. El mapa usa Aladin Lite. Casi todo es software abierto que ya existía; nuestro aporte es unirlo de forma comprensible y honesta.

### Diapositiva 5 · 3:15–4:00 · «Honest science»

**Contenido:** datos reales DR1 + QR3 · longitudes de onda emparejadas · campo de control: {N\_CONTROL} candidatos · objeto conocido recuperado: {RESULTADO\_CONOCIDO} · «Planet X is our motivation, not a result».

**Guion:** Aquí está la parte de validez. Primero, usamos solo datos reales de DR1 y QR3. Segundo, igualamos la longitud de onda antes de comparar. Tercero, probamos en un campo de control estático: {N\_CONTROL} candidatos. Cuarto, {RESULTADO\_CONOCIDO}. Y algo importante: Planet X es nuestra motivación, no un resultado. Una búsqueda con datos de WISE ya descartó Planet Nine en el espacio de parámetros que exploró, así que no afirmamos detectarlo. Marcamos candidatos, nunca descubrimientos.

*Fuente de la frase sobre WISE: [Meisner et al.](https://portal.nersc.gov/project/cosmo/temp/ameisner/p9/ms.pdf) \[Terceros\]. Citarla en el pie de la diapositiva.*

### Diapositiva 6 · 4:00–4:40 · «Who it's for, and what makes it different»

**Contenido:** estudiantes, docentes, aficionados, ciencia ciudadana · recorridos guiados · EN/ES · enlaces compartibles · código abierto Apache-2.0 · fuentes citadas.

**Guion:** ¿Para quién es? Para estudiantes, docentes, aficionados y científicos ciudadanos: no necesitan instalar nada ni saber leer FITS. Tiene recorridos guiados, está en español e inglés, y cada vista tiene un enlace compartible. Es código abierto con licencia Apache 2.0 y todas las fuentes citadas. {SOLO\_SI\_P7: Además, las explicaciones en lenguaje sencillo se generan únicamente a partir de datos calculados, y un validador rechaza cualquier cifra que no esté en esos datos.}

### Diapositiva 7 · 4:40–5:00 · «Credits and next steps»

**Contenido:** URL y repositorio · «SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive» · «Not affiliated with or endorsed by NASA» \[Mi criterio\] · próximos pasos: más campos, búsqueda en todo el cielo con el cubo de DR1, más validación.

**Guion:** Para terminar, los próximos pasos son más campos, búsqueda sobre todo el cielo con el cubo de DR1 y más validación. Los datos son de SPHEREx, NASA/JPL-Caltech/IPAC, vía el archivo IRSA, y todas las fuentes y licencias están en el repositorio. Gracias. Pueden probar SkyShift ahora mismo en la dirección que ven en pantalla.

### Ensayo

- Cronometrar dos veces el domingo (19:20–20:30). El guion tiene \~570 palabras y deja \~40 s para las acciones de la demo. Si pasa de 5:00, recortar primero la diapositiva 4, luego la 6.
- Presentan dos personas: una la parte 1–2 y 5–7, otra la demostración (3–4). Sin leer la pantalla.
- Tener abierto el video de respaldo y una captura de cada pantalla por si cae internet.

---

## 7. Estrategia de evaluación

### 7.1 Qué está publicado y qué es recomendación

- **Publicado \[Verificado\]:** los cinco criterios (Impact, Creativity, Validity, Relevance, Presentation) y los límites de demo. Las definiciones de cada criterio las leí en un resumen de terceros: Impact = potencial para beneficiar a personas, ciencia o sociedad; Creativity = originalidad del enfoque; Validity = credibilidad científica o técnica y viabilidad; Relevance = qué tan bien responde al desafío elegido; Presentation = claridad al comunicar. \[Terceros: [resumen de la guía](https://mindshipglobal.com/opportunities/nasa-space-apps-challenge-2026/)\]. **Confirmar la redacción en la Judging and Awards Guide 2026 (V3).**
- **No encontré** pesos, fórmula de puntaje ni rúbrica numérica. **No los asumimos.**
- Todo lo demás de esta sección es **\[Mi criterio\]**.

### 7.2 Qué demostrar y con qué evidencia

| Criterio | Qué debemos demostrar | Evidencia concreta en la entrega |
| --- | --- | --- |
| **Relevance** | Respondemos al desafío, no a otro | Abrir la presentación con la frase del desafío; cada diapositiva refuerza «web pública + imágenes SPHEREx + cambio en el tiempo»; lo que no ayuda a eso (3D propio, RAG) no aparece |
| **Validity** | Los datos son reales y las conclusiones son prudentes | Chip con liberación/fecha/λ; insignia λ-matched; campo de control; objeto conocido recuperado; «Planet X es motivación»; tests en verde; `SOURCES.md` completo |
| **Impact** | Una persona sin formación puede usarla | Recorrido guiado de 3 pasos, interfaz EN/ES, enlaces compartibles, móvil, código abierto |
| **Creativity** | Un enfoque propio, no solo un blink | Honestidad científica visible (insignia + control), casos guiados, explicaciones con IA que no pueden inventar cifras (si P7 se termina) |
| **Presentation** | Se entiende rápido y funciona en vivo | Demo de 30 s claro, 7 diapositivas, URL estable, copia de respaldo en video |

### 7.3 Cómo maximizar la puntuación

1. **Una demo real vale más que tres funciones a medias.** Priorizar P0 y dejar P1 solo si no pone en riesgo la estabilidad.
2. **Mostrar la herramienta funcionando en los primeros 10 s** del video y en la diapositiva 3.
3. **Decir lo que no hacemos** (no detectamos Planet X; candidatos no validados). Es lo que más sube Validity.
4. **No añadir IA para impresionar.** Un blog de la comunidad lo recomienda así \[Terceros\]; aquí la IA solo explica.
5. **Citar todo.** Los términos permiten retirar la entrega o los premios si faltan fuentes \[Verificado\].
6. **Probar en móvil y en incógnito** antes de enviar: es lo que usará un juez.

---

## 8. Entrega final

### 8.1 Checklist de funcionamiento (domingo, antes de las 17:30)

- [ ] La URL pública abre en Chrome y Firefox, en móvil (390 px) y en ventana de incógnito, sin iniciar sesión.
- [ ] Los 3 campos cargan con datos **reales**; no aparece ningún banner SYNTHETIC en producción; `scripts/check_no_synthetic.py` pasa.
- [ ] Blink, deslizador, línea de tiempo e insignia de longitud de onda funcionan.
- [ ] Una coordenada sin cobertura muestra un mensaje claro (RF1). Coordenadas mal escritas no rompen la página (RF5).
- [ ] Si el modo en vivo está activo: `/api/health` responde y la app se degrada a los campos precalculados cuando falla.
- [ ] Ninguna etiqueta dice «discovery» o «descubrimiento».
- [ ] `pytest` y `vitest` pasan (anotar el número de tests para mencionarlo).

### 8.2 Repositorio y documentación

- [ ] Repo **público**; `LICENSE` (Apache-2.0 o GPL-3.0, según 2.3); tag `v1.0`.
- [ ] `README.md`: qué es, qué problema resuelve, URL en vivo, cómo ejecutar el pipeline y la web, qué datos usa, **límites científicos** y uso de IA.
- [ ] `docs/SOURCES.md`: cada dato, librería, servicio, fuente tipográfica, música y modelo de IA, con **su licencia leída en la fuente original** (no de memoria) y enlace.
- [ ] `docs/ARCHITECTURE.md`, `docs/SPIKE.md`, `docs/AI-USE.md`.
- [ ] Búsqueda de secretos: `git grep -iE 'api[_-]?key|secret|token'` sin coincidencias; `.env` fuera del repo.

### 8.3 Fuentes y créditos a incluir (lista mínima)

- Datos: SPHEREx, NASA/JPL-Caltech/IPAC, vía NASA/IPAC Infrared Science Archive; citar los DOI de DR1 y QR3 que figuren en IRSA.
- Software: Aladin Lite (CDS, GPL-3.0), astropy, astroquery, pyvo, reproject, photutils, scipy, Vite, FastAPI, uPlot si se usa.
- Servicios: IRSA (SIA2/TAP/Cutout), JPL SBIdent/Horizons, SIMBAD/Gaia si se usan, OpenRouter y el modelo concreto si P7 se entrega.
- Texto: «Not affiliated with or endorsed by NASA» \[Mi criterio\].

### 8.3b Reglas de la plataforma que no se pueden olvidar

- [ ] Sin información personal (fechas de nacimiento, direcciones, teléfonos).
- [ ] **Sin nombres, voces ni imágenes reconocibles de menores de 18 años** en el video ni en el mazo.
- [ ] El video es trabajo original; música e imágenes con licencia.
- [ ] Ni materiales comerciales ni publicidad de productos o servicios en la entrega.
- [ ] Ninguna parte del código copiada de otro equipo.

### 8.4 Video y presentación

- [ ] `demo.mp4` < 30.0 s verificado con `ffprobe`; copia en enlace no listado.
- [ ] Mazo de **7 diapositivas** exportado a PDF; copia en la nube.
- [ ] Dos copias de seguridad de ambos archivos en lugares distintos.

### 8.5 Envío en la plataforma oficial (meta: 21:30; límite 23:59)

1. Iniciar sesión → página del equipo → pestaña **Project**.
2. Completar **todas** las secciones obligatorias (si falta alguna, el botón no deja enviar): título, resumen, desafío elegido, enlaces (demo, repo), video o mazo, referencias.
3. Pegar el enlace al repositorio y la URL en vivo; adjuntar el video o el mazo según lo que indique V3.
4. Pulsar **Submit for Judging**.
5. Captura de pantalla de la confirmación.
6. Abrir la página del proyecto en incógnito y comprobar que los enlaces, el video y el mazo se ven.
7. **No cambiar código después de las 21:30.** Solo corregir textos si la plataforma lo permite (V3).

---

## 9. Autorevisión del plan (contra el brief)

| Entregable pedido | Dónde está |
| --- | --- |
| 1. Evaluación de la propuesta | Sección 1 |
| 2. Arquitectura mínima viable | Sección 2 |
| 3. Plan de desarrollo por integrante, con dependencias, duraciones, prioridades y criterio de terminado | Sección 3 (mapa 3.3 y tareas 3.4–3.7), MVP y plan B en 3.8 |
| 4. Cronograma con hitos, horas límite y periodo de integración | Sección 4 (M2–M8; integración 12:00–15:00) |
| 5. Demo de 30 s, guion completo en inglés | Sección 5 |
| 6. Presentación de 5 min con guion | Sección 6 |
| 7. Estrategia de evaluación (publicado vs recomendación) | Sección 7 |
| 8. Entrega final | Sección 8 |

**Comprobaciones hechas:** los nombres de funciones y tipos coinciden entre tareas (`EpochRecord`, `Epoch`, `FieldManifest`, `lambda_matched`, `lambdaBadge`, `detect_candidates`); los 5 casos de Review Focus tienen un test asignado; el plan es más corto que un volcado de código (solo firmas, tests y valores).

**Lo que este plan no pudo verificar y está marcado arriba:** el texto completo del desafío y sus «considerations» (V1), la política de IA de Space Apps (V3), CORS y límites reales de IRSA (P0), la URL pública del HiPS de DR1 (V5), la hora y el huso del cierre en su evento (V2) y si el formulario acepta archivo o enlace de video (V3). Ninguna de estas dudas bloquea el inicio: cada una tiene dueño y hora.
