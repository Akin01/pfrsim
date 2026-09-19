# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-19

### Added

#### Core Computational Engine (`crates/pfrsim-core`)
- **Multi-Format Data Ingestion**: Streaming ingestion engine supporting CSV, TSV, Microsoft Excel (`.xlsx`, `.xls`, `.ods` via `calamine`), and Apache Parquet via `polars`.
- **Heuristic Schema Normalization**: Automated mapping of arbitrary dataset headers to 4 canonical hydrological channels: Water Table Depth ($WT$), Soil Moisture ($SM$), Precipitation ($Rf$), and Surface Temperature ($Temp$).
- **Wang et al. (2006) Feature Extraction**: Structural time series metrics including Trend Strength ($F_T$), Seasonality Strength ($F_S$), and Durbin-Levinson Autocorrelation/Partial Autocorrelation (ACF/PACF).
- **LTTB Downsampling**: Strict $O(N)$ Largest-Triangle-Three-Buckets algorithm preserving critical hydrological peaks and valleys during visualization.
- **Missing Value Imputation Registry**:
  - Joint Euclidean distance $k$-Nearest Neighbors ($k$-NN) donor regression matching R `VIM::kNN`.
  - Natural cubic spline interpolation with Thomas algorithm tridiagonal solver.
  - Cleveland tricube local regression (LOESS).
  - Piecewise linear boundary and interior gap interpolation.
- **Forecasting Registry**:
  - Box-Cox profile log-likelihood AutoARIMA with AIC/BIC minimization and conditional least-squares optimization.
  - Deep recurrent neural networks (Long Short-Term Memory and Gated Recurrent Units) implemented natively in Rust with the **Burn** framework.
  - Dual-backend acceleration: multi-threaded CPU (`NdArray<f32>`) and GPU compute shader dispatch (`Autodiff<Wgpu>`).
- **Physical Peatland Fire Vulnerability Index (PFVI)**:
  - 4D Nelder-Mead simplex optimization calibrating physical decay parameters ($h, r_0, \Delta t, \text{sat}, \text{fc}$).
  - Multi-resolution grid polish ensuring convergence to the global optimum.
- **SQLite WAL RunStore**:
  - ACID-compliant embedded run persistence tracking execution stages, parameters, telemetry, and SHA-256 artifacts.
- **Deterministic Replay Guarantee**:
  - Guaranteed identical input + seed produces byte-identical `frames.parquet` and `frames.json` outputs.

#### Desktop Application Shell (`src-tauri`)
- **Tauri v2 Native Architecture**:
  - Lightweight desktop binary (~17 MB production distribution) with zero external Python or R sidecar dependencies.
  - Frameless modern window configuration with custom draggable titlebar and window controls.
- **Typed IPC Bridge**:
  - 26 Tauri IPC commands linking frontend interactions to computational routines with structured error handling.
- **Thread Supervisor**:
  - Isolated background task execution guarded by `std::panic::catch_unwind`, isolating numerical panics and preserving GUI responsiveness.
- **Hardware GPU Telemetry**:
  - Live query of WGPU hardware adapters, memory tiers, and compute capabilities.

#### Presentation Layer (`apps/desktop`)
- **SolidJS 1.9 Reactive UI**:
  - Fine-grained reactive component tree with zero Virtual DOM overhead.
  - Responsive light and dark mode slate color palette using Tailwind CSS v4.
- **3D Peatland Moisture Simulation Canvas**:
  - Interactive WebGL terrain simulator built with Three.js rendering dynamic water table depth elevation, soil dryness texture blending, and fire risk heat glow.
- **2D Time Series Visualization**:
  - Synchronized high-density canvas plotting with `uPlot` and cursor crosshairs.
- **Multi-Tab Workspace Navigation**:
  - Tab manager supporting concurrent simulation instances (`PlayerPage`), drag-and-drop tab reordering, overflow dropdown, and contextual lifecycle actions.
- **Bilingual Internationalization (i18n)**:
  - 100% key parity between Indonesian (`id`) and English (`en`) with 525 synchronized translation keys and reactive switching.
- **Mathematical Formula Rendering**:
  - Client-side LaTeX equation rendering in methodology dialogs via KaTeX.
- **Interactive Column Connector**:
  - Visual drag-and-drop canvas for mapping imported table columns to simulation sensor channels.

#### Packaging & Distribution
- **Dual Windows Installers**: Automated builds producing WiX MSI (`.msi`) and NSIS setup (`.exe`).
- **Multi-Platform CI/CD Pipelines**:
  - `.github/workflows/ci.yml`: Automated format checking (`oxfmt`), linting (`oxlint`), TypeScript typechecking, Vitest tests, and Rust workspace test suites.
  - `.github/workflows/release.yml`: Cross-platform release packaging for Windows, macOS, and Linux on tag push and manual workflow dispatch.
- **Open Source Licensing**: Standard MIT License across root workspace and individual sub-packages.

[0.1.0]: https://github.com/akin01/pfrsim/releases/tag/v0.1.0
