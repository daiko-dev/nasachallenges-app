# SphereX Viewer and Data Visualizer (SVDV)
### NASA Space Apps Challenge 2026 — Desafío: Planet X and SPHEREx

Plataforma de Exploración y Análisis Astronómico interactiva basada en los datos espectrales del telescopio espacial **SPHEREx** de la NASA (102 bandas en el infrarrojo cercano).

---

## 🛠️ Herramientas y Gestores de Paquetes

- **Backend (Python):** Gestionado con **`uv`** (`pyproject.toml` / `requirements.txt`).
- **Frontend (Node/TypeScript):** Gestionado con **`pnpm`** (`package.json`).

---

## 🌌 Arquitectura del Proyecto (SVDV)

El sistema se compone de cuatro módulos interconectados:

1. **Módulo 1: Explorador Visual 3D (Frontend)**
   - Visor 3D interactivo en WebGL / WWT (WorldWide Telescope) / Three.js.
   - Navegación estelar inmersiva y controles para alternar entre las 102 bandas infrarrojas y líneas temporales de observación.
2. **Módulo 2: Sistema de Actualizaciones y Datos Oficiales**
   - Servicio backend para consultar datos astronómicos en tiempo real desde el Infrared Science Archive (IRSA) de la NASA usando `astroquery`.
3. **Módulo 3: Motor de Análisis Científico**
   - Procesamiento matemático de las firmas espectrales (`scipy`, `specutils`).
   - Detección de picos de intensidad y cruce con firmas moleculares conocidas ($H_2O$, $CO_2$, $CH_4$, etc.).
4. **Módulo 4: Generación de Reportes Educativos con IA (RAG)**
   - Reportes divulgativos generados mediante LLM vía **OpenRouter**.
   - Contexto enriquecido y vectorizado mediante **Supabase** (`pgvector`) bajo un *system prompt* estricto para evitar alucinaciones.

---

## 📁 Estructura del Repositorio

```text
svdv/
├── backend/                  # API REST en Python (FastAPI) - Gestionado con uv
│   ├── app/
│   │   ├── api/              # Endpoints v1
│   │   ├── core/             # Configuración y settings
│   │   ├── data/             # Mapeo tabular estricto de bandas y moléculas
│   │   ├── schemas/          # Modelos Pydantic para I/O
│   │   └── services/         # Lógica de conexión NASA, análisis y RAG
│   ├── tests/                # Pruebas unitarias
│   ├── pyproject.toml        # Especificación uv
│   ├── requirements.txt      # Especificación estándar de dependencias
│   └── .env.example
├── frontend/                 # Aplicación SPA (React + TypeScript + Vite) - Gestionado con pnpm
│   ├── src/
│   │   ├── assets/           # Recursos estáticos
│   │   ├── components/       # Componentes organizados por módulo
│   │   ├── services/         # Clientes HTTP y llamadas al backend
│   │   ├── styles/           # Estilos globales y Tailwind CSS
│   │   └── types/            # Definiciones de tipos TypeScript
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── .gitignore
├── .env.example
└── README.md
```

---

## 🚀 Inicio Rápido (Desarrollo)

### Backend (`uv`)
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
# o directamente: uv run uvicorn app.main:app --reload
```

### Frontend (`pnpm`)
```bash
cd frontend
pnpm install
pnpm dev
```
