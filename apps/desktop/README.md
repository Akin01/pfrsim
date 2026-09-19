# `pfrsim-desktop`

The desktop user interface for the **Peatland Fire Risk Simulator (`pfrsim`)**, built with **SolidJS 1.9**, **Tailwind CSS v4**, and **Tauri v2**.

`pfrsim-desktop` provides a zero-virtual-DOM, fine-grained reactive frontend engineered for real-time IPC telemetry streaming, 60fps time-series timeline scrubbing, 3D peatland moisture visualization, and mathematical exploratory data analysis.

---

## Technology Stack

| Layer / Concern               | Technology                                                                                           | Role in `pfrsim-desktop`                                                                                |
| :---------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **Core UI Framework**         | [SolidJS 1.9](https://www.solidjs.com/)                                                              | Fine-grained reactive signals and memos; direct DOM updates with zero Virtual DOM overhead.             |
| **Routing & Workspaces**      | [`@solidjs/router`](https://github.com/solidjs/solid-router)                                         | Client-side navigation paired with a multi-tab workspace manager and isolated simulation instances.     |
| **Styling & Theming**         | [Tailwind CSS v4](https://tailwindcss.com/)                                                          | Utility-first responsive styling with complete light and dark mode slate palette (`@tailwindcss/vite`). |
| **2D Timeseries Plotting**    | [`uPlot`](https://github.com/leeoniya/uPlot)                                                         | High-performance canvas time series charts with synchronized cursor crosshairs (`syncKey`).             |
| **3D Peatland Visualization** | [Three.js (`three`)](https://threejs.org/)                                                           | WebGL interactive 3D terrain visualizing water table depth, fuel dryness, and live fire hazard glow.    |
| **UI & Modal Primitives**     | [`corvu`](https://corvu.dev/)                                                                        | Accessible headless dialog, drawer, and modal primitives with backdrop blur.                            |
| **Typography & Equations**    | [KaTeX (`katex`)](https://katex.org/)                                                                | Fast client-side mathematical equation rendering in methodology dialogs (`MathTex.tsx`).                |
| **Iconography**               | [`lucide-solid`](https://lucide.dev/)                                                                | Consistent iconography across navigation, actions, and status indicators.                               |
| **Client-Side CSV Parser**    | [`papaparse`](https://www.papaparse.com/)                                                            | Streaming CSV client parser for importing offline simulation packages.                                  |
| **Build & Tooling**           | [Vite 8](https://vitejs.dev/) + [TypeScript 7](https://www.typescriptlang.org/) + `oxlint` + `oxfmt` | High-speed native development server, compilation, and sub-second code verification.                    |

---

## Directory & Component Layout

```text
apps/desktop/
├── index.html                  # HTML entrypoint with viewport & font declarations
├── package.json                # Dependencies and frontend scripts
├── tsconfig.json               # TypeScript strict configuration
├── vite.config.ts              # Vite 8 config with Tailwind v4 and Solid plugin
└── src/
    ├── App.tsx                 # Root application shell, workspace manager, and global hotkeys
    ├── index.tsx               # DOM mount point
    ├── index.css               # Global CSS, Tailwind v4 @import, and KaTeX styles
    ├── pages/                  # Top-level page controllers
    │   ├── OnboardingPage.tsx  # Initial walkthrough and file dropzone
    │   ├── DataPage.tsx        # Ingestion, statistics, STL, ACF/PACF, and tables
    │   ├── TrainPage.tsx       # Model training setup, presets, and live progress stepper
    │   ├── PlayerPage.tsx      # Timeline scrubbing, 2D/3D visualization, and action cards
    │   └── RunsPage.tsx        # Run history, metrics comparison, and Export Hub
    ├── components/             # Reusable UI microcomponents
    │   ├── ColumnMapperCanvas.tsx # Interactive drag-and-drop column connector
    │   ├── TrainingStepper.tsx    # Live 5-stage progress bar with animated candy-stripes
    │   ├── Land3DView.tsx         # WebGL Three.js peatland terrain simulator
    │   ├── UPlotChart.tsx         # Encapsulated uPlot canvas wrapper
    │   ├── TrendlineSparkline.tsx # TradingView-style mini trendlines with pulse points
    │   ├── MathTex.tsx            # KaTeX formula renderer
    │   ├── WorkspaceTabBar.tsx    # Draggable multi-tab bar with overflow dropdown
    │   ├── TitleBar.tsx           # Frameless window title bar with drag region
    │   ├── Sidebar.tsx            # Collapsible navigation, brand badge, and quick actions
    │   ├── RunDetailView.tsx      # Holdout error table and export handlers
    │   ├── RunComparisonView.tsx  # Side-by-side run delta comparison
    │   ├── RunConfigureDialog.tsx # Interactive re-run & hyperparameter tuning modal
    │   ├── GlossaryModal.tsx      # Scientific hydrology and ML terminology search
    │   └── KeyboardModal.tsx      # Hotkey cheatsheet dialog
    ├── lib/
    │   ├── version.ts          # Application version constant (v0.1.0)
    │   ├── types.ts            # TypeScript interfaces mirroring Rust backend structures
    │   ├── tauri.ts            # Typed safeInvoke IPC bridge with browser mock fallback
    │   ├── store.ts            # Single-source-of-truth reactive stores (playback & view)
    │   ├── toast.ts            # Lightweight non-intrusive toast notifications
    │   └── runImporter.ts      # Offline run package parsing and hydration
    ├── i18n/
    │   └── catalog.ts          # Complete bilingual translation catalog (525 keys: 'id' / 'en')
    ├── playbook/
    │   └── cards.ts            # Mitigation action cards mapped to PFVI hazard classes
    └── utils/                  # Domain-specific helpers
        ├── train.ts            # Hyperparameter presets and GPU hardware spec parsers
        ├── math.ts             # Moving averages, trendlines, and array statistics
        └── time.ts             # Formatted timestamps and interval formatters
```

---

## Core Views & User Workflows

### 1. Onboarding (`OnboardingPage.tsx`)

- Guided entry point for new users.
- Dropzone supporting `.csv`, `.tsv`, `.xlsx`, `.xls`, and `.parquet` files.
- Emits preflight schema inspections via Tauri IPC, detecting column headers and suggesting optimal bindings for the 4 hydrological variables ($WT, SM, Rf, Temp$).
- Interactive canvas column mapper (`ColumnMapperCanvas.tsx`) for connecting source columns to physical channels.

### 2. Data Exploration (`DataPage.tsx`)

Features a 6-tab analytical workspace:

1. **`Statistik Deskriptif` (Descriptive)**: Displays mean, median, standard deviation, and interquartile range cards with mini trendline sparklines.
2. **`Garis Waktu (Series)`**: Interactive time-series line charts rendered with $O(N)$ LTTB downsampling for smooth interaction even with $10^6+$ points.
3. **`Dekomposisi STL`**: 4-tier vertically stacked decomposition plots (`Observed`, `Trend`, `Seasonal`, `Residual`) sharing a synchronized cursor crosshair (`syncKey="stl-anofox-sync"`). Displays Wang et al. (2006) trend ($F_T$) and seasonal ($F_S$) strength metrics.
4. **`Autokorelasi (ACF & PACF)`**: Side-by-side SVG autocorrelation bar charts with interactive `Max Lag` slider and Bartlett 95% confidence bands ($\pm 1.96 / \sqrt{N}$).
5. **`Matriks Nilai Hilang`**: High-contrast grid showing gap spans, leading/trailing NaNs, and missingness percentages per variable.
6. **`Tabel Baris (Preview)`**: Virtualized table rendering windowed row slices directly from the backend database via `LIMIT 50 OFFSET ?`.

### 3. Model Training Studio (`TrainPage.tsx`)

- **Top-Left Brand Badge**: Displays product brand (`pfrsim`) alongside the exact `v0.1.0` version pill badge.
- **Hardware Telemetry**: Probes local GPU capabilities (WGPU adapter query), displaying device name, VRAM estimate, and driver backend.
- **Hyperparameter Configuration**:
  - **Learning Rate ($\eta$)**: Configurable Adam step size for recurrent models ($0.001 - 0.1$, default $0.02$) and gradient refinement rate for AutoARIMA ($0.01$).
  - **Batch Size ($B$)**: Mini-batch sizing ($16, 32, 64, 128, 256, 512, 1024, 2048$) or Full Batch ($0$) for exact gradient computation.
  - **Sequence Window ($L$)**: Historical sequence timesteps ($2 - 60$, default $12$).
  - **Epochs ($E$)**: Training iterations ($1 - 1000$).
  - **Hidden Layer Units ($d$)**: Dimensionality of recurrent memory vectors ($8 - 256$).
  - **Execution Device**: Toggle between CPU (multi-threaded Rayon) and GPU (WGPU compute shaders).
- **Preconfigured Presets**:
  - `Fast`: Fast verification run (10 epochs / lightweight grid).
  - `Balanced`: Default operational preset (100 epochs / $m=2$ grid).
  - `High Precision`: Deep recurrent training (300 epochs / $m=3$ grid).
  - `Research Grid`: Exhaustive Nelder-Mead grid search.
- **Algorithm Configurator**:
  - Imputation: Piecewise Linear, Natural Cubic Spline, LOESS ($\alpha \in [0.05, 1.0]$), and k-NN ($k \in [1, 20]$).
  - Forecasting: AutoARIMA with Box-Cox, LSTM, or GRU.
  - Physical PFVI Calibration: Reference rainfall ($R_0$), time delta ($\Delta t$), Field Capacity ($FC$), Saturation ($SAT$), and grid limit ($m$).
- **Live Training Stepper (`TrainingStepper.tsx`)**:
  - Real-time animated diagonal candy-striped progress bar.
  - Zero-re-render architecture: DOM attributes update dynamically without tearing down components.
  - Granular sub-step tracking (`DIM`, `SCHEMA`, `AUDIT`, `SANITY`, `OPTIM`, `PARQUET`).

### 4. Interactive Timeline Player (`PlayerPage.tsx`)

- Timeframe animation scrubbing through past observations ($1 \dots n$) and projected horizon steps ($n+1 \dots n+h$).
- **Dual Visualizer**:
  - 2D multi-strip synchronized canvas plots (`uPlot`).
  - 3D WebGL peatland landscape (`Three.js`), rendering water table subsidence, dynamic timeline dates, surface vegetation drying, and glowing fire hazard intensity.
- Transport controls: play/pause, step backward/forward, loop toggle, and playback speed ($0.5\times$, $1\times$, $2\times$, $4\times$).
- **Multi-Tab Isolation**: Each open simulation tab maintains independent playback, timeline zoom window, and hover inspection coordinates.
- **Contextual Mitigation Playbook (`playbook/cards.ts`)**:
  - Automatically surfaces actionable field directives corresponding to the active hazard class:
    - **Low** ($0 - 75$): Normal water table monitoring.
    - **Moderate** ($76 - 150$): Canal blocking preparation and pump readiness.
    - **High** ($151 - 225$): Community burning restrictions and firebreak patrols.
    - **Extreme** ($226 - 300$): Full burning ban enforcement and active peat rewetting.

### 5. Runs History & Model Export Hub (`RunsPage.tsx`)

- Overview of all completed, in-flight, or failed runs stored in SQLite WAL.
- **Run Detail View (`RunDetailView.tsx`)**:
  - Multi-variable holdout prediction benchmark table reporting primary **RMSE**, MAE, and MSE.
  - Calibrated Van Genuchten parameters ($a_H, b_H, n, \alpha$) and PFVI calibration error.
  - Hyperparameter breakdown displaying learning rate, batch optimizer, device, lookback, and hidden dimensions.
- **Interactive Re-run Modal (`RunConfigureDialog.tsx`)**:
  - Prepopulates parameters from an existing run, allowing quick tuning of learning rate, epochs, and batch size before launching a new experiment directly into the training pipeline.
- **Export Hub**:
  - **Export to ONNX**: Generates a self-contained bundle (`onnx_<run_id>/`) with binary `model.onnx` (IR v8, opset 17), `onnx_runtime_inference.py`, `onnx_metadata.json`, and instructions. Copies the Python inference launch command to the clipboard.
  - **Export to MLflow**: Generates native MLflow FileStore tracking bundles (`mlruns/0/<run_id>/`) with parameters, metrics, tags, and `mlflow_replay.py`.
  - **Raw Exports**: CSV data frames and high-resolution PNG charts.

---

## State Management & IPC Bridge

### Global Reactive Stores (`lib/store.ts`)

State is organized into fine-grained reactive stores to avoid global re-rendering:

- **`playback`**: Manages timeline scrub position, play state, speed, and cached simulation frames.
- **`view`**: Manages persistent interface state, active dataset ID, theme (`light` / `dark`), sidebar collapse, and canonical language preference (`id` / `en`).
- **`currentLang`**: Reactive getter aliased to `view.lang`, providing a unified single source of truth across all components.

### Typed IPC Bridge (`lib/tauri.ts`)

- Encapsulates Tauri v2 `invoke` calls into a typed `safeInvoke<T>(command, args)` function returning `CommandResult<T>`.
- **Browser Mock Fallback**: Includes mock implementations for all 26 Tauri commands. Developers can run `pnpm dev:frontend` in standard web browsers without launching the native Rust binary.

---

## Internationalization (i18n)

Full bilingual support across the entire user interface:

- **Languages**: Indonesian (`id`, default) and English (`en`).
- **Catalog Structure (`i18n/catalog.ts`)**: Strongly typed translation interface with **525 synchronized keys** and 100% key parity between Indonesian and English catalogs.
- **Runtime Switching**: Language toggle updates reactive state instantly with zero page reloads, zero network requests, and zero uncaught runtime exceptions.

---

## Development Scripts

From the repository root or within `apps/desktop/`:

```bash
# Start standalone Vite dev server in browser (with mock IPC data)
pnpm dev:frontend

# Run full desktop application with native Rust backend (Tauri dev)
pnpm dev

# Run frontend test suite (Vitest)
pnpm test:frontend

# Typecheck TypeScript files
pnpm typecheck

# Lint with oxlint
pnpm lint

# Format / check code with oxfmt
pnpm format
pnpm format:check

# Production build (outputs to apps/desktop/dist/)
pnpm build:frontend
```

---

## License

This package is open source software licensed under the [MIT License](LICENSE).
