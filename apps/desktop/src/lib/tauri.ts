import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  CapabilityQueryOutput,
  CommandResult,
  GpuInfo,
  DatasetDetail,
  DatasetImportOutput,
  DatasetInspection,
  DatasetPreview,
  DatasetSummary,
  JobRecord,
  Manifest,
  PipelineConfig,
  PipelineRunOutput,
  ProgressEventPayload,
  RunDetail,
  RunSummary,
  SimulationFrame,
  AutocorrelationView,
  DatasetRowsPage,
  DownsampledSeries,
  AllDownsampledSeries,
  StlDecompositionView,
} from "./types";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};
export { getCurrentWindow } from "@tauri-apps/api/window";

export const isWindowMaximized = async (): Promise<boolean> => {
  if (isTauri()) {
    try {
      return await getCurrentWindow().isMaximized();
    } catch {
      return false;
    }
  }
  return false;
};

export const minimizeWindow = async (): Promise<void> => {
  if (isTauri()) {
    try {
      await invoke("window_minimize");
    } catch {
      try {
        await getCurrentWindow().minimize();
      } catch (e) {
        console.warn("Minimize window failed:", e);
      }
    }
  }
};

export const toggleMaximizeWindow = async (): Promise<void> => {
  if (isTauri()) {
    try {
      await invoke("window_toggle_maximize");
    } catch {
      try {
        await getCurrentWindow().toggleMaximize();
      } catch (e) {
        console.warn("Toggle maximize window failed:", e);
      }
    }
  }
};

export const closeWindow = async (): Promise<void> => {
  if (isTauri()) {
    try {
      await invoke("window_close");
    } catch {
      try {
        await getCurrentWindow().close();
      } catch (e) {
        console.warn("Close window failed:", e);
      }
    }
  }
};

export const startDraggingWindow = async (): Promise<void> => {
  if (isTauri()) {
    try {
      await getCurrentWindow().startDragging();
    } catch {
      try {
        await invoke("window_start_dragging");
      } catch (e) {
        console.warn("Start dragging window failed:", e);
      }
    }
  }
};

/**
 * Browser Mock Fallback (enables running via standard web browser)
 */
const MOCK_FRAMES: SimulationFrame[] = [
  {
    t: 1,
    time_label: "1 Oct",
    wt: -1.021,
    sm: 35.424,
    rf: 0.00012,
    temp: 35.4,
    pfvi: 185.2,
    diobs: 195.0,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.2,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.1,
    water_depth: 1.021,
  },
  {
    t: 2,
    time_label: "2 Oct",
    wt: -0.972,
    sm: 34.8,
    rf: 0.00024,
    temp: 35.8,
    pfvi: 192.5,
    diobs: 202.0,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: false, sm: true, rf: false, temp: false },
    water_distribution: 0.22,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.08,
    water_depth: 0.972,
  },
  {
    t: 3,
    time_label: "3 Oct",
    wt: -1.08,
    sm: 37.268,
    rf: 0.00011,
    temp: 36.2,
    pfvi: 178.4,
    diobs: 177.3,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: true, sm: false, rf: false, temp: true },
    water_distribution: 0.21,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.12,
    water_depth: 1.08,
  },
  {
    t: 4,
    time_label: "4 Oct",
    wt: -1.204,
    sm: 38.453,
    rf: 0.0003,
    temp: 36.5,
    pfvi: 182.1,
    diobs: 165.5,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: true, temp: false },
    water_distribution: 0.23,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.15,
    water_depth: 1.204,
  },
  {
    t: 5,
    time_label: "5 Oct",
    wt: -0.906,
    sm: 31.456,
    rf: 0.0003,
    temp: 36.3,
    pfvi: 215.8,
    diobs: 235.4,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: true, temp: false },
    water_distribution: 0.24,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.09,
    water_depth: 0.906,
  },
  {
    t: 6,
    time_label: "6 Oct",
    wt: -0.993,
    sm: 33.235,
    rf: 0.00046,
    temp: 37.2,
    pfvi: 224.6,
    diobs: 217.6,
    class: "High",
    class_code: 2,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.26,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.1,
    water_depth: 0.993,
  },
  {
    t: 7,
    time_label: "7 Oct",
    wt: -1.327,
    sm: 30.168,
    rf: 0.00052,
    temp: 37.0,
    pfvi: 238.9,
    diobs: 248.3,
    class: "Extreme",
    class_code: 3,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.28,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.18,
    water_depth: 1.327,
  },
  {
    t: 8,
    time_label: "8 Oct",
    wt: -2.001,
    sm: 30.212,
    rf: 0.00041,
    temp: 38.1,
    pfvi: 254.2,
    diobs: 247.9,
    class: "Extreme",
    class_code: 3,
    is_forecast: false,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.3,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.25,
    water_depth: 2.001,
  },
  // 4 forecast frames
  {
    t: 9,
    time_label: "+1d (9 Oct)",
    wt: -2.05,
    sm: 28.5,
    rf: 0.0,
    temp: 38.4,
    pfvi: 268.0,
    diobs: 265.0,
    class: "Extreme",
    class_code: 3,
    is_forecast: true,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.32,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.26,
    water_depth: 2.05,
  },
  {
    t: 10,
    time_label: "+2d (10 Oct)",
    wt: -2.1,
    sm: 27.2,
    rf: 0.0,
    temp: 38.6,
    pfvi: 276.5,
    diobs: 278.0,
    class: "Extreme",
    class_code: 3,
    is_forecast: true,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.33,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.27,
    water_depth: 2.1,
  },
  {
    t: 11,
    time_label: "+3d (11 Oct)",
    wt: -2.14,
    sm: 26.1,
    rf: 0.0,
    temp: 38.8,
    pfvi: 282.1,
    diobs: 289.0,
    class: "Extreme",
    class_code: 3,
    is_forecast: true,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.34,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.28,
    water_depth: 2.14,
  },
  {
    t: 12,
    time_label: "+4d (12 Oct)",
    wt: -2.18,
    sm: 25.4,
    rf: 0.0,
    temp: 38.9,
    pfvi: 285.4,
    diobs: 296.0,
    class: "Extreme",
    class_code: 3,
    is_forecast: true,
    imputed: { wt: false, sm: false, rf: false, temp: false },
    water_distribution: 0.35,
    rainfall_effect: 0.0,
    soil_fluctuation: 0.29,
    water_depth: 2.18,
  },
];
const MOCK_RF_SEASONAL_PROFILE = [
  0.00008, 0.0001, 0.00012, 0.00016, 0.0002, 0.00024, 0.00022, 0.00018, 0.00014, 0.00012, 0.0001,
  0.00009,
];
const MOCK_RF_OBSERVED: (number | null)[] = Array.from({ length: 48 }, (_, i) => {
  if (i === 9 || i === 30) return null;
  const trend = 0.0002 + i * 0.0000012;
  return Number((trend + MOCK_RF_SEASONAL_PROFILE[i % 12]).toFixed(6));
});
const MOCK_RF_TREND: (number | null)[] = MOCK_RF_OBSERVED.map((v, i) =>
  v == null || i < 6 || i > 41 ? null : Number((0.0002 + i * 0.0000012 + 0.000145).toFixed(6)),
);
const MOCK_RF_SEASONAL: (number | null)[] = MOCK_RF_OBSERVED.map((_, i) =>
  Number((MOCK_RF_SEASONAL_PROFILE[i % 12] - 0.000145).toFixed(6)),
);
const MOCK_RF_REMAINDER: (number | null)[] = MOCK_RF_OBSERVED.map((v, i) => {
  const t = MOCK_RF_TREND[i];
  if (v == null || t == null) return null;
  return Number((v - t - MOCK_RF_SEASONAL[i]!).toFixed(6));
});

const MOCK_PREVIEW: DatasetPreview = {
  stats: {
    wt: {
      min: -2.001,
      max: -0.906,
      mean: -1.203,
      std: 0.312,
      acf1: 0.955,
      trend: { direction: "falling", slope: -0.0018 },
      seasonality: { seasonal: false, period: null, strength: 0.21 },
      stationarity: { stationary: false, mean_shift: 1.62, var_ratio: 2.1 },
      decomposition: null,
    },
    sm: {
      min: 30.168,
      max: 38.453,
      mean: 33.738,
      std: 2.412,
      acf1: 0.871,
      trend: { direction: "flat", slope: 0.0004 },
      seasonality: { seasonal: false, period: null, strength: 0.18 },
      stationarity: { stationary: true, mean_shift: 0.42, var_ratio: 1.7 },
      decomposition: null,
    },
    rf: {
      min: 0.00011,
      max: 0.00052,
      mean: 0.00031,
      std: 0.00013,
      acf1: 0.402,
      trend: { direction: "flat", slope: 0.0 },
      seasonality: { seasonal: true, period: 12, strength: 0.58 },
      stationarity: { stationary: true, mean_shift: 0.31, var_ratio: 1.4 },
      decomposition: {
        period: 12,
        trend: MOCK_RF_TREND,
        seasonal: MOCK_RF_SEASONAL.map((v) => v as number),
        remainder: MOCK_RF_REMAINDER,
      },
    },
    temp: {
      min: 35.4,
      max: 38.1,
      mean: 36.6,
      std: 0.815,
      acf1: 0.923,
      trend: { direction: "rising", slope: 0.0041 },
      seasonality: { seasonal: false, period: null, strength: 0.24 },
      stationarity: { stationary: false, mean_shift: 1.35, var_ratio: 1.9 },
      decomposition: null,
    },
  },
  missing: {
    total: 5,
    wt: { count: 1, indices: [2] },
    sm: { count: 1, indices: [1] },
    rf: { count: 2, indices: [3, 4] },
    temp: { count: 1, indices: [2] },
  },
  head: [
    { t: 1, time_label: "1", wt: -1.021, sm: 35.424, rf: 0.00012, temp: 35.4 },
    { t: 2, time_label: "2", wt: -0.972, sm: null, rf: 0.00024, temp: 35.8 },
    { t: 3, time_label: "3", wt: null, sm: 37.268, rf: 0.00011, temp: null },
    { t: 4, time_label: "4", wt: -1.204, sm: 38.453, rf: null, temp: 36.5 },
    { t: 5, time_label: "5", wt: -0.906, sm: 31.456, rf: null, temp: 36.3 },
    { t: 6, time_label: "6", wt: -0.993, sm: 33.235, rf: 0.00046, temp: 37.2 },
    { t: 7, time_label: "7", wt: -1.327, sm: 30.168, rf: 0.00052, temp: 37.0 },
    { t: 8, time_label: "8", wt: -2.001, sm: 30.212, rf: 0.00041, temp: 38.1 },
  ],
  tail: [],
  verdict: {
    is_valid: true,
    errors: [],
    warnings: [],
  },
};

const MOCK_RUN_DETAIL: RunDetail = {
  summary: {
    run_id: "pfrsim-pipeline-sabangau-demo",
    job_id: "job-demo-1",
    dataset_id: "ds-sabangau-demo",
    dataset_name: "Sabangau Station Demo (8-point)",
    name: "Sabangau Demo Run (knn × arima)",
    created_at: new Date().toISOString(),
    status: "DONE",
    imputer_id: "knn",
    forecaster_id: "arima",
    h: 4,
    best_pfvi_mse: 14.82,
    seed: 42,
  },
  config_json: JSON.stringify({
    imputer: { id: "knn" },
    forecaster: { id: "arima" },
    pfvi: { h: 4, r0: 2700 },
  }),
  stages: [
    {
      stage: "validating",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "impute",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "forecast",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "pfvi",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
  ],
  params: [
    ["imputer.id", "knn"],
    ["forecaster.id", "arima"],
    ["pfvi.h", "4"],
    ["pfvi.r0", "2700"],
    ["pfvi.max_grid_m", "2"],
    ["seed", "42"],
  ],
  metrics: [
    ["impute", "impute.n_imputed", 5],
    ["impute", "impute.frac_imputed", 0.156],
    ["forecast", "forecast.wt.mse", 0.024],
    ["forecast", "forecast.wt.rmse", 0.155],
    ["forecast", "forecast.wt.mae", 0.12],
    ["forecast", "forecast.sm.mse", 0.45],
    ["forecast", "forecast.sm.rmse", 0.671],
    ["forecast", "forecast.sm.mae", 0.52],
    ["forecast", "forecast.rf.mse", 0.00001],
    ["forecast", "forecast.rf.rmse", 0.003],
    ["forecast", "forecast.rf.mae", 0.002],
    ["forecast", "forecast.temp.mse", 0.18],
    ["forecast", "forecast.temp.rmse", 0.424],
    ["forecast", "forecast.temp.mae", 0.35],
    ["forecast", "arima.wt.aic", -12.4],
    ["forecast", "arima.wt.bic", -10.8],
    ["forecast", "arima.wt.ljungbox_p", 0.42],
    ["forecast", "arima.sm.aic", 18.2],
    ["forecast", "arima.sm.bic", 19.9],
    ["forecast", "arima.sm.ljungbox_p", 0.38],
    ["forecast", "arima.rf.aic", -45.1],
    ["forecast", "arima.rf.bic", -43.5],
    ["forecast", "arima.rf.ljungbox_p", 0.55],
    ["forecast", "arima.temp.aic", 14.2],
    ["forecast", "arima.temp.bic", 15.8],
    ["forecast", "arima.temp.ljungbox_p", 0.48],
    ["pfvi", "pfvi.mse", 14.82],
    ["pfvi", "pfvi.aH", 0.12],
    ["pfvi", "pfvi.bH", 0.09],
    ["pfvi", "pfvi.n", 1.84],
    ["pfvi", "pfvi.alpha", 2.15],
    ["pfvi", "pfvi.grid_evals", 164],
    ["pfvi", "pfvi.fit_seconds", 0.18],
    ["pfvi", "pfvi.flag.grid_truncated", 0],
    ["pfvi", "pfvi.h1.value", 268.0],
    ["pfvi", "pfvi.h1.class", 3],
    ["pfvi", "pfvi.h2.value", 276.5],
    ["pfvi", "pfvi.h2.class", 3],
    ["pfvi", "pfvi.h3.value", 282.1],
    ["pfvi", "pfvi.h3.class", 3],
    ["pfvi", "pfvi.h4.value", 285.4],
    ["pfvi", "pfvi.h4.class", 3],
  ],
  artifacts: [
    ["frames", "models/pfrsim-pipeline-sabangau-demo/frames.json", "9f3a8b..."],
    ["manifest", "models/pfrsim-pipeline-sabangau-demo/manifest.json", "4c1d2e..."],
  ],
};

const MOCK_LSTM_RUN_DETAIL: RunDetail = {
  summary: {
    run_id: "pfrsim-pipeline-sabangau-lstm",
    job_id: "job-lstm-1",
    dataset_id: "ds-sabangau-demo",
    dataset_name: "Sabangau Station Demo (8-point)",
    name: "Sabangau Deep Sequence (knn × lstm)",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    status: "DONE",
    imputer_id: "knn",
    forecaster_id: "lstm",
    h: 4,
    best_pfvi_mse: 11.45,
    seed: 42,
  },
  config_json: JSON.stringify({
    imputer: { id: "knn", k: 5 },
    forecaster: { id: "lstm", lstm: { look_back: 12, layer_units: [16], epochs: 100 } },
    pfvi: { h: 4, r0: 2700 },
  }),
  stages: [
    {
      stage: "validating",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "impute",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "forecast",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
    {
      stage: "pfvi",
      status: "DONE",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    },
  ],
  params: [
    ["imputer.id", "knn"],
    ["imputer.k", "5"],
    ["forecaster.id", "lstm"],
    ["lstm.look_back", "12"],
    ["lstm.epochs", "100"],
    ["lstm.layer_units", "16"],
    ["lstm.device", "gpu"],
    ["pfvi.h", "4"],
    ["pfvi.r0", "2700"],
    ["seed", "42"],
  ],
  metrics: [
    ["impute", "impute.n_imputed", 5],
    ["impute", "impute.frac_imputed", 0.156],
    ["forecast", "forecast.wt.mse", 0.018],
    ["forecast", "forecast.wt.rmse", 0.134],
    ["forecast", "forecast.wt.mae", 0.098],
    ["forecast", "forecast.sm.mse", 0.32],
    ["forecast", "forecast.sm.rmse", 0.565],
    ["forecast", "forecast.sm.mae", 0.41],
    ["forecast", "forecast.rf.mse", 0.000008],
    ["forecast", "forecast.rf.rmse", 0.0028],
    ["forecast", "forecast.rf.mae", 0.0019],
    ["forecast", "forecast.temp.mse", 0.14],
    ["forecast", "forecast.temp.rmse", 0.374],
    ["forecast", "forecast.temp.mae", 0.28],
    ["forecast", "lstm.wt.look_back", 12],
    ["forecast", "lstm.wt.hidden_units", 16],
    ["forecast", "lstm.wt.final_loss", 0.014],
    ["forecast", "lstm.sm.look_back", 12],
    ["forecast", "lstm.sm.hidden_units", 16],
    ["forecast", "lstm.sm.final_loss", 0.021],
    ["forecast", "lstm.rf.look_back", 12],
    ["forecast", "lstm.rf.hidden_units", 16],
    ["forecast", "lstm.rf.final_loss", 0.005],
    ["forecast", "lstm.temp.look_back", 12],
    ["forecast", "lstm.temp.hidden_units", 16],
    ["forecast", "lstm.temp.final_loss", 0.011],
    ["pfvi", "pfvi.mse", 11.45],
    ["pfvi", "pfvi.aH", 0.118],
    ["pfvi", "pfvi.bH", 0.088],
    ["pfvi", "pfvi.n", 1.82],
    ["pfvi", "pfvi.alpha", 2.11],
    ["pfvi", "pfvi.grid_evals", 142],
    ["pfvi", "pfvi.fit_seconds", 0.14],
    ["pfvi", "pfvi.flag.grid_truncated", 0],
    ["pfvi", "pfvi.h1.value", 242.0],
    ["pfvi", "pfvi.h1.class", 2],
    ["pfvi", "pfvi.h2.value", 251.5],
    ["pfvi", "pfvi.h2.class", 2],
    ["pfvi", "pfvi.h3.value", 259.0],
    ["pfvi", "pfvi.h3.class", 2],
    ["pfvi", "pfvi.h4.value", 264.8],
    ["pfvi", "pfvi.h4.class", 2],
  ],
  artifacts: [
    ["frames", "models/pfrsim-pipeline-sabangau-lstm/frames.json", "8e2b1c..."],
    ["manifest", "models/pfrsim-pipeline-sabangau-lstm/manifest.json", "3a5f6d..."],
  ],
};

const mockDatasets: DatasetSummary[] = [
  {
    id: "ds-sabangau-demo",
    name: "Sabangau Peatland Station (192-day)",
    csv_sha: "9f3a8bc1d4e2...",
    n: 192,
    missing_total: 5,
    run_count: 2,
    created_at: new Date().toISOString(),
  },
];

let mockRuns: RunDetail[] = [MOCK_RUN_DETAIL, MOCK_LSTM_RUN_DETAIL];
let importedFramesMap: Record<string, SimulationFrame[]> = {};
let mockJobs: JobRecord[] = [
  {
    job_id: "job-b1973470626c",
    dataset_id: "ds-sabangau-demo",
    config_hash: "LSTM-Neural",
    seed: 42,
    status: "running",
    stage: "forecasting (WT epoch 86/100)",
    progress: 0.34,
    epoch: 86,
    total_epochs: 100,
    current_var: "WT",
    run_id: null,
    error: null,
    created_at: new Date(Date.now() - 14900).toISOString(),
    duration_seconds: 14.9,
  },
  {
    job_id: "job-demo-1",
    dataset_id: "ds-sabangau-demo",
    config_hash: "cfg42",
    seed: 42,
    status: "done",
    stage: "done",
    progress: 1.0,
    run_id: "pfrsim-pipeline-sabangau-demo",
    error: null,
    created_at: new Date().toISOString(),
  },
];
function handleBrowserMock<T>(cmd: string, _args?: Record<string, unknown>): CommandResult<T> {
  switch (cmd) {
    case "dataset_inspect": {
      const input = _args as { fileName?: string } | undefined;
      const fileName = input?.fileName || "dataset.csv";
      return {
        ok: true,
        data: {
          file_name: fileName,
          format: fileName.endsWith(".parquet")
            ? "parquet"
            : fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
              ? "excel"
              : "csv",
          detected_columns: ["Waktu", "TMA_m", "Kadar_Air_pct", "Curah_Hujan_mm", "Suhu_C"],
          row_count_estimate: 192,
          sample_rows: [
            {
              Waktu: "2023-10-01",
              TMA_m: "-1.021",
              Kadar_Air_pct: "35.42",
              Curah_Hujan_mm: "0.0",
              Suhu_C: "35.4",
            },
            {
              Waktu: "2023-10-02",
              TMA_m: "-0.972",
              Kadar_Air_pct: "34.80",
              Curah_Hujan_mm: "0.0",
              Suhu_C: "35.8",
            },
            {
              Waktu: "2023-10-03",
              TMA_m: "-1.105",
              Kadar_Air_pct: "37.26",
              Curah_Hujan_mm: "0.001",
              Suhu_C: "36.2",
            },
          ],
          suggested_mapping: {
            WT: "TMA_m",
            SM: "Kadar_Air_pct",
            Rf: "Curah_Hujan_mm",
            Temp: "Suhu_C",
            Time: "Waktu",
          },
        } as T,
      };
    }

    case "dataset_import_mapped": {
      const input = _args as
        | {
            fileName?: string;
            customName?: string;
            mapping?: Record<string, string>;
          }
        | undefined;
      const fileName = input?.fileName || "mapped_dataset.csv";
      const cleanBase = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
      const id = `ds-${Date.now()}`;
      const uniqueSuffix = id.slice(-6);
      const name = input?.customName?.trim() || `${cleanBase} (${uniqueSuffix})`;
      const newDs: DatasetSummary = {
        id,
        name,
        csv_sha: "mapped-sha-256",
        n: 192,
        missing_total: 5,
        run_count: 0,
        created_at: new Date().toISOString(),
      };
      mockDatasets.unshift(newDs);
      return {
        ok: true,
        data: {
          dataset_id: id,
          preview: MOCK_PREVIEW,
          was_existing: false,
        } as T,
      };
    }

    case "dataset_import": {
      const input = _args as { name?: string } | undefined;
      const name = input?.name || "Imported Dataset.csv";
      const id = `ds-${Date.now()}`;
      const newDs: DatasetSummary = {
        id,
        name,
        csv_sha: "custom-sha-256",
        n: 120,
        missing_total: 3,
        run_count: 0,
        created_at: new Date().toISOString(),
      };
      mockDatasets.unshift(newDs);
      return {
        ok: true,
        data: {
          dataset_id: id,
          preview: MOCK_PREVIEW,
          was_existing: false,
        } as T,
      };
    }

    case "datasets_list":
      if (mockDatasets.length === 0) {
        mockDatasets.push({
          id: "ds-sabangau-demo",
          name: "Sabangau Peatland Station (192-day)",
          csv_sha: "9f3a8bc1d4e2...",
          n: 192,
          missing_total: 5,
          run_count: 2,
          created_at: new Date().toISOString(),
        });
      }
      return {
        ok: true,
        data: [...mockDatasets] as T,
      };

    case "dataset_get_preview":
      return { ok: true, data: MOCK_PREVIEW as T };

    case "capability_query":
      return {
        ok: true,
        data: {
          imputers: [
            {
              id: "knn",
              name: "k-Nearest Neighbors (kNN)",
              enabled: true,
              description: "Joint 4-variable Euclidean distance",
              params_schema: {},
              tooltip: "VIM::kNN equivalent",
            },
            {
              id: "linear",
              name: "Linear Interpolation",
              enabled: true,
              description: "Fast linear interpolation",
              params_schema: {},
              tooltip: "zoo::na.approx equivalent",
            },
            {
              id: "spline",
              name: "Cubic Spline",
              enabled: true,
              description: "Smooth cubic spline",
              params_schema: {},
              tooltip: "zoo::na.spline equivalent",
            },
            {
              id: "loess",
              name: "LOESS",
              enabled: true,
              description: "Local regression smoothing",
              params_schema: {},
              tooltip: "Cleveland's local regression",
            },
          ],
          forecasters: [
            {
              id: "arima",
              name: "AutoARIMA + Box-Cox",
              enabled: true,
              description: "Automated ARIMA order search",
              reason: null,
              params_schema: {},
              tooltip:
                "Automated statistical model best suited for seasonal trends and baseline forecasts",
            },
            {
              id: "lstm",
              name: "LSTM",
              enabled: true,
              description: "Deep recurrent network with Adam optimizer",
              reason: null,
              params_schema: {},
              tooltip:
                "Deep learning neural network capable of capturing long-term temporal patterns",
            },
            {
              id: "gru",
              name: "GRU",
              enabled: true,
              description: "Gated recurrent unit with Adam optimizer",
              reason: null,
              params_schema: {},
              tooltip: "Fast and efficient neural network for learning dynamic peatland trends",
            },
          ],
        } as T,
      };

    case "gpu_spec_query":
      return {
        ok: true,
        data: {
          name: "Hardware GPU Accelerator",
          vram_mb: 4096,
          driver_version: "Standard Graphics Driver",
          tier: "Hardware GPU Device",
          score: 78,
          backend: "WebGPU / Vulkan / DirectX",
          estimated_speedup: "~3.5x – 5x vs CPU",
        } as T,
      };

    case "pipeline_run":
      return { ok: true, data: { job_id: "job-demo-1" } as T };

    case "pipeline_job_status":
      return {
        ok: true,
        data: {
          job_id: "job-demo-1",
          dataset_id: "ds-sabangau-demo",
          config_hash: "cfg42",
          seed: 42,
          status: "done",
          stage: "done",
          progress: 1.0,
          run_id: "pfrsim-pipeline-sabangau-demo",
          error: null,
          created_at: new Date().toISOString(),
        } as T,
      };

    case "pipeline_jobs_list":
      return {
        ok: true,
        data: [...mockJobs] as T,
      };

    case "pipeline_job_delete": {
      const jobId = (_args as { jobId?: string })?.jobId;
      mockJobs = mockJobs.filter((j) => j.job_id !== jobId);
      return { ok: true, data: true as T };
    }

    case "runs_list":
      if (mockRuns.length === 0) {
        mockRuns = [MOCK_RUN_DETAIL, MOCK_LSTM_RUN_DETAIL];
      }
      return {
        ok: true,
        data: mockRuns.map((r) => r.summary) as T,
      };

    case "run_get": {
      const runId = (_args as { runId?: string })?.runId;
      if (mockRuns.length === 0) {
        mockRuns = [MOCK_RUN_DETAIL, MOCK_LSTM_RUN_DETAIL];
      }
      const found = mockRuns.find((r) => r.summary.run_id === runId) || mockRuns[0];
      return { ok: true, data: found as T };
    }
    case "run_delete": {
      const runId = (_args as { runId?: string })?.runId;
      mockRuns = mockRuns.filter((r) => r.summary.run_id !== runId);
      return { ok: true, data: true as T };
    }
    case "artifact_load_frames": {
      const { runId } = (_args || {}) as { runId?: string };
      if (runId && importedFramesMap[runId]) {
        return { ok: true, data: importedFramesMap[runId] as T };
      }
      return { ok: true, data: MOCK_FRAMES as T };
    }

    case "artifact_load_manifest":
      return {
        ok: true,
        data: {
          run_id: "pfrsim-pipeline-sabangau-demo",
          dataset_id: "ds-sabangau-demo",
          csv_sha: "9f3a8b...",
          config: {},
          seed: 42,
          crate_versions: { "pfrsim-core": "0.1.0" },
          frames_sha256: "9f3a8b0c1d2e...",
          created_at: new Date().toISOString(),
          peatfr_parity: true,
        } as T,
      };

    case "run_import": {
      const {
        name,
        frames: impFrames,
        manifestData,
      } = (_args || {}) as {
        name?: string;
        frames?: SimulationFrame[];
        manifestData?: unknown;
      };
      const runId = `imported-${Date.now()}`;
      const fList = impFrames || MOCK_FRAMES;
      importedFramesMap[runId] = fList;
      const newSummary: RunSummary = {
        run_id: runId,
        job_id: `job-${runId}`,
        dataset_id: "ds-sabangau-demo",
        dataset_name: "Sabangau Peatland Station (192-day)",
        name: name || "Imported Run",
        created_at: new Date().toISOString(),
        status: "DONE",
        imputer_id: "imported",
        forecaster_id: "imported",
        h: fList.filter((f) => f.is_forecast).length,
        best_pfvi_mse: null,
        seed: 42,
      };
      const newDetail: RunDetail = {
        summary: newSummary,
        config_json: JSON.stringify(manifestData || {}),
        stages: [],
        params: [
          ["app", "pfrsim"],
          ["imported", "true"],
        ],
        metrics: [],
        artifacts: [["frames", `models/${runId}/frames.json`, "imported"]],
      };
      mockRuns.unshift(newDetail);
      return { ok: true, data: newSummary as unknown as T };
    }

    case "dialog_save_file": {
      const { defaultName } = (_args || {}) as { defaultName?: string };
      return { ok: true, data: (defaultName || "pfrsim-export.png") as unknown as T };
    }
    case "dialog_pick_folder": {
      return { ok: true, data: "exports" as unknown as T };
    }

    case "save_binary_file":
    case "save_text_file":
      return { ok: true, data: "saved" as unknown as T };

    case "artifact_export": {
      const fmt = (_args as { format?: string })?.format;
      const rId = (_args as { runId?: string })?.runId ?? "run-1";
      const exportPath =
        fmt === "mlflow"
          ? `exports/mlflow_${rId}`
          : fmt === "onnx"
            ? `exports/onnx_${rId}`
            : `exports/${rId}_frames.csv`;
      return {
        ok: true,
        data: { path: exportPath } as unknown as T,
      };
    }
    case "pipeline_cancel":
      return { ok: true, data: { cancelled: true } as unknown as T };

    case "dataset_update_name": {
      const { datasetId, name } = _args as { datasetId: string; name: string };
      const found = mockDatasets.find((d) => d.id === datasetId);
      if (found) found.name = name;
      return { ok: true, data: undefined as unknown as T };
    }

    case "dataset_delete": {
      const { datasetId } = _args as { datasetId: string };
      const idx = mockDatasets.findIndex((d) => d.id === datasetId);
      if (idx >= 0) mockDatasets.splice(idx, 1);
      return { ok: true, data: undefined as unknown as T };
    }
    case "dialog_pick_file":
      return { ok: true, data: null as unknown as T };

    case "dataset_get_detail": {
      const { datasetId } = _args as { datasetId: string };
      const prev = handleBrowserMock<DatasetPreview>("dataset_get_preview", { datasetId });
      if (!prev.ok) return prev as unknown as CommandResult<T>;
      const found = mockDatasets.find((d) => d.id === datasetId);
      const rows = prev.data.head;
      return {
        ok: true,
        data: {
          dataset_id: datasetId,
          name: found?.name ?? "Dataset",
          n: found?.n ?? rows.length,
          columns: {
            wt: rows.map((r) => r.wt),
            sm: rows.map((r) => r.sm),
            rf: rows.map((r) => r.rf),
            temp: rows.map((r) => r.temp),
          },
          preview: prev.data,
        } as T,
      };
    }

    case "dataset_stl_decomposition": {
      const { datasetId, series, period, method } = _args as {
        datasetId: string;
        series: string;
        period?: number;
        method?: "stl" | "trend";
      };
      const prev = handleBrowserMock<DatasetPreview>("dataset_get_preview", { datasetId });
      if (!prev.ok) return prev as unknown as CommandResult<T>;
      const key = (series ?? "wt").toLowerCase() as "wt" | "sm" | "rf" | "temp";
      const rows = prev.data.head;
      const raw = rows.map((r) => r[key]);
      const useSynthetic = key === "rf" && MOCK_RF_OBSERVED.length === raw.length;
      const observed = useSynthetic ? MOCK_RF_OBSERVED : raw;
      const p = period ?? 12;
      const isTrend = method === "trend";

      const trend = observed.map((v) => (v != null ? Number(v) : null));
      const seasonal = observed.map((_, i) =>
        isTrend ? 0 : Math.sin((2 * Math.PI * i) / p) * 0.2,
      );
      const remainder = observed.map((v, i) =>
        v != null ? Number(v) - (trend[i] ?? 0) - (seasonal[i] ?? 0) : null,
      );

      return {
        ok: true,
        data: {
          period: p,
          method: isTrend ? "trend" : "stl",
          trend_strength: 0.997,
          seasonal_strength: isTrend ? 0.0 : 0.966,
          observed,
          trend,
          seasonal,
          remainder,
        } as T,
      };
    }
    case "dataset_autocorrelation": {
      const { maxLag } = _args as { maxLag?: number };
      const m = maxLag ?? 39;
      const acf = [1.0];
      const pacf = [1.0];
      for (let k = 1; k <= m; k++) {
        acf.push(Math.cos(k * 0.4) * Math.exp(-k * 0.05));
        pacf.push(k === 1 ? 0.9 : Math.sin(k * 0.8) * Math.exp(-k * 0.15));
      }
      return {
        ok: true,
        data: {
          max_lag: m,
          confidence_band: 0.18,
          acf,
          pacf,
        } as T,
      };
    }
    case "dataset_get_rows": {
      const { datasetId, offset, limit } = _args as {
        datasetId: string;
        offset?: number;
        limit?: number;
      };
      const prev = handleBrowserMock<DatasetPreview>("dataset_get_preview", { datasetId });
      if (!prev.ok) return prev as unknown as CommandResult<T>;
      const off = offset ?? 0;
      const lim = limit ?? 50;
      const all = prev.data.head;
      const slice = all.slice(off, off + lim);
      return {
        ok: true,
        data: {
          total: all.length,
          offset: off,
          limit: lim,
          rows: slice,
        } as T,
      };
    }
    case "dataset_get_series_downsampled": {
      const { datasetId, series, maxPoints } = _args as {
        datasetId: string;
        series: string;
        maxPoints?: number;
      };
      const prev = handleBrowserMock<DatasetPreview>("dataset_get_preview", { datasetId });
      if (!prev.ok) return prev as unknown as CommandResult<T>;
      const key = (series ?? "wt").toLowerCase() as "wt" | "sm" | "rf" | "temp";
      const rows = prev.data.head;
      const x = rows.map((_, i) => i + 1);
      const y = rows.map((r) => r[key]);
      return {
        ok: true,
        data: {
          series: key,
          total_points: rows.length,
          downsampled_points: Math.min(rows.length, maxPoints ?? 2500),
          x,
          y,
        } as T,
      };
    }
    default:
      return { ok: false, code: "UNKNOWN_COMMAND", message: `Command not found: ${cmd}` };
  }
}

// Safe invoke wrapper
async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<CommandResult<T>> {
  if (!isTauri()) {
    // When running inside web browser without Tauri shell, use deterministic mock provider
    return handleBrowserMock<T>(cmd, args);
  }
  try {
    const res = await invoke<CommandResult<T>>(cmd, args);
    return res;
  } catch (err: unknown) {
    return {
      ok: false,
      code: "INVOKE_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function datasetImport(args: {
  path?: string;
  pasted_text?: string;
  name?: string;
}): Promise<CommandResult<DatasetImportOutput>> {
  return safeInvoke<DatasetImportOutput>("dataset_import", { args });
}

export async function datasetsList(): Promise<CommandResult<DatasetSummary[]>> {
  return safeInvoke<DatasetSummary[]>("datasets_list");
}

export async function datasetGetPreview(datasetId: string): Promise<CommandResult<DatasetPreview>> {
  return safeInvoke<DatasetPreview>("dataset_get_preview", { datasetId });
}

export async function datasetGetDetail(datasetId: string): Promise<CommandResult<DatasetDetail>> {
  return safeInvoke<DatasetDetail>("dataset_get_detail", { datasetId });
}

export async function datasetStlDecomposition(
  datasetId: string,
  series: string,
  period?: number,
  method?: "stl" | "trend",
): Promise<CommandResult<StlDecompositionView>> {
  return safeInvoke<StlDecompositionView>("dataset_stl_decomposition", {
    datasetId,
    series,
    period,
    method,
  });
}
export async function datasetAutocorrelation(
  datasetId: string,
  series: string,
  maxLag?: number,
): Promise<CommandResult<AutocorrelationView>> {
  return safeInvoke<AutocorrelationView>("dataset_autocorrelation", {
    datasetId,
    series,
    maxLag,
  });
}
export async function datasetGetRows(
  datasetId: string,
  offset?: number,
  limit?: number,
): Promise<CommandResult<DatasetRowsPage>> {
  return safeInvoke<DatasetRowsPage>("dataset_get_rows", {
    datasetId,
    offset,
    limit,
  });
}

export async function datasetGetSeriesDownsampled(
  datasetId: string,
  series: string,
  maxPoints?: number,
): Promise<CommandResult<DownsampledSeries>> {
  return safeInvoke<DownsampledSeries>("dataset_get_series_downsampled", {
    datasetId,
    series,
    maxPoints,
  });
}

export async function datasetGetAllSeriesDownsampled(
  datasetId: string,
  maxPoints?: number,
): Promise<CommandResult<AllDownsampledSeries>> {
  return safeInvoke<AllDownsampledSeries>("dataset_get_all_series_downsampled", {
    datasetId,
    maxPoints,
  });
}

export async function datasetUpdateName(
  datasetId: string,
  name: string,
): Promise<CommandResult<void>> {
  return safeInvoke<void>("dataset_update_name", { datasetId, name });
}

export async function datasetDelete(datasetId: string): Promise<CommandResult<void>> {
  return safeInvoke<void>("dataset_delete", { datasetId });
}

export async function capabilityQuery(): Promise<CommandResult<CapabilityQueryOutput>> {
  return safeInvoke<CapabilityQueryOutput>("capability_query");
}

export async function gpuSpecQuery(): Promise<CommandResult<GpuInfo>> {
  return safeInvoke<GpuInfo>("gpu_spec_query");
}
export async function pipelineRun(
  datasetId: string,
  config: PipelineConfig,
  seed?: number,
): Promise<CommandResult<PipelineRunOutput>> {
  return safeInvoke<PipelineRunOutput>("pipeline_run", {
    datasetId,
    config,
    seed: seed ?? null,
  });
}

export async function pipelineJobStatus(jobId: string): Promise<CommandResult<JobRecord>> {
  return safeInvoke<JobRecord>("pipeline_job_status", { jobId });
}

export async function pipelineJobsList(datasetId?: string): Promise<CommandResult<JobRecord[]>> {
  return safeInvoke<JobRecord[]>("pipeline_jobs_list", {
    datasetId: datasetId ?? null,
  });
}

export async function pipelineCancel(
  jobId: string,
): Promise<CommandResult<{ cancelled: boolean }>> {
  return safeInvoke<{ cancelled: boolean }>("pipeline_cancel", { jobId });
}

export async function pipelineJobDelete(jobId: string): Promise<CommandResult<boolean>> {
  return safeInvoke<boolean>("pipeline_job_delete", { jobId });
}

export async function runsList(
  limit?: number,
  offset?: number,
  datasetId?: string,
): Promise<CommandResult<RunSummary[]>> {
  return safeInvoke<RunSummary[]>("runs_list", {
    limit: limit ?? 50,
    offset: offset ?? 0,
    datasetId: datasetId ?? null,
  });
}

export async function runGet(runId: string): Promise<CommandResult<RunDetail>> {
  return safeInvoke<RunDetail>("run_get", { runId });
}

export async function runDelete(runId: string): Promise<CommandResult<boolean>> {
  return safeInvoke<boolean>("run_delete", { runId });
}
export async function artifactLoadFrames(runId: string): Promise<CommandResult<SimulationFrame[]>> {
  return safeInvoke<SimulationFrame[]>("artifact_load_frames", { runId });
}

export async function artifactLoadManifest(runId: string): Promise<CommandResult<Manifest>> {
  return safeInvoke<Manifest>("artifact_load_manifest", { runId });
}

export async function runImport(
  name: string,
  frames: SimulationFrame[],
  manifestData?: unknown,
): Promise<CommandResult<RunSummary>> {
  return safeInvoke<RunSummary>("run_import", {
    name,
    frames,
    manifestData: manifestData ?? null,
  });
}

export async function dialogSaveFile(
  defaultName?: string,
  extension?: string,
  description?: string,
): Promise<CommandResult<string | null>> {
  if (isTauri()) {
    return safeInvoke<string | null>("dialog_save_file", {
      defaultName,
      extension,
      description,
    });
  }
  return { ok: true, data: defaultName || null };
}
export async function dialogPickFolder(title?: string): Promise<CommandResult<string | null>> {
  if (isTauri()) {
    return safeInvoke<string | null>("dialog_pick_folder", { title });
  }
  if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
    try {
      // @ts-expect-error File System Access API
      const handle = await window.showDirectoryPicker();
      return { ok: true, data: handle.name };
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") {
        return { ok: true, data: null };
      }
    }
  }
  return { ok: true, data: null };
}
export async function dialogPickFile(title?: string): Promise<CommandResult<string | null>> {
  if (isTauri()) {
    return safeInvoke<string | null>("dialog_pick_file", { title });
  }
  return { ok: true, data: null };
}

export async function saveBinaryFile(
  filePath: string,
  bytes: number[] | Uint8Array,
): Promise<CommandResult<string>> {
  if (isTauri()) {
    const bytesArray = Array.from(bytes);
    return safeInvoke<string>("save_binary_file", { filePath, bytes: bytesArray });
  }
  return { ok: true, data: filePath };
}

export async function saveTextFile(
  filePath: string,
  content: string,
): Promise<CommandResult<string>> {
  if (isTauri()) {
    return safeInvoke<string>("save_text_file", { filePath, content });
  }
  return { ok: true, data: filePath };
}

export async function artifactExport(
  runId: string,
  format: "csv" | "mlflow" | "onnx",
  destinationPath?: string,
): Promise<CommandResult<{ path: string }>> {
  return safeInvoke<{ path: string }>("artifact_export", { runId, format, destinationPath });
}

export async function datasetInspect(
  fileName: string,
  filePath?: string,
  rawBytes?: number[],
): Promise<CommandResult<DatasetInspection>> {
  return safeInvoke<DatasetInspection>("dataset_inspect", {
    fileName,
    filePath: filePath ?? null,
    rawBytes: rawBytes ?? null,
  });
}

export async function datasetImportMapped(
  fileName: string,
  mapping: Record<string, string>,
  filePath?: string,
  rawBytes?: number[],
  customName?: string,
): Promise<CommandResult<DatasetImportOutput>> {
  return safeInvoke<DatasetImportOutput>("dataset_import_mapped", {
    fileName,
    mapping,
    filePath: filePath ?? null,
    rawBytes: rawBytes ?? null,
    customName: customName && customName.trim().length > 0 ? customName.trim() : null,
  });
}

export async function listenPipelineProgress(
  callback: (payload: ProgressEventPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  return listen<ProgressEventPayload>("pipeline-progress", (event) => {
    callback(event.payload);
  });
}

export async function openUrl(url: string): Promise<CommandResult<null>> {
  if (isTauri()) {
    try {
      return await safeInvoke<null>("open_url", { url });
    } catch {}
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return { ok: true, data: null };
}
