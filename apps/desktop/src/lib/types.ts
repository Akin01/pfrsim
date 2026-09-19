export type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fields?: string[] };

export type TimeKind = "index" | "date";

export interface SeriesStats {
  min: number;
  max: number;
  mean: number;
  std?: number | null;
  acf1?: number | null;
  trend?: { direction: "rising" | "falling" | "flat"; slope: number } | null;
  seasonality?: { seasonal: boolean; period: number | null; strength: number } | null;
  stationarity?: { stationary: boolean; mean_shift: number; var_ratio: number } | null;
  decomposition?: {
    period: number;
    trend: (number | null)[];
    seasonal: number[];
    remainder: (number | null)[];
    trend_strength?: number;
    seasonal_strength?: number;
  } | null;
}

/** STL decomposition enriched with the raw observed series and post-metrics. */
export interface StlDecompositionView {
  period: number;
  method: "stl" | "trend";
  trend_strength: number;
  seasonal_strength: number;
  observed: (number | null)[];
  trend: (number | null)[];
  seasonal: (number | null)[];
  remainder: (number | null)[];
}
export interface AutocorrelationView {
  max_lag: number;
  confidence_band: number;
  acf: number[];
  pacf: number[];
}
export interface DatasetRowsPage {
  total: number;
  offset: number;
  limit: number;
  rows: RowPreview[];
}

export interface DownsampledSeries {
  series: string;
  total_points: number;
  downsampled_points: number;
  x: number[];
  y: (number | null)[];
}

export interface AllDownsampledSeries {
  wt: DownsampledSeries;
  sm: DownsampledSeries;
  rf: DownsampledSeries;
  temp: DownsampledSeries;
}

export interface ColumnStats {
  wt: SeriesStats | null;
  sm: SeriesStats | null;
  rf: SeriesStats | null;
  temp: SeriesStats | null;
}

export interface MissingSeries {
  count: number;
  indices: number[];
}

export interface MissingInfo {
  total: number;
  wt: MissingSeries;
  sm: MissingSeries;
  rf: MissingSeries;
  temp: MissingSeries;
}

export interface RowPreview {
  t: number;
  time_label: string | null;
  wt: number | null;
  sm: number | null;
  rf: number | null;
  temp: number | null;
}

export interface ValidationVerdict {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}
export interface DatasetPreview {
  stats: ColumnStats;
  missing: MissingInfo;
  head: RowPreview[];
  tail: RowPreview[];
  verdict: ValidationVerdict;
}

export interface ColumnData {
  wt: (number | null)[];
  sm: (number | null)[];
  rf: (number | null)[];
  temp: (number | null)[];
}

export interface DatasetDetail {
  dataset_id: string;
  name: string;
  n: number;
  columns: ColumnData;
  preview: DatasetPreview;
}

export interface DatasetSummary {
  id: string;
  name: string;
  csv_sha: string;
  n: number;
  missing_total: number;
  run_count: number;
  created_at: string;
}

export interface DatasetImportOutput {
  dataset_id: string;
  preview: DatasetPreview;
  was_existing: boolean;
}

export interface ImputerDescriptor {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  params_schema: Record<string, unknown>;
  tooltip: string;
}

export interface ForecasterDescriptor {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  reason: string | null;
  params_schema: Record<string, unknown>;
  tooltip: string;
}

export interface GpuInfo {
  name: string;
  vram_mb?: number | null;
  driver_version?: string | null;
  tier: string;
  score: number;
  backend: string;
  estimated_speedup: string;
}

export interface CapabilityQueryOutput {
  imputers: ImputerDescriptor[];
  forecasters: ForecasterDescriptor[];
  gpu_available?: boolean;
  gpu_name?: string | null;
  gpu_info?: GpuInfo | null;
}

export interface ImputerConfig {
  id: string;
  k: number;
  span: number;
}

export interface ArimaConfig {
  test_split_ratio: number;
  learning_rate?: number;
}

export interface NnConfig {
  look_back: number;
  layer_units: number[];
  epochs: number;
  batch_size: number;
  learning_rate?: number;
  device?: "cpu" | "gpu" | string;
}

export interface ForecasterConfig {
  id: string;
  arima: ArimaConfig;
  lstm: NnConfig | null;
  gru: NnConfig | null;
}

export interface PfviConfig {
  r0: number;
  dt: number;
  h: number;
  fc: number;
  sat: number;
  max_grid_m: number;
  timeout_s: number;
}

export interface PipelineConfig {
  imputer: ImputerConfig;
  forecaster: ForecasterConfig;
  pfvi: PfviConfig;
  seed: number;
}

export interface JobRecord {
  job_id: string;
  dataset_id: string;
  config_hash: string;
  seed: number;
  status: "queued" | "running" | "done" | "error";
  stage: string | null;
  progress: number;
  run_id: string | null;
  error: string | null;
  created_at: string;
  finished_at?: string | null;
  duration_seconds?: number | null;
  epoch?: number | null;
  total_epochs?: number | null;
  current_var?: string | null;
  sub_step?: string | null;
  var_epochs?: Record<string, number> | null;
  dataset_name?: string | null;
  config_json?: string | null;
}

export interface StageRecord {
  stage: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}

export interface RunSummary {
  run_id: string;
  job_id: string;
  dataset_id: string;
  dataset_name: string | null;
  name: string;
  created_at: string;
  status: string;
  imputer_id: string | null;
  forecaster_id: string | null;
  h: number;
  best_pfvi_mse: number | null;
  seed: number;
}

export interface RunDetail {
  summary: RunSummary;
  config_json: string;
  stages: StageRecord[];
  params: [string, string][];
  metrics: [string, string, number][]; // stage, key, value
  artifacts: [string, string, string][]; // kind, path, sha256
}

export interface FrameImputed {
  wt: boolean;
  sm: boolean;
  rf: boolean;
  temp: boolean;
}

export interface SimulationFrame {
  t: number;
  time_label: string | null;
  wt: number;
  sm: number;
  rf: number;
  temp: number;
  pfvi: number;
  diobs: number;
  class: "Low" | "Moderate" | "High" | "Extreme";
  class_code: number; // 0, 1, 2, 3
  is_forecast: boolean;
  imputed: FrameImputed;
  water_distribution: number;
  rainfall_effect: number;
  soil_fluctuation: number;
  water_depth: number;
}

export interface Manifest {
  run_id: string;
  dataset_id: string;
  csv_sha: string;
  config: PipelineConfig;
  seed: number;
  crate_versions: Record<string, string>;
  frames_sha256: string;
  created_at: string;
  peatfr_parity: boolean;
}

export interface ProgressEventPayload {
  job_id: string;
  stage: string;
  progress: number;
  epoch?: number | null;
  total_epochs?: number | null;
  current_var?: string | null;
  sub_step?: string | null;
  var_epochs?: Record<string, number> | null;
}

export interface PipelineRunOutput {
  job_id: string;
}
export interface DatasetInspection {
  file_name: string;
  format: "csv" | "excel" | "parquet";
  detected_columns: string[];
  row_count_estimate: number;
  sample_rows: Record<string, string | null>[];
  suggested_mapping: Record<string, string>;
}

export interface ColumnMapping {
  wt: string;
  sm: string;
  rf: string;
  temp: string;
  time?: string | null;
}
