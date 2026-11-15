# IRSA / SPHEREx SIA2 & Cutout Spike Report (P0)

**Date**: 2026-11-15  
**Project**: SphereX Viewer and Data Visualizer (SVDV)  
**Status**: **Go** (with backend proxy and local curated cache fallback)

---

## 1. SIA2 Query Behavior
- **SIA2 Endpoint**: `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1,spherex_qr3&POS=circle+RA+DEC+RADIUS`
- **Output format**: IVOA VOTable XML (`application/x-votable+xml`).
- **Collections evaluated**:
  - `spherex_dr1`: Surveys 1 & 2 (calibrated, 102 spectral channels, detectors 1-6).
  - `spherex_qr3`: Quick Release 3 (Surveys 3 & 4).
  - `spherex_qr2`: Deprecated/unsearchable per IRSA guidelines.
- **Latency / Performance**: SIA2 responses can range between 2s and >15s under IRSA peak load.

---

## 2. Cutout Service & FITS Extension Structure
- **Cutout URL format**: `<access_url>?center=<RA>,<Dec>&size=<size_deg>`
- **Nominal Cutout Size**: `0.1` degrees (yielding ~58x58 to 60x60 detector pixels at 6.2"/px).
- **Extension Layout (6 HDUs)**:
  1. `IMAGE`: Science flux array (electrons/s or MJy/sr).
  2. `FLAGS`: 16-bit bad-pixel mask (cosmic rays, dead pixels, saturation).
  3. `VARIANCE`: Statistical variance per pixel.
  4. `ZODI`: Zodiacal light foreground estimate.
  5. `EPSF`: Effective Point Spread Function kernel.
  6. `WCS-WAVE`: Spectral coordinates mapping detector pixel $(x, y)$ to central wavelength $\lambda$ and bandwidth $\Delta\lambda$.

---

## 3. CORS & Browser Security Findings
- IRSA SIA2 endpoints do not return `Access-Control-Allow-Origin: *` for arbitrary origin requests from browser web applications.
- **Architectural Mitigation**: The browser frontend strictly communicates with the local/Render FastAPI backend (`/api/v1/field`), which proxies, caches, reprojects, and validates IRSA data. The browser never calls IRSA directly.

---

## 4. Edge Cases & Resilience Strategy (Review Focus 1 & 4)
- **Review Focus 1 (No coverage)**: When IRSA returns 0 rows for a sky location, return HTTP 200 with `epochs: []` and an informative telemetry message, preventing any frontend crash.
- **Review Focus 4 (IRSA latency / timeout)**: When IRSA query exceeds 15s or raises network timeout, gracefully degrade to curated high-fidelity fields (M101 Control Field, Barnard's Star, WISE 0855) with `source: 'cache'` / fallback notice.
