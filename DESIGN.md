# DESIGN.md: SphereX Viewer and Data Visualizer (SVDV / SkyShift)

## 1. Design Read & Liveliness Dials (`antislop` Part 3 & R-37)

> **Design Read**: Reading this as: Interactive 3D/WebGL2 Celestial Viewer & Scientific Telemetry HUD for observational astronomers, citizen scientists, and NASA Space Apps evaluators, in a precision space-observatory HUD style, dial `ENERGY 2 / RHYTHM 2 / MOTION 1`.

| Dial | Value | Specification & Enforcement |
|------|-------|-----------------------------|
| **ENERGY** | `2 (Balanced)` | Full-viewport (`100vw x 100vh`) interactive 3D/WebGL2 celestial sphere with infrared survey color bands, ICRS coordinate grid, and luminous target reticles, balanced by disciplined dark-adapted telemetry panels. |
| **RHYTHM** | `2 (Consistent with purposeful breaks)` | The 3D sky canvas is the continuous full-bleed spatial environment; floating HUD overlays vary purposefully by function (compact horizontal Top Navigation HUD Bar, vertical collapsible Right Scientific Inspector Dock with hairline dividers, and compact Bottom-Left Telemetry/Credit Pill). |
| **MOTION** | `1 (Hover & direct manipulation only)` | Zero decorative looping animations or floating cards. Motion occurs strictly on user interaction: dragging/rotating the 3D celestial sphere, scrubbing or playing the 2D Blink Comparator (`Play/Pause` control provided per R-39), and immediate hover/focus states (`prefers-reduced-motion: reduce` respected). |

---

## 2. Core Color Palette & WCAG AA Contrast Audit (R-01, R-21, R-25, R-29)

SVDV uses a disciplined 3-core + 1-accent dark-adapted observatory palette (plus semantic emerald for wavelength safety):

| Token | Hex | Role | WCAG 2.x Contrast Verification (R-25) | One-Line Reason (R-31) |
|-------|-----|------|---------------------------------------|------------------------|
| `obsidian` | `#0A0D14` | Deep Space Viewport & Input Well Background | Base surface (`L = 0.0065`) | Preserves dark-adapted contrast so faint infrared stars and 60x60 satellite cutout pixels have maximum perceptual dynamic range (R-21). |
| `instrument` | `#121722` | Floating HUD Shell Surface (`bg-instrument/90`) | `14.8:1` with `slate-100` (`#F1F5F9`); `10.9:1` with `slate-300` (`#CBD5E1`); `6.9:1` with `slate-400` (`#94A3B8`) | Separates floating HUD telemetry docks from the underlying 3D starfield without competing with celestial imagery. |
| `instrumentBorder` | `#64748B` | Interactive Control & HUD Hairline Border | `4.08:1` on `obsidian` (`#0A0D14`) and `3.76:1` on `instrument` (`#121722`) — **passes WCAG 1.4.11 >= 3:1 non-text contrast** | Guarantees every interactive input, button, and HUD divider has a crisp >= 3:1 boundary in dark observatory lighting. |
| `accentAmber` | `#F59E0B` | Primary Deliberate Accent (Reticle, Active Target, Mismatch Alert) | `9.05:1` on `obsidian` (`#0A0D14`); `8.34:1` on `instrument` (`#121722`); `9.05:1` dark text `#0A0D14` on `#F59E0B` button | Serves as the single deliberate accent (Part 3 Levers) marking the active sky reticle, candidate trajectory, and spectral mismatch warning. |
| `emerald` (Semantic) | `#10B981` / `#A7F3D0` | Scientific Safety Signal (`Wavelength Matched`) | `#A7F3D0` (`emerald-200`) on `#022C22` (`emerald-950`) is `12.4:1` | Provides an unambiguous green safety signal when two compared SPHEREx epochs share a compatible wavelength band. |

---

## 3. Typography & Identity Motif (R-06, R-20, R-31)

- **UI & Scientific Prose (`font-sans`)**: `Inter`, `system-ui`, `-apple-system`, `sans-serif`.
  - **One-line reason (R-31)**: Chosen for high x-height and crisp legibility at compact 12px-14px HUD labels and bilingual EN/ES scientific explanations without decorative distraction.
- **Telemetry & Coordinate Readouts (`font-mono` / `tabular-nums`)**: `JetBrains Mono`, `Fira Code`, `ui-monospace`, `SFMono-Regular`, `monospace`.
  - **One-line reason (R-31)**: Fixed-width tabular numerals prevent horizontal layout jitter when Right Ascension (`RA`), Declination (`Dec`), Field of View (`FOV`), wavelength (`um`), and `S/N` update live during 3D sky panning and epoch blinking.
- **Identity Motif (Part 3 Levers)**: Crosshair reticle coordinates paired with tabular monospace telemetry (`RA / Dec / lambdaUm / S/N`) and crisp hairline section dividers instead of nested cards, giving SVDV the unmistakable character of a space-telescope flight instrument.

---

## 4. Spatial Architecture & One-Line Decisions (R-05, R-10, R-11, R-12, R-13, R-14, R-31)

1. **Why a 100% Viewport (`fixed inset-0 w-screen h-screen`) 3D/WebGL2 Sky Canvas? (R-05, R-31)**
   - *Reason*: SVDV is first and foremost an interactive 3D celestial "GPS of the sky", so the 3D/WebGL2 star map must be the undisputed single focal point occupying the entire screen rather than a small box inside a grid.
2. **Why Floating, Collapsible HUD Overlays Instead of a 12-Column Card Grid? (R-14, C-3, R-31)**
   - *Reason*: Anchoring the Top Navigation Bar and the Right Scientific Inspector Dock over the viewport edges lets astronomers inspect 2D Blink cutouts and candidate evidence right beside the active 3D target or collapse the dock (`Hide HUD` / `Show HUD`) for 100% unobstructed sky navigation.
3. **Why Hairline Dividers (`border-b border-instrumentBorder/60`) Inside the Inspector Dock Instead of Nested Boxes? (R-14, R-31)**
   - *Reason*: Replacing 3-level nested bordered boxes with flat hairline section dividers eliminates visual clutter and keeps focus on the 60x60 pixelated satellite cutout and candidate trajectory.
4. **Why Cap `backdrop-blur-md` Strictly at 2 Elements (Top HUD Bar + Right Inspector Dock)? (R-10, R-31)**
   - *Reason*: Applying translucent glass only to the two outer HUD shells preserves depth perception over the 3D starfield while keeping all inner controls solid (`bg-obsidian`) for maximum text contrast and R-10 compliance.
5. **Why `rounded-md` (6px) on Instrument Controls and `rounded-lg` (8px) on HUD Shells, Zero Pill Abuse? (R-11, R-31)**
   - *Reason*: Crisp technical corner radii distinguish structural HUD docks (`8px`) from actionable buttons/inputs (`6px`) and data readouts (`4px`), avoiding generic AI pill-shaped uniformity.
6. **Why Render 2D Cutouts with `image-rendering: pixelated` at `290x290 px`? (R-31)**
   - *Reason*: SPHEREx cutouts are ~58x58 to 60x60 detector pixels at 6.2"/px, and nearest-neighbor pixelation preserves genuine astronomical detector pixel boundaries without blurry bilinear interpolation.
