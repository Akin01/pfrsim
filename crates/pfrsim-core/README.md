# `pfrsim-core`

The core numerical engine, time series analysis, machine learning forecasting, and physical simulation library powering the **Peatland Fire Risk Simulator (`pfrsim`)**.

`pfrsim-core` runs fully in-process without Python, R, or external runtime dependencies. It provides data sanity auditing, missing value imputation, statistical and deep recurrent forecasting, Nelder-Mead calibration of the physical Peatland Fire Vulnerability Index (PFVI), SQLite run persistence, and deterministic artifact serialization.

---

## Architecture Overview

```text
crates/pfrsim-core/
├── src/
│   ├── lib.rs            # Crate root and module exports
│   ├── error.rs          # Unified PfrsimError hierarchy and CommandOutput<T>
│   ├── ingest.rs         # Ingestion (CSV, Excel, Parquet), stats, Wang et al. STL, LTTB
│   ├── imputer/          # Imputation registry: k-NN, Spline, LOESS, Linear
│   │   ├── mod.rs
│   │   ├── knn.rs        # Joint Euclidean donor k-NN regression
│   │   ├── spline.rs     # Natural cubic spline interpolation
│   │   ├── loess.rs      # Cleveland tricube local regression
│   │   └── linear.rs     # Piecewise linear interpolation
│   ├── forecaster/       # Time series forecasting registry
│   │   ├── mod.rs
│   │   ├── arima.rs      # AutoARIMA + Box-Cox profile log-likelihood
│   │   ├── lstm.rs       # Deep recurrent Long Short-Term Memory network
│   │   └── gru.rs        # Deep recurrent Gated Recurrent Unit network
│   ├── pfvi.rs           # Physical fire index, 4D Nelder-Mead simplex, grid polish
│   ├── runstore.rs       # SQLite WAL database for metrics, parameters, and datasets
│   ├── artifact.rs       # Parquet, JSON manifests, and headless chart materialization
│   └── pipeline.rs       # 5-stage async execution engine with streaming progress
└── tests/
    └── example8_parity.rs # Parity, determinism, and end-to-end integration suite
```

---

## Core Modules & Mathematical Foundations

### 1. Data Ingestion & Time Series Analysis (`ingest.rs`)
- **Format Ingestion**: Streaming multi-format parsers supporting CSV, TSV, Microsoft Excel (`.xlsx`, `.xls`, `.ods` via `calamine`), and Apache Parquet via `polars`.
- **Heuristic Schema Binding**: Normalizes and maps arbitrary table headers to the 4 load-bearing sensor channels:
  - **WT**: Water Table Depth ($m$)
  - **SM**: Volumetric Soil Moisture ($\%$)
  - **Rf**: Precipitation / Rainfall ($\text{mm}$)
  - **Temp**: Surface Temperature ($^\circ\text{C}$)
- **LTTB Downsampling**: Largest-Triangle-Three-Buckets algorithm with strict $O(N)$ linear complexity preserving extreme peaks and troughs for high-frequency time series rendering.
- **Decomposition & Autocorrelation**:
  - Rolling Seasonal-Trend decomposition using LOESS (STL).
  - Autocorrelation Function (ACF) and Partial Autocorrelation Function (PACF) computed via the Durbin-Levinson recurrence.
  - Spectral and structural timeseries features based on Wang et al. (2006) trend strength ($F_T$) and seasonality strength ($F_S$).

### 2. Missing Value Imputation (`imputer/`)
Provides a pluggable `Imputer` trait with algorithms audited for numerical parity with standard timeseries packages:
- **`knn`**: Joint 4-variable Euclidean donor matching with distance weighting and complete-donor multi-variable regression.
- **`spline`**: Natural cubic spline interpolation ensuring continuous first and second derivatives across gap spans.
- **`loess`**: Local polynomial regression with Cleveland tricube weighting kernel and pre-allocated neighbor buffers.
- **`linear`**: Piecewise linear interpolation with fast interior fill.

### 3. Horizon Forecasting (`forecaster/`)
Multi-step autoregressive trajectory forecasting for hydrological and atmospheric variables:
- **AutoARIMA (`arima.rs`)**:
  - Automated parameter search $(p, d, q)$ optimizing Akaike Information Criterion (AIC) and Bayesian Information Criterion (BIC).
  - Profile log-likelihood Box-Cox transformation ($\lambda \in [-2.0, 2.0]$) with Taylor-series bias correction during inverse transformation.
  - White-noise residual diagnostics via the Ljung-Box test statistic:
    $$Q = N(N + 2)\sum_{k=1}^m \frac{\hat{r}_k^2}{N - k}$$
  - Configurable gradient descent refinement learning rate (`ArimaConfig::learning_rate`, default $0.01$).
  - Full history continuity tracking via pre-forecast lookback vectors.
- **Deep Recurrent Neural Networks (`lstm.rs` & `gru.rs`)**:
  - Pure compiled Rust deep learning execution via the **Burn** framework, supporting both multi-threaded CPU (`Autodiff<NdArray<f32>>`) and GPU WGPU compute shader (`Autodiff<Wgpu>`) acceleration.
  - **Configurable Learning Rate ($\eta$)**: Adam optimizer step size (`NnConfig::learning_rate`, default $0.02$, tunable from $0.001$ to $0.1$).
  - **Configurable Batch Sizing ($B$)**: Flexible mini-batching (`batch_size` $16 - 2048$) or Full Batch ($0$) mode for deterministic exact gradients.
  - Min-Max scaling of sensor channels to $[0, 1]$ before sequence windowing with inverse rescaling and physical boundary enforcement ($Rf \ge 0$, $SM \in [0, 100]$).
  - Zero-allocation sequence windowing and tensor handle reuse across training epochs.
  - Out-of-sample holdout validation reporting Mean Squared Error (MSE), Root Mean Squared Error (RMSE), and Mean Absolute Error (MAE).
### 4. Physical Vulnerability Index Calibration (`pfvi.rs`)
Downhill simplex optimization of the non-linear Peatland Fire Vulnerability Index (PFVI):
- **Recursion Equations**:
  - **Drying Factor ($DF_t$)**:
    $$DF_t = \frac{(300 - x_{t-1}) \cdot (0.4982 \cdot e^{0.0905 \cdot \text{Temp}_t + 1.6096} - 4.268) \cdot \Delta t \cdot 10^{-3}}{1 + 10.88 \cdot e^{-0.001736 \cdot R_0}}$$
  - **Rainfall Factor ($RF_t$)**: Effective precipitation reduction accounting for canopy interception and evaporation losses.
  - **Water Table Factor ($WTF_t$)**: Soil moisture retention retention curve parameterized by Van Genuchten soil parameters:
    $$\theta = \left( 1 + (h / \alpha)^n \right)^{-m}, \quad m = 1 - 1/n$$
    $$WTF_t = a_H - b_H \cdot (1 - \theta) \cdot 300$$
  - **Observed Drought Index ($DI_{\text{obs}, t}$)**:
    $$DI_{\text{obs}, t} = 300 \cdot \left(1 - \frac{SM_t - FC}{SAT - FC}\right)$$
- **Optimization**:
  - 4D Nelder-Mead simplex search over parameter vector $[a_H, b_H, n, \alpha]$ minimizing $MSE(\text{PFVI}, DI_{\text{obs}})$.
  - **Zero-Allocation Objective Evaluation**: The inner loop computes mean squared error iteratively with scalar state updates without allocating dynamic heap vectors.
  - Bounded multi-dimensional grid search polish ($m \in [1, 3]$).
  - Hazard severity classification: Low ($\le 75$), Moderate ($76 - 150$), High ($151 - 225$), Extreme ($> 225$).

### 5. Persistent Storage & Lifecycle (`runstore.rs`)
- Embedded SQLite database running in **WAL (Write-Ahead Logging)** mode with `NORMAL` synchronous commits and `busy_timeout` protection.
- Stores dataset metadata, ingestion profiles, job lifecycle statuses, training stage intervals, hyperparameters, and holdout evaluation metrics following the MLflow metric schema.
- Records neural hyperparameters: `learning_rate`, `batch_size`, `look_back`, `epochs`, `layer_units`, and execution `device`.
### 6. Artifact Serialization & Materialization (`artifact.rs`)
- Compiles output bundles under `models/<run_id>/`:
  - `frames.parquet`: Binary Apache Parquet table with SNAPPY compression for high-performance timeline scrubbers.
  - `manifest.json`: Cryptographic SHA-256 hash manifest verifying replay determinism.
  - `model.json`: Unified model and parameter metadata.
  - `imputed.csv`, `forecast.csv`, `pfvi.csv`, `metrics.json`.
  - `frames.json`: Complete simulation frames for webview scrubbing and offline playback.
- **Export Formats**:
  - **ONNX Runtime (`onnx_<run_id>/`)**: Standalone binary `model.onnx` graph (IR v8, opset 17) with `onnx_runtime_inference.py`, metadata schema, and provenance files for native inference across Python, Node.js, C++, and Rust (`ort`).
  - **MLflow (`mlflow_<run_id>/`)**: Native MLflow tracking directory structure with `mlflow_replay.py` for logging parameters, metrics, and tags to remote/local servers.
  - **Raw CSV**: Tabular records for simulation frames, imputed values, and model forecasts.

---

## Memory Efficiency & Performance Invariants

1. **Zero-Allocation Optimization Loops**:
   - `pfvi_objective` calculates loss iteratively using scalar variables; invariant series ($h$, $DI_{\text{obs}}$, $RF$) are precomputed once before simplex initialization.
2. **In-Place Preallocated Buffers**:
   - Box-Cox lambda profiling reuses a single preallocated buffer across all 81 search steps.
   - ARMA residual updates in gradient descent mutate a preallocated vector in place rather than creating fresh allocations per iteration.
3. **Contiguous Neural Windows**:
   - Sliding lookback sequences are flattened directly into contiguous float vectors with exact capacity, avoiding thousands of intermediate `Vec<Vec<f64>>` allocations.
   - Tensor buffers are constructed once before epoch iteration and reused across training cycles.

---
## Training Pipeline Benchmark Matrix & Profiling

A high-performance benchmark suite (`benches/pipeline_matrix.rs`) profiles all **12 configuration combinations** ($4\text{ imputers} \times 3\text{ forecasters}$) across both **cold** (fresh database, cold allocators, cold model graphs) and **hot** (warmed memory pools, initialized SQLite WAL schemas, warm CPU caches) execution paths on real-world hydrometeorological timeseries containing sensor dropouts (NaNs).

### Applied Hot-Path Optimizations

1. **Autodiff Graph Decoupling on Recurrent Inference (`lstm.rs` & `gru.rs`)**:
   - Decoupled training from evaluation/rollout using `AutodiffModule::valid(&model)`.
   - During holdout metric calculation ($MSE, RMSE, MAE$) and multi-step autoregressive rollout ($h$ steps), inference runs directly on the underlying `NdArray<f32>` backend, completely eliminating gradient tape graph construction and tensor tape allocations.
   - **Impact**: Cuts deep learning pipeline execution latency by **~45% - 55%** (from $1{,}357\text{ ms}$ down to $607\text{ ms}$).

2. **Precomputed Transcendental Terms & Reciprocal Hoisting (`pfvi.rs`)**:
   - The Nelder-Mead simplex inner loop historically evaluated exponential temperature drying factors $(0.4982 \cdot e^{0.0905 \cdot \text{Temp} + 1.6096} - 4.268) / (1 + 10.88 \cdot e^{-0.001736 \cdot R_0})$ and $h / \alpha$ on every single time step across thousands of iterations.
   - The invariant drying factor vector is now precomputed **once** before simplex optimization, turning inner-loop exponential evaluations into scalar multiplies.
   - Hoisted parameter reciprocals ($1/\alpha$) and Van Genuchten exponent $m = 1 - 1/n$ out of the observation loop.
   - **Impact**: Accelerates Nelder-Mead + grid search polish by **22.5%** ($0.55\text{ ms}$ per fit).

3. **Zero-Heap-Allocation Query Matrices (`imputer/knn.rs`)**:
   - Replaced dynamic nested heap vector creation (`DenseMatrix::from_2d_vec(&vec![vec![...]])`) with stack-allocated fixed slices (`DenseMatrix::from_2d_array(&[&[...]])`).
   - Replaced full $O(M \log M)$ distance sorting across local donor windows with $O(M)$ linear-time partitioning via `select_nth_unstable_by`.
   - **Impact**: Imputation throughput improved by **29.3%** ($2.88\text{ ms}$ per execution).

### Benchmark Matrix (500 Observations with Real Missingness)

| # | Imputer | Forecaster | Cold Path (ms) | Hot Path (ms) | Hot Speedup |
| :-: | :--- | :--- | :---: | :---: | :---: |
| **1** | `linear` | `arima` | **40.43** | **41.39** | $0.98\times$ |
| **2** | `linear` | `lstm` | **686.04** | **607.36** | $1.13\times$ |
| **3** | `linear` | `gru` | **535.95** | **494.18** | $1.08\times$ |
| **4** | `spline` | `arima` | **41.28** | **41.99** | $0.98\times$ |
| **5** | `spline` | `lstm` | **646.80** | **646.41** | $1.00\times$ |
| **6** | `spline` | `gru` | **444.19** | **432.97** | $1.03\times$ |
| **7** | `loess` | `arima` | **43.33** | **44.43** | $0.98\times$ |
| **8** | `loess` | `lstm` | **590.99** | **616.38** | $0.96\times$ |
| **9** | `loess` | `gru` | **432.93** | **497.23** | $0.87\times$ |
| **10** | `knn` | `arima` | **44.68** | **45.08** | $0.99\times$ |
| **11** | `knn` | `lstm` | **628.73** | **640.02** | $0.98\times$ |
| **12** | `knn` | `gru` | **427.24** | **509.88** | $0.84\times$ |

### Stage-Level Microbenchmarks

- **Missingness Imputation**:
  - `linear`: **`0.006 ms`** / execution
  - `loess`: **`0.018 ms`** / execution
  - `spline`: **`0.036 ms`** / execution
  - `knn`: **`2.882 ms`** / execution
- **Timeseries Forecasters (Horizon $h=4$)**:
  - `arima` (AutoARIMA): **`13.02 ms`**
  - `gru` (Burn Recurrent Net): **`413.60 ms`**
  - `lstm` (Burn Recurrent Net): **`529.61 ms`**
- **Physical Vulnerability Calibration**:
  - Nelder-Mead 4D Simplex + Bounded Grid Polish: **`0.55 ms`** / fit


### High-Scale Profiling & Hardware Utilization (>100k Dataset)

Evaluated on `fixtures/100k_stress_test.parquet` ($N = 100{,}000$ rows with real missingness across 4 sensor channels):

| Pipeline Component / Stage | 100k Dataset Metric | Throughput / Efficiency |
| :--- | :---: | :--- |
| **Inspection & Schema Mapping** | **`47.05 ms`** | Instant heuristic schema binding |
| **Columnar Ingestion & Parquet Decode** | **`251.42 ms`** | **$400{,}000$ rows / sec** |
| **Zero-Allocation LTTB Downsampling** | **`1.74 ms`** | $100{,}000\text{ floats} \to 2{,}500\text{ pts}$ in $<2\text{ms}$ |
| **Full Pipeline: Linear + AutoARIMA** | **`303.81 ms`** | **$> 320{,}000$ rows / sec** end-to-end |
| **Full Pipeline: Deep Recurrent (GRU)** | **`142.7 s`** *(CPU)* vs **$\approx 3.8\text{s}$** *(GPU)* | $945$ mini-batch backprop passes ($B=128$, $10\text{k}$ window) |

#### Hardware Scaling Insights on >100k Rows:
1. **The Statistical/ARIMA Crossover**: For classical time series ($AutoARIMA$), execution scales linearly with minimal memory overhead, completing the entire 100,000-row pipeline in **`303 ms`**.
2. **The Deep Learning GPU Crossover**: When scaling recurrent models to high-sample hydrological regimes ($10{,}000$ active sequence points with $B=128$), CPU execution performs $945$ sequential backprops per channel. This is the exact boundary where **GPU WGPU acceleration dominates**, dispatching the $63$ mini-batches in parallel compute shaders across the RTX 3050's $2{,}048$ CUDA cores.
To reproduce the benchmark suite:

```bash
cargo bench -p pfrsim-core --bench pipeline_matrix
```


## Verification & Testing

Run all unit tests in `pfrsim-core`:

```bash
cargo test -p pfrsim-core --lib
```

Run integration parity, determinism, and concurrency suites:

```bash
cargo test -p pfrsim-core --test example8_parity
```

### Determinism Invariant
Given identical inputs, configuration, and random seed:

$$\text{Pipeline}(D, C, \text{seed}) \implies \text{SHA256}(\text{frames.json})_1 \equiv \text{SHA256}(\text{frames.json})_2$$

This invariant is verified on every test run.

---

## License

This crate is open source software licensed under the [MIT License](LICENSE).
