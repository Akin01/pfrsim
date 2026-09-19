use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

use pfrsim_core::artifact::{
    export_frames_to_csv, export_run_to_mlflow, export_run_to_onnx, load_frames, load_manifest,
    Manifest, SimulationFrame,
};
use pfrsim_core::error::{CommandOutput, PfrsimError};
use pfrsim_core::forecaster::{list_forecasters, ForecasterDescriptor};
use pfrsim_core::imputer::{list_imputers, ImputerDescriptor};
use pfrsim_core::ingest::{parse_csv, ColumnData, DatasetPreview};
use pfrsim_core::pipeline::{
    execute_pipeline, PipelineConfig, PipelineProgressInfo, ProgressCallback,
};
use pfrsim_core::runstore::{DatasetSummary, JobRecord, RunDetail, RunSummary};

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetImportArgs {
    pub path: Option<String>,
    pub pasted_text: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetImportOutput {
    pub dataset_id: String,
    pub preview: DatasetPreview,
    pub was_existing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub name: String,
    pub vram_mb: Option<u64>,
    pub driver_version: Option<String>,
    pub tier: String,
    pub score: u32,
    pub backend: String,
    pub estimated_speedup: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityQueryOutput {
    pub imputers: Vec<ImputerDescriptor>,
    pub forecasters: Vec<ForecasterDescriptor>,
    #[serde(default)]
    pub gpu_available: bool,
    #[serde(default)]
    pub gpu_name: Option<String>,
    #[serde(default)]
    pub gpu_info: Option<GpuInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineRunOutput {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelOutput {
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOutput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEventPayload {
    pub job_id: String,
    pub stage: String,
    pub progress: f64,
    pub epoch: Option<usize>,
    pub total_epochs: Option<usize>,
    pub current_var: Option<String>,
    #[serde(default)]
    pub sub_step: Option<String>,
    #[serde(default)]
    pub var_epochs: Option<std::collections::HashMap<String, usize>>,
}
pub const MAX_CONCURRENT_JOBS: usize = 8;

#[tauri::command]
pub fn dataset_import(
    state: State<'_, AppState>,
    args: DatasetImportArgs,
) -> CommandOutput<DatasetImportOutput> {
    let (csv_content, name) = if let Some(path_str) = &args.path {
        let p = PathBuf::from(path_str);
        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("imported.csv")
            .to_string();
        let content = match fs::read_to_string(&p) {
            Ok(c) => c,
            Err(e) => return CommandOutput::Failure(PfrsimError::io(e)),
        };
        (content, args.name.unwrap_or(file_name))
    } else if let Some(text) = args.pasted_text {
        (
            text,
            args.name
                .unwrap_or_else(|| "pasted_dataset.csv".to_string()),
        )
    } else {
        return CommandOutput::Failure(PfrsimError::validation(
            "VALIDATION_EMPTY_INPUT",
            "Either file path or pasted CSV text must be provided",
            None,
        ));
    };

    let dataset = match parse_csv(&csv_content, &name) {
        Ok(ds) => ds,
        Err(e) => return CommandOutput::Failure(e),
    };

    // Deduplication check: identical csv_sha returns existing dataset
    if let Ok(Some(existing)) = state.runstore.find_dataset_by_sha(&dataset.csv_sha) {
        return CommandOutput::Success(DatasetImportOutput {
            dataset_id: existing.dataset_id,
            preview: existing.preview,
            was_existing: true,
        });
    }

    if let Err(e) = state.runstore.save_dataset(&dataset) {
        return CommandOutput::Failure(e);
    }

    CommandOutput::Success(DatasetImportOutput {
        dataset_id: dataset.dataset_id,
        preview: dataset.preview,
        was_existing: false,
    })
}

#[tauri::command]
pub fn datasets_list(state: State<'_, AppState>) -> CommandOutput<Vec<DatasetSummary>> {
    match state.runstore.list_datasets() {
        Ok(list) => CommandOutput::Success(list),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn dataset_get_preview(
    state: State<'_, AppState>,
    dataset_id: String,
) -> CommandOutput<DatasetPreview> {
    match state.runstore.get_dataset_preview(&dataset_id) {
        Ok(Some(prev)) => CommandOutput::Success(prev),
        Ok(None) => CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id)),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetDetail {
    pub dataset_id: String,
    pub name: String,
    pub n: usize,
    pub columns: ColumnData,
    pub preview: DatasetPreview,
}

/// STL decomposition enriched with the raw observed series, serialized
/// with NaN-safe Option encoding so the frontend charts gaps correctly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StlDecompositionView {
    pub period: usize,
    pub method: String,
    pub trend_strength: f64,
    pub seasonal_strength: f64,
    pub observed: Vec<Option<f64>>,
    pub trend: Vec<Option<f64>>,
    pub seasonal: Vec<Option<f64>>,
    pub remainder: Vec<Option<f64>>,
}

#[tauri::command]
pub async fn dataset_stl_decomposition(
    state: State<'_, AppState>,
    dataset_id: String,
    series: String,
    period: Option<usize>,
    method: Option<String>,
) -> Result<CommandOutput<StlDecompositionView>, ()> {
    let runstore = state.runstore.clone();
    let res = tokio::task::spawn_blocking(move || {
        let key = series.to_lowercase();
        let allowed = ["wt", "sm", "rf", "temp"];
        if !allowed.contains(&key.as_str()) {
            return CommandOutput::Failure(PfrsimError::validation(
                "VALIDATION_BAD_SERIES",
                format!("Unknown series '{series}': expected one of wt, sm, rf, temp"),
                None,
            ));
        }
        let ds = match runstore.get_dataset(&dataset_id) {
            Ok(Some(ds)) => ds,
            Ok(None) => return CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id)),
            Err(e) => return CommandOutput::Failure(e),
        };
        let raw = match key.as_str() {
            "wt" => &ds.columns.wt,
            "sm" => &ds.columns.sm,
            "rf" => &ds.columns.rf,
            _ => &ds.columns.temp,
        };
        let valid: Vec<f64> = raw.iter().copied().filter(|v| !v.is_nan()).collect();
        if valid.is_empty() || raw.len() < 8 {
            return CommandOutput::Failure(PfrsimError::validation(
                "VALIDATION_TOO_FEW_ROWS",
                "At least 8 non-empty observations are required for decomposition",
                None,
            ));
        }

        let is_trend = method
            .as_deref()
            .map(|m| m.to_lowercase() == "trend")
            .unwrap_or(false);
        let decomp = match pfrsim_core::ingest::compute_decomposition_ext(&valid, raw, period, is_trend)
        {
            Some(d) => d,
            None => {
                return CommandOutput::Failure(PfrsimError::validation(
                    "VALIDATION_DECOMPOSITION_FAILED",
                    format!(
                        "Decomposition could not be computed for '{key}' (check that record has at least 2 full cycles)"
                    ),
                    None,
                ));
            }
        };

        let observed: Vec<Option<f64>> = if raw.len() > 2500 {
            let (_, d_obs) = pfrsim_core::ingest::lttb_downsample_indexed_f64(raw, 2500);
            d_obs
        } else {
            raw.iter()
                .map(|v| if v.is_nan() { None } else { Some(*v) })
                .collect()
        };
        CommandOutput::Success(StlDecompositionView {
            period: decomp.period,
            method: if is_trend {
                "trend".to_string()
            } else {
                "stl".to_string()
            },
            trend_strength: decomp.trend_strength,
            seasonal_strength: decomp.seasonal_strength,
            observed,
            trend: decomp.trend,
            seasonal: decomp.seasonal.into_iter().map(Some).collect(),
            remainder: decomp.remainder,
        })
    }).await;

    let out = match res {
        Ok(out) => out,
        Err(e) => CommandOutput::Failure(PfrsimError::validation(
            "INTERNAL_PANIC",
            format!("Decomposition task panicked: {e}"),
            None,
        )),
    };
    Ok(out)
}
#[tauri::command]
pub async fn dataset_autocorrelation(
    state: State<'_, AppState>,
    dataset_id: String,
    series: String,
    max_lag: Option<usize>,
) -> Result<CommandOutput<pfrsim_core::ingest::AutocorrelationView>, ()> {
    let runstore = state.runstore.clone();
    let res = tokio::task::spawn_blocking(move || {
        let key = series.to_lowercase();
        let allowed = ["wt", "sm", "rf", "temp"];
        if !allowed.contains(&key.as_str()) {
            return CommandOutput::Failure(PfrsimError::validation(
                "VALIDATION_BAD_SERIES",
                format!("Unknown series '{series}': expected one of wt, sm, rf, temp"),
                None,
            ));
        }
        let ds = match runstore.get_dataset(&dataset_id) {
            Ok(Some(ds)) => ds,
            Ok(None) => {
                return CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id))
            }
            Err(e) => return CommandOutput::Failure(e),
        };
        let raw = match key.as_str() {
            "wt" => &ds.columns.wt,
            "sm" => &ds.columns.sm,
            "rf" => &ds.columns.rf,
            _ => &ds.columns.temp,
        };
        let valid: Vec<f64> = raw.iter().copied().filter(|v| !v.is_nan()).collect();
        match pfrsim_core::ingest::compute_autocorrelation(&valid, max_lag) {
            Some(view) => CommandOutput::Success(view),
            None => CommandOutput::Failure(PfrsimError::validation(
                "VALIDATION_TOO_FEW_ROWS",
                "At least 4 non-empty observations are required to compute autocorrelation",
                None,
            )),
        }
    })
    .await;

    let out = match res {
        Ok(out) => out,
        Err(e) => CommandOutput::Failure(PfrsimError::validation(
            "INTERNAL_PANIC",
            format!("Autocorrelation task panicked: {e}"),
            None,
        )),
    };
    Ok(out)
}
#[tauri::command]
pub async fn dataset_get_rows(
    state: State<'_, AppState>,
    dataset_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<CommandOutput<pfrsim_core::runstore::DatasetRowsPage>, ()> {
    let runstore = state.runstore.clone();
    let res = tokio::task::spawn_blocking(move || {
        let off = offset.unwrap_or(0);
        let lim = limit.unwrap_or(50).min(500);
        match runstore.get_dataset_rows(&dataset_id, off, lim) {
            Ok(Some(page)) => CommandOutput::Success(page),
            Ok(None) => CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id)),
            Err(e) => CommandOutput::Failure(e),
        }
    })
    .await;

    let out = match res {
        Ok(out) => out,
        Err(e) => CommandOutput::Failure(PfrsimError::validation(
            "INTERNAL_PANIC",
            format!("Rows query task panicked: {e}"),
            None,
        )),
    };
    Ok(out)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownsampledSeries {
    pub series: String,
    pub total_points: usize,
    pub downsampled_points: usize,
    pub x: Vec<f64>,
    pub y: Vec<Option<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllDownsampledSeries {
    pub wt: DownsampledSeries,
    pub sm: DownsampledSeries,
    pub rf: DownsampledSeries,
    pub temp: DownsampledSeries,
}

#[tauri::command]
pub async fn dataset_get_series_downsampled(
    state: State<'_, AppState>,
    dataset_id: String,
    series: String,
    max_points: Option<usize>,
) -> Result<CommandOutput<DownsampledSeries>, ()> {
    let runstore = state.runstore.clone();
    let res = tokio::task::spawn_blocking(move || {
        let key = series.to_lowercase();
        let allowed = ["wt", "sm", "rf", "temp"];
        if !allowed.contains(&key.as_str()) {
            return CommandOutput::Failure(PfrsimError::validation(
                "VALIDATION_BAD_SERIES",
                format!("Unknown series '{series}': expected one of wt, sm, rf, temp"),
                None,
            ));
        }
        let ds = match runstore.get_dataset(&dataset_id) {
            Ok(Some(ds)) => ds,
            Ok(None) => {
                return CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id))
            }
            Err(e) => return CommandOutput::Failure(e),
        };
        let raw = match key.as_str() {
            "wt" => &ds.columns.wt,
            "sm" => &ds.columns.sm,
            "rf" => &ds.columns.rf,
            _ => &ds.columns.temp,
        };
        let total_points = raw.len();
        let threshold = max_points.unwrap_or(2500).max(100);
        let (down_x, down_y) = pfrsim_core::ingest::lttb_downsample_indexed_f64(raw, threshold);

        CommandOutput::Success(DownsampledSeries {
            series: key,
            total_points,
            downsampled_points: down_x.len(),
            x: down_x,
            y: down_y,
        })
    })
    .await;

    let out = match res {
        Ok(out) => out,
        Err(e) => CommandOutput::Failure(PfrsimError::validation(
            "INTERNAL_PANIC",
            format!("Downsample task panicked: {e}"),
            None,
        )),
    };
    Ok(out)
}
#[tauri::command]
pub async fn dataset_get_all_series_downsampled(
    state: State<'_, AppState>,
    dataset_id: String,
    max_points: Option<usize>,
) -> Result<CommandOutput<AllDownsampledSeries>, ()> {
    let runstore = state.runstore.clone();
    let res = tokio::task::spawn_blocking(move || {
        let ds = match runstore.get_dataset(&dataset_id) {
            Ok(Some(ds)) => ds,
            Ok(None) => {
                return CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id))
            }
            Err(e) => return CommandOutput::Failure(e),
        };
        let threshold = max_points.unwrap_or(2500).max(100);
        let (wt_x, wt_y) =
            pfrsim_core::ingest::lttb_downsample_indexed_f64(&ds.columns.wt, threshold);
        let (sm_x, sm_y) =
            pfrsim_core::ingest::lttb_downsample_indexed_f64(&ds.columns.sm, threshold);
        let (rf_x, rf_y) =
            pfrsim_core::ingest::lttb_downsample_indexed_f64(&ds.columns.rf, threshold);
        let (temp_x, temp_y) =
            pfrsim_core::ingest::lttb_downsample_indexed_f64(&ds.columns.temp, threshold);

        CommandOutput::Success(AllDownsampledSeries {
            wt: DownsampledSeries {
                series: "wt".to_string(),
                total_points: ds.columns.wt.len(),
                downsampled_points: wt_x.len(),
                x: wt_x,
                y: wt_y,
            },
            sm: DownsampledSeries {
                series: "sm".to_string(),
                total_points: ds.columns.sm.len(),
                downsampled_points: sm_x.len(),
                x: sm_x,
                y: sm_y,
            },
            rf: DownsampledSeries {
                series: "rf".to_string(),
                total_points: ds.columns.rf.len(),
                downsampled_points: rf_x.len(),
                x: rf_x,
                y: rf_y,
            },
            temp: DownsampledSeries {
                series: "temp".to_string(),
                total_points: ds.columns.temp.len(),
                downsampled_points: temp_x.len(),
                x: temp_x,
                y: temp_y,
            },
        })
    })
    .await;

    let out = match res {
        Ok(out) => out,
        Err(e) => CommandOutput::Failure(PfrsimError::validation(
            "INTERNAL_PANIC",
            format!("All downsample task panicked: {e}"),
            None,
        )),
    };
    Ok(out)
}
#[tauri::command]
pub fn dataset_get_detail(
    state: State<'_, AppState>,
    dataset_id: String,
) -> CommandOutput<DatasetDetail> {
    match state.runstore.get_dataset(&dataset_id) {
        Ok(Some(ds)) => {
            // For large datasets (> 10,000 rows), avoid serializing millions of floats into IPC JSON.
            // Downsampled series and windowed row paging handle large data with constant O(1) viewport memory.
            let columns = if ds.n > 10_000 {
                pfrsim_core::ingest::ColumnData {
                    wt: Vec::new(),
                    sm: Vec::new(),
                    rf: Vec::new(),
                    temp: Vec::new(),
                }
            } else {
                ds.columns
            };
            CommandOutput::Success(DatasetDetail {
                dataset_id: ds.dataset_id,
                name: ds.name,
                n: ds.n,
                columns,
                preview: ds.preview,
            })
        }
        Ok(None) => CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id)),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn dataset_update_name(
    state: State<'_, AppState>,
    dataset_id: String,
    name: String,
) -> CommandOutput<()> {
    match state.runstore.update_dataset_name(&dataset_id, &name) {
        Ok(()) => CommandOutput::Success(()),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn dataset_delete(state: State<'_, AppState>, dataset_id: String) -> CommandOutput<()> {
    match state.runstore.delete_dataset(&dataset_id) {
        Ok(()) => CommandOutput::Success(()),
        Err(e) => CommandOutput::Failure(e),
    }
}

fn compute_gpu_score(name: &str, vram_mb: Option<u64>) -> (u32, &'static str, &'static str) {
    let lower = name.to_lowercase();
    let vram = vram_mb.unwrap_or(0);

    if lower.contains("4090")
        || lower.contains("a100")
        || lower.contains("h100")
        || lower.contains("h200")
    {
        (99, "Flagship Tensor Core Accelerator", "~12x – 20x vs CPU")
    } else if lower.contains("4080") || lower.contains("3090") {
        (95, "Ultra Enthusiast Tensor GPU", "~8x – 12x vs CPU")
    } else if lower.contains("4070") || lower.contains("3080") {
        (90, "High-End Tensor Core GPU", "~6x – 10x vs CPU")
    } else if lower.contains("4060") || lower.contains("3070") {
        (85, "High-Performance Discrete GPU", "~5x – 8x vs CPU")
    } else if lower.contains("3060") {
        (82, "Mid-Range Tensor Core GPU", "~4x – 6x vs CPU")
    } else if lower.contains("3050") {
        (78, "Mainstream Tensor Core GPU", "~3.5x – 5x vs CPU")
    } else if lower.contains("2080") || lower.contains("2070") {
        (76, "Turing Tensor Architecture", "~3.5x – 5x vs CPU")
    } else if lower.contains("2060") || lower.contains("1660") {
        (72, "Entry Discrete GPU", "~3x – 4.5x vs CPU")
    } else if lower.contains("1650") || lower.contains("1060") || lower.contains("1050") {
        (65, "Legacy Discrete GPU", "~2x – 3.5x vs CPU")
    } else if lower.contains("apple") || lower.contains("metal") {
        if lower.contains("max") || lower.contains("ultra") {
            (94, "Apple High-Core Neural GPU", "~8x – 14x vs CPU")
        } else if lower.contains("pro") {
            (88, "Apple Pro Unified GPU", "~6x – 9x vs CPU")
        } else {
            (80, "Apple Unified GPU", "~4x – 6x vs CPU")
        }
    } else if lower.contains("radeon") || lower.contains("amd") {
        if lower.contains("7900") || lower.contains("6900") {
            (92, "High-End AMD RDNA GPU", "~7x – 11x vs CPU")
        } else if lower.contains("7800") || lower.contains("6800") || lower.contains("6700") {
            (86, "Mid-Range AMD RDNA GPU", "~5x – 8x vs CPU")
        } else if lower.contains("7600") || lower.contains("6600") {
            (78, "Mainstream AMD RDNA GPU", "~3.5x – 5x vs CPU")
        } else {
            (62, "Integrated Radeon GPU", "~1.8x – 2.5x vs CPU")
        }
    } else if lower.contains("arc") {
        (80, "Intel Arc Xe-HPG Discrete", "~4x – 6x vs CPU")
    } else if lower.contains("iris") {
        (58, "Intel Iris Xe Integrated", "~1.5x – 2.2x vs CPU")
    } else if lower.contains("intel") || lower.contains("uhd") {
        (45, "Intel Integrated Graphics", "~1.2x – 1.6x vs CPU")
    } else if vram >= 8192 {
        (85, "High-Memory Graphics Adapter", "~5x – 8x vs CPU")
    } else if vram >= 4096 {
        (75, "Mid-Range Dedicated GPU", "~3x – 5x vs CPU")
    } else {
        (50, "Standard Graphics Adapter", "~1.5x – 2x vs CPU")
    }
}

pub fn detect_wgpu_gpu() -> (bool, Option<String>, Option<GpuInfo>) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build();

    let adapters = match rt {
        Ok(rt) => rt.block_on(async {
            let instance =
                wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
            instance.enumerate_adapters(wgpu::Backends::all()).await
        }),
        Err(_) => Vec::new(),
    };

    // Filter out software / CPU emulators
    let hardware_adapters: Vec<_> = adapters
        .into_iter()
        .filter(|a| {
            let info = a.get_info();
            let lower = info.name.to_lowercase();
            info.device_type != wgpu::DeviceType::Cpu
                && !lower.contains("basic render")
                && !lower.contains("swiftshader")
                && !lower.contains("llvmpipe")
                && !lower.contains("softpipe")
        })
        .collect();

    // Prioritize Dedicated Discrete GPU over Integrated GPU
    let best_adapter = hardware_adapters.iter().max_by_key(|a| {
        let info = a.get_info();
        match info.device_type {
            wgpu::DeviceType::DiscreteGpu => 100,
            wgpu::DeviceType::IntegratedGpu => 50,
            wgpu::DeviceType::VirtualGpu => 20,
            _ => 10,
        }
    });

    if let Some(adapter) = best_adapter {
        let info = adapter.get_info();
        let backend_str = format!("{:?}", info.backend);
        let driver = if !info.driver.is_empty() {
            Some(info.driver)
        } else if !info.driver_info.is_empty() {
            Some(info.driver_info)
        } else {
            None
        };

        let (score, tier, speedup) = compute_gpu_score(&info.name, None);

        let gpu_info = GpuInfo {
            name: info.name.clone(),
            vram_mb: None,
            driver_version: driver,
            tier: tier.to_string(),
            score,
            backend: format!("wgpu ({backend_str})"),
            estimated_speedup: speedup.to_string(),
        };
        return (true, Some(info.name), Some(gpu_info));
    }

    (false, None, None)
}

static SYSTEM_GPU: std::sync::LazyLock<(bool, Option<String>, Option<GpuInfo>)> =
    std::sync::LazyLock::new(detect_wgpu_gpu);

pub fn get_gpu_info() -> (bool, Option<String>, Option<GpuInfo>) {
    SYSTEM_GPU.clone()
}

#[tauri::command]
pub fn capability_query() -> CommandOutput<CapabilityQueryOutput> {
    let (gpu_available, gpu_name, gpu_info) = get_gpu_info();
    CommandOutput::Success(CapabilityQueryOutput {
        imputers: list_imputers(),
        forecasters: list_forecasters(),
        gpu_available,
        gpu_name,
        gpu_info,
    })
}

#[tauri::command]
pub async fn gpu_spec_query() -> CommandOutput<GpuInfo> {
    tokio::task::spawn_blocking(|| {
        let (_avail, _name, info) = get_gpu_info();
        match info {
            Some(i) => CommandOutput::Success(i),
            None => {
                CommandOutput::Failure(PfrsimError::not_found("GPU", "No hardware GPU detected"))
            }
        }
    })
    .await
    .unwrap_or_else(|_| {
        CommandOutput::Failure(PfrsimError::validation(
            "GPU_ERROR",
            "GPU query thread panicked",
            None,
        ))
    })
}
#[tauri::command]
pub fn pipeline_run(
    app: AppHandle,
    state: State<'_, AppState>,
    dataset_id: String,
    mut config: PipelineConfig,
    seed: Option<u64>,
) -> CommandOutput<PipelineRunOutput> {
    if let Some(s) = seed {
        config.seed = s;
    }

    // 1. Guard against excessive concurrent jobs (allows up to MAX_CONCURRENT_JOBS in parallel)
    let mut active = state.active_jobs.lock();
    if active.len() >= MAX_CONCURRENT_JOBS {
        return CommandOutput::Failure(PfrsimError::job_busy());
    }
    // 2. Lookup dataset
    let dataset = match state.runstore.get_dataset(&dataset_id) {
        Ok(Some(ds)) => ds,
        Ok(None) => return CommandOutput::Failure(PfrsimError::not_found("Dataset", &dataset_id)),
        Err(e) => return CommandOutput::Failure(e),
    };

    // 3. Create job ID and record
    let job_id = format!("job-{}", &hex::encode(rand::random::<[u8; 6]>()));
    let config_json_str = serde_json::to_string(&config).ok();
    let job_rec = JobRecord {
        job_id: job_id.clone(),
        dataset_id: dataset_id.clone(),
        config_hash: config.compute_hash(),
        seed: config.seed,
        status: "queued".to_string(),
        stage: Some("queued".to_string()),
        progress: 0.0,
        run_id: None,
        error: None,
        created_at: Utc::now().to_rfc3339(),
        finished_at: None,
        dataset_name: Some(dataset.name.clone()),
        config_json: config_json_str,
    };

    if let Err(e) = state.runstore.save_job(&job_rec) {
        return CommandOutput::Failure(e);
    }

    active.insert(job_id.clone());

    // 4. Spawn background execution task
    let runstore_clone = state.runstore.clone();
    let base_dir_clone = state.base_dir.clone();
    let active_jobs_clone = state.active_jobs.clone();
    let j_id = job_id.clone();

    std::thread::spawn(move || {
        let _ = runstore_clone.update_job_status(&j_id, "running", None, None);
        let _ = app.emit(
            "pipeline-progress",
            ProgressEventPayload {
                job_id: j_id.clone(),
                stage: "validating".to_string(),
                progress: 0.015,
                epoch: None,
                total_epochs: None,
                current_var: None,
                sub_step: Some("DIM".to_string()),
                var_epochs: None,
            },
        );

        let app_for_progress = app.clone();
        let j_id_for_progress = j_id.clone();
        let rs_cb = runstore_clone.clone();

        let progress_cb = move |info: &PipelineProgressInfo| {
            let _ = rs_cb.update_job_progress(&j_id_for_progress, &info.stage, info.progress);
            let _ = app_for_progress.emit(
                "pipeline-progress",
                ProgressEventPayload {
                    job_id: j_id_for_progress.clone(),
                    stage: info.stage.clone(),
                    progress: info.progress,
                    epoch: info.epoch,
                    total_epochs: info.total_epochs,
                    current_var: info.current_var.clone(),
                    sub_step: info.sub_step.clone(),
                    var_epochs: info.var_epochs.clone(),
                },
            );
        };

        let dataset_owned = dataset;
        let config_owned = config;
        let j_id_exec = j_id.clone();
        let rs_blocking = runstore_clone.clone();
        let base_dir = base_dir_clone.clone();

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            execute_pipeline(
                &dataset_owned,
                &config_owned,
                &base_dir,
                &rs_blocking,
                &j_id_exec,
                Some(&progress_cb as &ProgressCallback<'_>),
            )
        }));

        match result {
            Ok(Ok(run_res)) => {
                let _ =
                    runstore_clone.update_job_status(&j_id, "done", Some(&run_res.run_id), None);
                let _ = app.emit(
                    "pipeline-progress",
                    ProgressEventPayload {
                        job_id: j_id.clone(),
                        stage: "done".to_string(),
                        progress: 1.0,
                        epoch: None,
                        total_epochs: None,
                        current_var: None,
                        sub_step: None,
                        var_epochs: None,
                    },
                );
            }
            Ok(Err(err)) => {
                let err_msg = err.message().to_string();
                let _ = runstore_clone.update_job_status(&j_id, "error", None, Some(&err_msg));
                let _ = app.emit(
                    "pipeline-progress",
                    ProgressEventPayload {
                        job_id: j_id.clone(),
                        stage: "error".to_string(),
                        progress: 0.0,
                        epoch: None,
                        total_epochs: None,
                        current_var: None,
                        sub_step: None,
                        var_epochs: None,
                    },
                );
            }
            Err(panic_payload) => {
                let panic_msg = if let Some(s) = panic_payload.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic_payload.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "Pipeline panicked during execution".to_string()
                };
                let _ = runstore_clone.update_job_status(&j_id, "error", None, Some(&panic_msg));
                let _ = app.emit(
                    "pipeline-progress",
                    ProgressEventPayload {
                        job_id: j_id.clone(),
                        stage: "error".to_string(),
                        progress: 0.0,
                        epoch: None,
                        total_epochs: None,
                        current_var: None,
                        sub_step: None,
                        var_epochs: None,
                    },
                );
            }
        }

        // Release active job from concurrent set
        active_jobs_clone.lock().remove(&j_id);
    });

    CommandOutput::Success(PipelineRunOutput { job_id })
}

#[tauri::command]
pub fn pipeline_job_status(state: State<'_, AppState>, job_id: String) -> CommandOutput<JobRecord> {
    match state.runstore.get_job(&job_id) {
        Ok(Some(j)) => CommandOutput::Success(j),
        Ok(None) => CommandOutput::Failure(PfrsimError::not_found("Job", &job_id)),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn pipeline_jobs_list(
    state: State<'_, AppState>,
    dataset_id: Option<String>,
) -> CommandOutput<Vec<JobRecord>> {
    match state.runstore.list_jobs(dataset_id.as_deref()) {
        Ok(jobs) => CommandOutput::Success(jobs),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn pipeline_cancel(state: State<'_, AppState>, job_id: String) -> CommandOutput<CancelOutput> {
    let was_active = state.active_jobs.lock().remove(&job_id);
    let _ = state
        .runstore
        .update_job_status(&job_id, "error", None, Some("JOB_CANCELLED"));
    CommandOutput::Success(CancelOutput {
        cancelled: was_active,
    })
}
#[tauri::command]
pub fn pipeline_job_delete(state: State<'_, AppState>, job_id: String) -> CommandOutput<bool> {
    let _ = state.active_jobs.lock().remove(&job_id);
    match state.runstore.delete_job(&job_id) {
        Ok(deleted) => CommandOutput::Success(deleted),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn runs_list(
    state: State<'_, AppState>,
    limit: Option<usize>,
    offset: Option<usize>,
    dataset_id: Option<String>,
) -> CommandOutput<Vec<RunSummary>> {
    let l = limit.unwrap_or(50);
    let o = offset.unwrap_or(0);
    match state.runstore.list_runs(l, o, dataset_id.as_deref()) {
        Ok(runs) => CommandOutput::Success(runs),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn run_get(state: State<'_, AppState>, run_id: String) -> CommandOutput<RunDetail> {
    match state.runstore.get_run(&run_id) {
        Ok(Some(detail)) => CommandOutput::Success(detail),
        Ok(None) => CommandOutput::Failure(PfrsimError::not_found("Run", &run_id)),
        Err(e) => CommandOutput::Failure(e),
    }
}
#[tauri::command]
pub fn run_delete(state: State<'_, AppState>, run_id: String) -> CommandOutput<bool> {
    match state.runstore.delete_run(&run_id) {
        Ok(deleted) => {
            let _ = pfrsim_core::artifact::delete_run_artifacts(&state.base_dir, &run_id);
            CommandOutput::Success(deleted)
        }
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn artifact_load_frames(
    state: State<'_, AppState>,
    run_id: String,
) -> CommandOutput<Vec<SimulationFrame>> {
    match load_frames(&state.base_dir, &run_id) {
        Ok(frames) => CommandOutput::Success(frames),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn artifact_load_manifest(
    state: State<'_, AppState>,
    run_id: String,
) -> CommandOutput<Manifest> {
    match load_manifest(&state.base_dir, &run_id) {
        Ok(manifest) => CommandOutput::Success(manifest),
        Err(e) => CommandOutput::Failure(e),
    }
}

#[tauri::command]
pub fn run_import(
    state: State<'_, AppState>,
    name: String,
    frames: Vec<SimulationFrame>,
    manifest_data: Option<serde_json::Value>,
) -> CommandOutput<RunSummary> {
    if frames.is_empty() {
        return CommandOutput::Failure(PfrsimError::validation(
            "EMPTY_FRAMES",
            "Cannot import run with zero simulation frames.",
            None,
        ));
    }

    let run_id = format!(
        "pfrsim-pipeline-import-{}-{:04}",
        Utc::now().format("%Y%m%d-%H%M%S"),
        rand::random::<u16>()
    );

    // Look up dataset ID and name from existing datasets
    let (dataset_id, dataset_name) = match state.runstore.list_datasets() {
        Ok(list) if !list.is_empty() => (list[0].id.clone(), Some(list[0].name.clone())),
        _ => (
            "ds-imported".to_string(),
            Some("Imported Dataset".to_string()),
        ),
    };

    let job_id = format!("job-import-{}", rand::random::<u16>());

    // 1. Materialize frames and manifest on disk in base_dir/models/<run_id>/
    let model_dir = pfrsim_core::artifact::run_model_dir(&state.base_dir, &run_id);
    if let Err(e) = fs::create_dir_all(&model_dir) {
        return CommandOutput::Failure(PfrsimError::io(e));
    }

    let frames_json = match serde_json::to_string_pretty(&frames) {
        Ok(s) => s,
        Err(e) => return CommandOutput::Failure(PfrsimError::from(e)),
    };
    let frames_sha = pfrsim_core::artifact::compute_sha256(frames_json.as_bytes());
    let frames_path = model_dir.join("frames.json");
    if let Err(e) = fs::write(&frames_path, &frames_json) {
        return CommandOutput::Failure(PfrsimError::io(e));
    }

    let manifest = Manifest {
        run_id: run_id.clone(),
        dataset_id: dataset_id.clone(),
        csv_sha: "imported".to_string(),
        config: manifest_data.unwrap_or_else(|| serde_json::json!({
            "imputer": { "id": "imported", "k": 5, "span": 0.5 },
            "forecaster": { "id": "imported", "arima": { "test_split_ratio": 0.2 }, "lstm": null, "gru": null },
            "pfvi": { "r0": 3000.0, "dt": 1.0, "h": frames.iter().filter(|f| f.is_forecast).count(), "fc": 0.4, "sat": 0.7, "max_grid_m": 5.0, "timeout_s": 30 },
            "seed": 42
        })),
        seed: 42,
        crate_versions: std::collections::HashMap::new(),
        frames_sha256: frames_sha.clone(),
        created_at: Utc::now().to_rfc3339(),
        peatfr_parity: true,
    };

    let manifest_json = match serde_json::to_string_pretty(&manifest) {
        Ok(s) => s,
        Err(e) => return CommandOutput::Failure(PfrsimError::from(e)),
    };
    let manifest_sha = pfrsim_core::artifact::compute_sha256(manifest_json.as_bytes());
    let manifest_path = model_dir.join("manifest.json");
    if let Err(e) = fs::write(&manifest_path, &manifest_json) {
        return CommandOutput::Failure(PfrsimError::io(e));
    }

    let config_str = serde_json::to_string(&manifest.config).unwrap_or_default();

    // 2. Persist run record to SQLite database
    if let Err(e) = state.runstore.create_run(
        &run_id,
        &job_id,
        &dataset_id,
        &name,
        "imported",
        42,
        &config_str,
    ) {
        return CommandOutput::Failure(e);
    }

    if let Err(e) = state.runstore.finish_run(&run_id, "DONE") {
        return CommandOutput::Failure(e);
    }

    let h_count = frames.iter().filter(|f| f.is_forecast).count();
    let h_str = h_count.to_string();

    let _ = state.runstore.record_params(
        &run_id,
        &[
            ("app", "pfrsim"),
            ("imported", "true"),
            ("pfvi.h", &h_str),
            ("imputer.id", "imported"),
            ("forecaster.id", "imported"),
        ],
    );

    let _ = state.runstore.record_artifact(
        &run_id,
        "frames",
        &frames_path.to_string_lossy(),
        &frames_sha,
    );

    let _ = state.runstore.record_artifact(
        &run_id,
        "manifest",
        &manifest_path.to_string_lossy(),
        &manifest_sha,
    );

    let summary = RunSummary {
        run_id,
        job_id,
        dataset_id,
        dataset_name,
        name,
        created_at: Utc::now().to_rfc3339(),
        status: "DONE".to_string(),
        imputer_id: Some("imported".to_string()),
        forecaster_id: Some("imported".to_string()),
        h: h_count,
        best_pfvi_mse: None,
        seed: 42,
    };

    CommandOutput::Success(summary)
}

#[tauri::command]
pub fn artifact_export(
    state: State<'_, AppState>,
    run_id: String,
    format: String,
    destination_path: Option<String>,
) -> CommandOutput<ExportOutput> {
    let target_dir = match &destination_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => state.base_dir.join("exports"),
    };
    if let Err(e) = fs::create_dir_all(&target_dir) {
        return CommandOutput::Failure(PfrsimError::io(e));
    }

    if format.eq_ignore_ascii_case("mlflow") {
        let run_detail = match state.runstore.get_run(&run_id) {
            Ok(Some(rd)) => rd,
            Ok(None) => return CommandOutput::Failure(PfrsimError::not_found("Run", &run_id)),
            Err(e) => return CommandOutput::Failure(e),
        };
        match export_run_to_mlflow(&state.base_dir, &run_detail, &target_dir) {
            Ok(path) => CommandOutput::Success(ExportOutput {
                path: path.to_string_lossy().to_string(),
            }),
            Err(e) => CommandOutput::Failure(e),
        }
    } else if format.eq_ignore_ascii_case("onnx") {
        let run_detail = match state.runstore.get_run(&run_id) {
            Ok(Some(rd)) => rd,
            Ok(None) => return CommandOutput::Failure(PfrsimError::not_found("Run", &run_id)),
            Err(e) => return CommandOutput::Failure(e),
        };
        match export_run_to_onnx(&state.base_dir, &run_detail, &target_dir) {
            Ok(path) => CommandOutput::Success(ExportOutput {
                path: path.to_string_lossy().to_string(),
            }),
            Err(e) => CommandOutput::Failure(e),
        }
    } else {
        let frames = match load_frames(&state.base_dir, &run_id) {
            Ok(f) => f,
            Err(e) => return CommandOutput::Failure(e),
        };

        if format.eq_ignore_ascii_case("csv") {
            let file_name = format!("{run_id}_frames.csv");
            let path = target_dir.join(&file_name);
            let csv_str = export_frames_to_csv(&frames);
            if let Err(e) = fs::write(&path, csv_str) {
                return CommandOutput::Failure(PfrsimError::io(e));
            }
            CommandOutput::Success(ExportOutput {
                path: path.to_string_lossy().to_string(),
            })
        } else {
            CommandOutput::Failure(PfrsimError::validation(
                "INVALID_EXPORT_FORMAT",
                format!("Unsupported export format '{format}'. Use 'mlflow', 'onnx', or 'csv'."),
                None,
            ))
        }
    }
}
#[tauri::command]
pub fn dialog_pick_folder(title: Option<String>) -> CommandOutput<Option<String>> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }
    let folder = dialog.pick_folder();
    CommandOutput::Success(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn dialog_pick_file(title: Option<String>) -> CommandOutput<Option<String>> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }
    dialog = dialog.add_filter(
        "Supported Datasets (*.csv, *.tsv, *.parquet, *.xlsx)",
        &["csv", "tsv", "parquet", "pq", "xlsx", "xls", "ods"],
    );
    let file = dialog.pick_file();
    CommandOutput::Success(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn dataset_inspect(
    file_path: Option<String>,
    raw_bytes: Option<Vec<u8>>,
    file_name: String,
) -> CommandOutput<pfrsim_core::ingest::DatasetInspection> {
    tokio::task::spawn_blocking(move || {
        let path_ref = file_path.as_deref().map(std::path::Path::new);
        match pfrsim_core::ingest::inspect_dataset_file(path_ref, raw_bytes.as_deref(), &file_name)
        {
            Ok(insp) => CommandOutput::Success(insp),
            Err(e) => CommandOutput::Failure(e),
        }
    })
    .await
    .unwrap_or_else(|e| {
        CommandOutput::Failure(PfrsimError::validation(
            "INSPECT_PANIC",
            e.to_string(),
            None,
        ))
    })
}

#[tauri::command]
pub async fn dataset_import_mapped(
    state: State<'_, AppState>,
    file_path: Option<String>,
    raw_bytes: Option<Vec<u8>>,
    file_name: String,
    custom_name: Option<String>,
    mapping: std::collections::HashMap<String, String>,
) -> Result<CommandOutput<DatasetImportOutput>, ()> {
    let state_inner = state.inner().clone();
    let res = tokio::task::spawn_blocking(move || {
        let path_ref = file_path.as_deref().map(std::path::Path::new);
        let dataset = match pfrsim_core::ingest::import_dataset_with_mapping(
            path_ref,
            raw_bytes.as_deref(),
            &file_name,
            custom_name.as_deref(),
            &mapping,
        ) {
            Ok(ds) => ds,
            Err(e) => return CommandOutput::Failure(e),
        };

        if let Ok(Some(existing)) = state_inner.runstore.find_dataset_by_sha(&dataset.csv_sha) {
            return CommandOutput::Success(DatasetImportOutput {
                dataset_id: existing.dataset_id,
                preview: existing.preview,
                was_existing: true,
            });
        }

        if let Err(e) = state_inner.runstore.save_dataset(&dataset) {
            return CommandOutput::Failure(e);
        }

        CommandOutput::Success(DatasetImportOutput {
            dataset_id: dataset.dataset_id,
            preview: dataset.preview,
            was_existing: false,
        })
    })
    .await
    .unwrap_or_else(|e| {
        CommandOutput::Failure(PfrsimError::validation("IMPORT_PANIC", e.to_string(), None))
    });

    Ok(res)
}
#[tauri::command]
pub fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
pub fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
pub fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
pub fn open_url(url: String) -> CommandOutput<()> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    CommandOutput::Success(())
}
