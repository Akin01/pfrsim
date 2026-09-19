use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::Path;

use crate::artifact::{materialize_artifacts, FrameImputed, Manifest, ModelJson, SimulationFrame};
use crate::error::PfrsimError;
use crate::forecaster::{get_forecaster, EpochCallback, ForecasterConfig};
use crate::imputer::{get_imputer, ImputeFlags, ImputeMask, ImputerConfig};
use crate::ingest::Dataset;
use crate::pfvi::{classify_pfvi as classify_val, fit_pfvi, PfviConfig};
use crate::runstore::RunStore;

fn default_seed() -> u64 {
    42
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineConfig {
    #[serde(default)]
    pub imputer: ImputerConfig,
    #[serde(default)]
    pub forecaster: ForecasterConfig,
    #[serde(default)]
    pub pfvi: PfviConfig,
    #[serde(default = "default_seed")]
    pub seed: u64,
}

impl Default for PipelineConfig {
    fn default() -> Self {
        Self {
            imputer: ImputerConfig::default(),
            forecaster: ForecasterConfig::default(),
            pfvi: PfviConfig::default(),
            seed: 42,
        }
    }
}

impl PipelineConfig {
    pub fn compute_hash(&self) -> String {
        let json = serde_json::to_string(self).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        hex::encode(&hasher.finalize()[..8])
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineRunResult {
    pub run_id: String,
    pub job_id: String,
    pub dataset_id: String,
    pub frames_sha256: String,
    pub n_frames: usize,
    pub pfvi_mse: f64,
    pub h_classes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineProgressInfo {
    pub stage: String,
    pub progress: f64,
    pub epoch: Option<usize>,
    pub total_epochs: Option<usize>,
    pub current_var: Option<String>,
    #[serde(default)]
    pub sub_step: Option<String>,
    #[serde(default)]
    pub var_epochs: Option<HashMap<String, usize>>,
}
pub type ProgressCallback<'a> = dyn Fn(&PipelineProgressInfo) + Send + Sync + 'a;

pub fn execute_pipeline(
    dataset: &Dataset,
    config: &PipelineConfig,
    base_dir: &Path,
    runstore: &RunStore,
    job_id: &str,
    on_progress: Option<&ProgressCallback<'_>>,
) -> Result<PipelineRunResult, PfrsimError> {
    let emit_progress = |info: PipelineProgressInfo| {
        if let Some(cb) = on_progress {
            cb(&info);
        }
    };

    let run_id = format!(
        "pfrsim-pipeline-{}-{:04}",
        Utc::now().format("%Y%m%d-%H%M%S"),
        rand::random::<u16>()
    );
    let run_name = format!("Run {} ({})", &run_id[16..], config.forecaster.id);
    let config_json = serde_json::to_string(config)?;

    // 1. Validating
    emit_progress(PipelineProgressInfo {
        stage: "validating".to_string(),
        progress: 0.015,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("DIM".to_string()),
        var_epochs: None,
    });
    runstore.create_run(
        &run_id,
        job_id,
        &dataset.dataset_id,
        &run_name,
        &dataset.csv_sha,
        config.seed,
        &config_json,
    )?;

    emit_progress(PipelineProgressInfo {
        stage: "validating".to_string(),
        progress: 0.03,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("SCHEMA".to_string()),
        var_epochs: None,
    });

    let val_start = Utc::now().to_rfc3339();
    if dataset.n < 8 {
        let err = PfrsimError::validation(
            "VALIDATION_TOO_SHORT",
            "Dataset has fewer than 8 rows",
            None,
        );
        runstore.record_stage(
            &run_id,
            "validating",
            "FAILED",
            &val_start,
            Some(&Utc::now().to_rfc3339()),
        )?;
        runstore.finish_run(&run_id, "FAILED")?;
        return Err(err);
    }

    emit_progress(PipelineProgressInfo {
        stage: "validating".to_string(),
        progress: 0.04,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("AUDIT".to_string()),
        var_epochs: None,
    });

    emit_progress(PipelineProgressInfo {
        stage: "validating".to_string(),
        progress: 0.05,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("SANITY".to_string()),
        var_epochs: None,
    });
    runstore.record_stage(
        &run_id,
        "validating",
        "DONE",
        &val_start,
        Some(&Utc::now().to_rfc3339()),
    )?;

    // Record parent parameters
    let seed_str = config.seed.to_string();
    let n_str = dataset.n.to_string();
    let h_str = config.pfvi.h.to_string();
    let r0_str = config.pfvi.r0.to_string();
    let dt_str = config.pfvi.dt.to_string();
    let fc_str = config.pfvi.fc.to_string();
    let sat_str = config.pfvi.sat.to_string();
    let max_grid_str = config.pfvi.max_grid_m.to_string();
    let timeout_str = config.pfvi.timeout_s.to_string();
    let k_str = config.imputer.k.to_string();
    let span_str = config.imputer.span.to_string();
    let split_str = config.forecaster.arima.test_split_ratio.to_string();
    let arima_lr_str = config.forecaster.arima.learning_rate.to_string();

    let mut parent_params = vec![
        ("app", "pfrsim"),
        ("pipeline.version", "1"),
        ("dataset_id", dataset.dataset_id.as_str()),
        ("csv_sha", dataset.csv_sha.as_str()),
        ("seed", seed_str.as_str()),
        ("n", n_str.as_str()),
        ("imputer.id", config.imputer.id.as_str()),
        ("imputer.k", k_str.as_str()),
        ("imputer.span", span_str.as_str()),
        ("forecaster.id", config.forecaster.id.as_str()),
        ("arima.test_split_ratio", split_str.as_str()),
        ("arima.learning_rate", arima_lr_str.as_str()),
        ("pfvi.h", h_str.as_str()),
        ("pfvi.r0", r0_str.as_str()),
        ("pfvi.dt", dt_str.as_str()),
        ("pfvi.fc", fc_str.as_str()),
        ("pfvi.sat", sat_str.as_str()),
        ("pfvi.max_grid_m", max_grid_str.as_str()),
        ("pfvi.timeout_s", timeout_str.as_str()),
    ];

    let nn_lookback_str;
    let nn_epochs_str;
    let nn_units_str;
    let nn_batch_str;
    let nn_lr_str;
    if let Some(lstm) = &config.forecaster.lstm {
        nn_lookback_str = lstm.look_back.to_string();
        nn_epochs_str = lstm.epochs.to_string();
        nn_units_str = lstm.layer_units.first().copied().unwrap_or(16).to_string();
        nn_batch_str = if lstm.batch_size == 0 {
            "full".to_string()
        } else {
            lstm.batch_size.to_string()
        };
        nn_lr_str = lstm.learning_rate.to_string();
        parent_params.push(("lstm.look_back", nn_lookback_str.as_str()));
        parent_params.push(("lstm.epochs", nn_epochs_str.as_str()));
        parent_params.push(("lstm.layer_units", nn_units_str.as_str()));
        parent_params.push(("lstm.batch_size", nn_batch_str.as_str()));
        parent_params.push(("lstm.learning_rate", nn_lr_str.as_str()));
        parent_params.push(("lstm.device", lstm.device.as_str()));
    } else if let Some(gru) = &config.forecaster.gru {
        nn_lookback_str = gru.look_back.to_string();
        nn_epochs_str = gru.epochs.to_string();
        nn_units_str = gru.layer_units.first().copied().unwrap_or(16).to_string();
        nn_batch_str = if gru.batch_size == 0 {
            "full".to_string()
        } else {
            gru.batch_size.to_string()
        };
        nn_lr_str = gru.learning_rate.to_string();
        parent_params.push(("gru.look_back", nn_lookback_str.as_str()));
        parent_params.push(("gru.epochs", nn_epochs_str.as_str()));
        parent_params.push(("gru.layer_units", nn_units_str.as_str()));
        parent_params.push(("gru.batch_size", nn_batch_str.as_str()));
        parent_params.push(("gru.learning_rate", nn_lr_str.as_str()));
        parent_params.push(("gru.device", gru.device.as_str()));
    }

    runstore.record_params(&run_id, &parent_params)?;

    // 2. Imputing
    emit_progress(PipelineProgressInfo {
        stage: "imputing".to_string(),
        progress: 0.10,
        epoch: None,
        total_epochs: None,
        current_var: Some("WT".to_string()),
        sub_step: Some("WT".to_string()),
        var_epochs: None,
    });
    let imp_start = Utc::now().to_rfc3339();

    let has_nans = dataset.columns.wt.iter().any(|v| v.is_nan())
        || dataset.columns.sm.iter().any(|v| v.is_nan())
        || dataset.columns.rf.iter().any(|v| v.is_nan())
        || dataset.columns.temp.iter().any(|v| v.is_nan());
    let (imputed_cols, impute_mask, impute_flags, n_imputed, frac_imputed) = if has_nans {
        let imputer = get_imputer(&config.imputer.id)?;
        let imp_res = match imputer.impute(&dataset.columns, &config.imputer, config.seed) {
            Ok(res) => res,
            Err(e) => {
                runstore.record_stage(
                    &run_id,
                    "impute",
                    "FAILED",
                    &imp_start,
                    Some(&Utc::now().to_rfc3339()),
                )?;
                runstore.finish_run(&run_id, "FAILED")?;
                return Err(e);
            }
        };

        // If linear imputer left edge NaNs, fail per Spec 01 §2
        if imp_res.flags.edge_na {
            let mut culprits = Vec::new();
            for (idx, &v) in imp_res.imputed.wt.iter().enumerate() {
                if v.is_nan() {
                    culprits.push(format!("WT[t={}]", idx + 1));
                }
            }
            for (idx, &v) in imp_res.imputed.sm.iter().enumerate() {
                if v.is_nan() {
                    culprits.push(format!("SM[t={}]", idx + 1));
                }
            }
            for (idx, &v) in imp_res.imputed.rf.iter().enumerate() {
                if v.is_nan() {
                    culprits.push(format!("Rf[t={}]", idx + 1));
                }
            }
            for (idx, &v) in imp_res.imputed.temp.iter().enumerate() {
                if v.is_nan() {
                    culprits.push(format!("Temp[t={}]", idx + 1));
                }
            }
            runstore.record_stage(
                &run_id,
                "impute",
                "FAILED",
                &imp_start,
                Some(&Utc::now().to_rfc3339()),
            )?;
            runstore.finish_run(&run_id, "FAILED")?;
            return Err(PfrsimError::impute_edge_na(culprits));
        }

        (
            imp_res.imputed,
            imp_res.mask,
            imp_res.flags,
            imp_res.n_imputed,
            imp_res.frac_imputed,
        )
    } else {
        (
            dataset.columns.clone(),
            ImputeMask {
                wt: vec![false; dataset.n],
                sm: vec![false; dataset.n],
                rf: vec![false; dataset.n],
                temp: vec![false; dataset.n],
            },
            ImputeFlags {
                edge_na: false,
                overshoot: false,
                sparse_abort: false,
                warnings: Vec::new(),
            },
            0,
            0.0,
        )
    };

    // Record impute metrics
    let wt_imp_count = impute_mask.wt.iter().filter(|&&m| m).count() as f64;
    let sm_imp_count = impute_mask.sm.iter().filter(|&&m| m).count() as f64;
    let rf_imp_count = impute_mask.rf.iter().filter(|&&m| m).count() as f64;
    let temp_imp_count = impute_mask.temp.iter().filter(|&&m| m).count() as f64;

    let impute_metrics = vec![
        ("impute.n_imputed", n_imputed as f64),
        ("impute.frac_imputed", frac_imputed),
        ("impute.n_imputed.wt", wt_imp_count),
        ("impute.n_imputed.sm", sm_imp_count),
        ("impute.n_imputed.rf", rf_imp_count),
        ("impute.n_imputed.temp", temp_imp_count),
        (
            "impute.flag.edge_na",
            if impute_flags.edge_na { 1.0 } else { 0.0 },
        ),
        (
            "impute.flag.overshoot",
            if impute_flags.overshoot { 1.0 } else { 0.0 },
        ),
        (
            "impute.flag.sparse_abort",
            if impute_flags.sparse_abort { 1.0 } else { 0.0 },
        ),
    ];
    runstore.record_metrics(&run_id, "impute", &impute_metrics)?;
    runstore.record_stage(
        &run_id,
        "impute",
        "DONE",
        &imp_start,
        Some(&Utc::now().to_rfc3339()),
    )?;

    // 3. Forecasting with fine-grained epoch and series tracking
    let fc_start = Utc::now().to_rfc3339();
    let forecaster = get_forecaster(&config.forecaster.id)?;

    emit_progress(PipelineProgressInfo {
        stage: "forecasting".to_string(),
        progress: 0.25,
        epoch: Some(0),
        total_epochs: None,
        current_var: Some("WT".to_string()),
        sub_step: Some("WT".to_string()),
        var_epochs: None,
    });

    use std::sync::atomic::{AtomicUsize, Ordering};
    let wt_epoch = AtomicUsize::new(0);
    let sm_epoch = AtomicUsize::new(0);
    let rf_epoch = AtomicUsize::new(0);
    let temp_epoch = AtomicUsize::new(0);

    let epoch_cb = |var_name: &str, epoch: usize, total_epochs: usize| {
        match var_name {
            "WT" => wt_epoch.fetch_max(epoch, Ordering::Relaxed),
            "SM" => sm_epoch.fetch_max(epoch, Ordering::Relaxed),
            "Rf" => rf_epoch.fetch_max(epoch, Ordering::Relaxed),
            _ => temp_epoch.fetch_max(epoch, Ordering::Relaxed),
        };

        let cur_wt = wt_epoch.load(Ordering::Relaxed);
        let cur_sm = sm_epoch.load(Ordering::Relaxed);
        let cur_rf = rf_epoch.load(Ordering::Relaxed);
        let cur_temp = temp_epoch.load(Ordering::Relaxed);

        let total_completed = cur_wt + cur_sm + cur_rf + cur_temp;
        let target_total = (4 * total_epochs).max(1);
        let overall_frac = (total_completed as f64 / target_total as f64).min(1.0);
        let fc_progress = 0.25 + overall_frac * 0.40;

        let mut epochs_map = HashMap::with_capacity(4);
        epochs_map.insert("WT".to_string(), cur_wt);
        epochs_map.insert("SM".to_string(), cur_sm);
        epochs_map.insert("Rf".to_string(), cur_rf);
        epochs_map.insert("Temp".to_string(), cur_temp);

        emit_progress(PipelineProgressInfo {
            stage: format!("forecasting ({var_name} epoch {epoch}/{total_epochs})"),
            progress: fc_progress,
            epoch: Some(epoch),
            total_epochs: Some(total_epochs),
            current_var: Some(var_name.to_string()),
            sub_step: Some(var_name.to_string()),
            var_epochs: Some(epochs_map),
        });
    };
    let forecast_res = match forecaster.forecast(
        &imputed_cols,
        &config.forecaster,
        config.pfvi.h,
        config.seed,
        Some(&epoch_cb as &EpochCallback<'_>),
    ) {
        Ok(res) => res,
        Err(e) => {
            runstore.record_stage(
                &run_id,
                "forecast",
                "FAILED",
                &fc_start,
                Some(&Utc::now().to_rfc3339()),
            )?;
            runstore.finish_run(&run_id, "FAILED")?;
            return Err(e);
        }
    };

    // Record forecast metrics per variable
    let mut fc_metrics: Vec<(String, f64)> = Vec::new();
    let forecaster_id = config.forecaster.id.to_lowercase();

    let record_var_metrics = |metrics_vec: &mut Vec<(String, f64)>,
                              var: &str,
                              info: &crate::forecaster::ArimaVariableInfo,
                              fc_id: &str| {
        if let Some(h_met) = &info.holdout {
            metrics_vec.push((format!("forecast.{var}.mse"), h_met.mse));
            metrics_vec.push((format!("forecast.{var}.rmse"), h_met.rmse));
            metrics_vec.push((format!("forecast.{var}.mae"), h_met.mae));
        }
        if fc_id == "arima" {
            metrics_vec.push((format!("arima.{var}.aic"), info.aic));
            metrics_vec.push((format!("arima.{var}.bic"), info.bic));
            metrics_vec.push((format!("arima.{var}.ljungbox_p"), info.ljungbox_p));
            metrics_vec.push((format!("arima.{var}.lambda"), info.lambda));
            metrics_vec.push((format!("arima.{var}.k"), info.k));
            metrics_vec.push((format!("arima.{var}.order_p"), info.order.0 as f64));
            metrics_vec.push((format!("arima.{var}.order_d"), info.order.1 as f64));
            metrics_vec.push((format!("arima.{var}.order_q"), info.order.2 as f64));
        } else {
            metrics_vec.push((format!("{fc_id}.{var}.look_back"), info.order.0 as f64));
            metrics_vec.push((format!("{fc_id}.{var}.hidden_units"), info.order.2 as f64));
            metrics_vec.push((format!("{fc_id}.{var}.final_loss"), info.aic));
        }
    };

    record_var_metrics(
        &mut fc_metrics,
        "wt",
        &forecast_res.metrics.wt,
        &forecaster_id,
    );
    record_var_metrics(
        &mut fc_metrics,
        "sm",
        &forecast_res.metrics.sm,
        &forecaster_id,
    );
    record_var_metrics(
        &mut fc_metrics,
        "rf",
        &forecast_res.metrics.rf,
        &forecaster_id,
    );
    record_var_metrics(
        &mut fc_metrics,
        "temp",
        &forecast_res.metrics.temp,
        &forecaster_id,
    );
    runstore.record_metrics(&run_id, "forecast", &fc_metrics)?;
    runstore.record_stage(
        &run_id,
        "forecast",
        "DONE",
        &fc_start,
        Some(&Utc::now().to_rfc3339()),
    )?;

    // 4. Concat history + forecast
    let mut wt_full = imputed_cols.wt.clone();
    let mut sm_full = imputed_cols.sm.clone();
    let mut rf_full = imputed_cols.rf.clone();
    let mut temp_full = imputed_cols.temp.clone();

    wt_full.extend_from_slice(&forecast_res.forecast.wt);
    sm_full.extend_from_slice(&forecast_res.forecast.sm);
    rf_full.extend_from_slice(&forecast_res.forecast.rf);
    temp_full.extend_from_slice(&forecast_res.forecast.temp);

    // 5. Fitting PFVI
    emit_progress(PipelineProgressInfo {
        stage: "fitting-pfvi".to_string(),
        progress: 0.70,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("GRID".to_string()),
        var_epochs: None,
    });
    let pfvi_start = Utc::now().to_rfc3339();

    emit_progress(PipelineProgressInfo {
        stage: "fitting-pfvi".to_string(),
        progress: 0.76,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("OPTIM".to_string()),
        var_epochs: None,
    });

    let pfvi_res = match fit_pfvi(&wt_full, &sm_full, &rf_full, &temp_full, &config.pfvi) {
        Ok(res) => res,
        Err(e) => {
            runstore.record_stage(
                &run_id,
                "pfvi",
                "FAILED",
                &pfvi_start,
                Some(&Utc::now().to_rfc3339()),
            )?;
            runstore.finish_run(&run_id, "FAILED")?;
            return Err(e);
        }
    };

    // Record PFVI metrics
    let mut pfvi_metrics: Vec<(String, f64)> = vec![
        ("pfvi.mse".to_string(), pfvi_res.mse),
        ("pfvi.aH".to_string(), pfvi_res.transformation_parameters[0]),
        ("pfvi.bH".to_string(), pfvi_res.transformation_parameters[1]),
        ("pfvi.n".to_string(), pfvi_res.transformation_parameters[2]),
        (
            "pfvi.alpha".to_string(),
            pfvi_res.transformation_parameters[3],
        ),
        ("pfvi.grid_evals".to_string(), pfvi_res.grid_evals as f64),
        ("pfvi.fit_seconds".to_string(), pfvi_res.fit_seconds),
        (
            "pfvi.flag.grid_truncated".to_string(),
            if pfvi_res.grid_truncated { 1.0 } else { 0.0 },
        ),
    ];

    // Trailing h values & classes (0=Low, 1=Moderate, 2=High, 3=Extreme)
    for (i, (&v, cls)) in pfvi_res
        .h_values
        .iter()
        .zip(&pfvi_res.h_classes)
        .enumerate()
    {
        let code = match cls.as_str() {
            "Low" => 0.0,
            "Moderate" => 1.0,
            "High" => 2.0,
            _ => 3.0,
        };
        pfvi_metrics.push((format!("pfvi.h{}.value", i + 1), v));
        pfvi_metrics.push((format!("pfvi.h{}.class", i + 1), code));
    }

    runstore.record_metrics(&run_id, "pfvi", &pfvi_metrics)?;
    runstore.record_stage(
        &run_id,
        "pfvi",
        "DONE",
        &pfvi_start,
        Some(&Utc::now().to_rfc3339()),
    )?;

    // 6. Assemble frames (t = 1..=n+h)
    let total_len = dataset.n + config.pfvi.h;
    // For large datasets, cap simulation playback frames to the most recent 2,500 points + forecast
    // to prevent serializing multi-gigabyte JSON strings and crashing the Webview player with Out Of Memory.
    let frame_start = if total_len > 2500 {
        total_len - 2500
    } else {
        0
    };
    let mut frames = Vec::with_capacity(total_len - frame_start);

    for i in frame_start..total_len {
        let is_fc = i >= dataset.n;
        let t = i + 1;
        let time_label = if !is_fc {
            dataset
                .time_labels
                .as_ref()
                .and_then(|tl| tl.get(i).cloned())
        } else {
            Some(format!("+{}d", i - dataset.n + 1))
        };

        let imp_info = if !is_fc {
            FrameImputed {
                wt: impute_mask.wt[i],
                sm: impute_mask.sm[i],
                rf: impute_mask.rf[i],
                temp: impute_mask.temp[i],
            }
        } else {
            FrameImputed {
                wt: false,
                sm: false,
                rf: false,
                temp: false,
            }
        };

        let (cls, code) = classify_val(pfvi_res.pfvi[i]);

        frames.push(SimulationFrame {
            t,
            time_label,
            wt: wt_full[i],
            sm: sm_full[i],
            rf: rf_full[i],
            temp: temp_full[i],
            pfvi: pfvi_res.pfvi[i],
            diobs: pfvi_res.diobs[i],
            class: cls.to_string(),
            class_code: code,
            is_forecast: is_fc,
            imputed: imp_info,
            water_distribution: pfvi_res.water_distribution[i],
            rainfall_effect: pfvi_res.rainfall[i],
            soil_fluctuation: pfvi_res.soil_fluctuation[i],
            water_depth: pfvi_res.water_depth[i],
        });
    }

    // 7. Materializing artifacts
    emit_progress(PipelineProgressInfo {
        stage: "materializing".to_string(),
        progress: 0.88,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: Some("CONCAT".to_string()),
        var_epochs: None,
    });
    let mut crate_versions = HashMap::new();
    crate_versions.insert(
        "pfrsim-core".to_string(),
        env!("CARGO_PKG_VERSION").to_string(),
    );
    crate_versions.insert("rustc".to_string(), "1.96.1".to_string());

    let manifest = Manifest {
        run_id: run_id.clone(),
        dataset_id: dataset.dataset_id.clone(),
        csv_sha: dataset.csv_sha.clone(),
        config: serde_json::to_value(config)?,
        seed: config.seed,
        crate_versions,
        frames_sha256: String::new(),
        created_at: Utc::now().to_rfc3339(),
        peatfr_parity: true,
    };

    let mut orders_map = HashMap::new();
    orders_map.insert("wt".to_string(), forecast_res.metrics.wt.order);
    orders_map.insert("sm".to_string(), forecast_res.metrics.sm.order);
    orders_map.insert("rf".to_string(), forecast_res.metrics.rf.order);
    orders_map.insert("temp".to_string(), forecast_res.metrics.temp.order);

    let mut lambdas_map = HashMap::new();
    lambdas_map.insert("wt".to_string(), forecast_res.metrics.wt.lambda);
    lambdas_map.insert("sm".to_string(), forecast_res.metrics.sm.lambda);
    lambdas_map.insert("rf".to_string(), forecast_res.metrics.rf.lambda);
    lambdas_map.insert("temp".to_string(), forecast_res.metrics.temp.lambda);

    let mut shifts_map = HashMap::new();
    shifts_map.insert("wt".to_string(), forecast_res.metrics.wt.k);
    shifts_map.insert("sm".to_string(), forecast_res.metrics.sm.k);
    shifts_map.insert("rf".to_string(), forecast_res.metrics.rf.k);
    shifts_map.insert("temp".to_string(), forecast_res.metrics.temp.k);

    let model = ModelJson {
        imputer_id: config.imputer.id.clone(),
        forecaster_id: config.forecaster.id.clone(),
        pfvi_params: pfvi_res.transformation_parameters,
        pfvi_mse: pfvi_res.mse,
        arima_orders: orders_map,
        arima_lambdas: lambdas_map,
        arima_shifts: shifts_map,
    };

    // CSV strings
    let mut imp_wtr = csv::Writer::from_writer(vec![]);
    imp_wtr.write_record(&["WT", "SM", "Rf", "Temp"]).unwrap();
    let imp_start_row = if dataset.n > 2500 {
        dataset.n - 2500
    } else {
        0
    };
    for i in imp_start_row..dataset.n {
        imp_wtr
            .write_record(&[
                format!("{:.4}", imputed_cols.wt[i]),
                format!("{:.4}", imputed_cols.sm[i]),
                format!("{:.6}", imputed_cols.rf[i]),
                format!("{:.2}", imputed_cols.temp[i]),
            ])
            .unwrap();
    }
    let imputed_csv_str = String::from_utf8(imp_wtr.into_inner().unwrap()).unwrap_or_default();

    let mut fc_wtr = csv::Writer::from_writer(vec![]);
    fc_wtr
        .write_record(&["step", "WT", "SM", "Rf", "Temp"])
        .unwrap();
    for i in 0..config.pfvi.h {
        fc_wtr
            .write_record(&[
                (i + 1).to_string(),
                format!("{:.4}", forecast_res.forecast.wt[i]),
                format!("{:.4}", forecast_res.forecast.sm[i]),
                format!("{:.6}", forecast_res.forecast.rf[i]),
                format!("{:.2}", forecast_res.forecast.temp[i]),
            ])
            .unwrap();
    }
    let forecast_csv_str = String::from_utf8(fc_wtr.into_inner().unwrap()).unwrap_or_default();

    let mut pfvi_wtr = csv::Writer::from_writer(vec![]);
    pfvi_wtr
        .write_record(&["t", "PFVI", "DIobs", "class", "is_forecast"])
        .unwrap();
    for f in &frames {
        pfvi_wtr
            .write_record(&[
                f.t.to_string(),
                format!("{:.2}", f.pfvi),
                format!("{:.2}", f.diobs),
                f.class.clone(),
                f.is_forecast.to_string(),
            ])
            .unwrap();
    }
    let pfvi_csv_str = String::from_utf8(pfvi_wtr.into_inner().unwrap()).unwrap_or_default();

    let mut frozen_metrics = HashMap::new();
    for (k, v) in &impute_metrics {
        frozen_metrics.insert(k.to_string(), *v);
    }
    for (k, v) in &fc_metrics {
        frozen_metrics.insert(k.to_string(), *v);
    }
    for (k, v) in &pfvi_metrics {
        frozen_metrics.insert(k.to_string(), *v);
    }
    let metrics_json_str = serde_json::to_string_pretty(&frozen_metrics)?;

    let artifacts = materialize_artifacts(
        base_dir,
        &run_id,
        manifest,
        &model,
        &frames,
        &imputed_csv_str,
        &forecast_csv_str,
        &pfvi_csv_str,
        &metrics_json_str,
    )?;

    // Record artifacts in run store
    for art in &artifacts.entries {
        runstore.record_artifact(&run_id, &art.kind, &art.path, &art.sha256)?;
    }

    runstore.finish_run(&run_id, "DONE")?;
    emit_progress(PipelineProgressInfo {
        stage: "done".to_string(),
        progress: 1.0,
        epoch: None,
        total_epochs: None,
        current_var: None,
        sub_step: None,
        var_epochs: None,
    });
    Ok(PipelineRunResult {
        run_id,
        job_id: job_id.to_string(),
        dataset_id: dataset.dataset_id.clone(),
        frames_sha256: artifacts.frames_sha256,
        n_frames: total_len,
        pfvi_mse: pfvi_res.mse,
        h_classes: pfvi_res.h_classes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingest::parse_csv;
    use tempfile::tempdir;

    #[test]
    fn test_pipeline_smoke_and_determinism() {
        let csv = r#"WT,SM,Rf,Temp
-1.021,35.424,0.00012,35.4
-0.972,NA,0.00024,35.8
NA,37.268,0.00011,NA
-1.204,38.453,NA,36.5
-0.906,31.456,NA,36.3
-0.993,33.235,0.00046,37.2
-1.327,30.168,0.00052,37.0
-2.001,30.212,0.00041,38.1"#;

        let ds = parse_csv(csv, "example8.csv").expect("parsed ds");
        let dir = tempdir().unwrap();
        let store = RunStore::open_in_memory().unwrap();
        store.save_dataset(&ds).unwrap();

        let mut config = PipelineConfig::default();
        config.imputer.id = "knn".to_string();
        config.imputer.k = 5;
        config.forecaster.id = "arima".to_string();
        config.pfvi.r0 = 2700.0;
        config.pfvi.h = 4;
        config.seed = 42;

        let res1 = execute_pipeline(&ds, &config, dir.path(), &store, "job-1", None)
            .expect("pipeline execution 1 should succeed");
        assert_eq!(res1.n_frames, 12); // 8 + 4
        assert_eq!(res1.h_classes.len(), 4);

        // Run second time with identical seed and config
        let res2 = execute_pipeline(&ds, &config, dir.path(), &store, "job-2", None)
            .expect("pipeline execution 2 should succeed");

        // Determinism assertion
        assert_eq!(res1.frames_sha256, res2.frames_sha256);
    }
}
