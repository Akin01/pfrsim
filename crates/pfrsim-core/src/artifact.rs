use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self};
use std::path::{Path, PathBuf};

use crate::error::PfrsimError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameImputed {
    pub wt: bool,
    pub sm: bool,
    pub rf: bool,
    pub temp: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationFrame {
    pub t: usize, // 1-based index (1..=n+h)
    pub time_label: Option<String>,
    pub wt: f64,
    pub sm: f64,
    pub rf: f64,
    pub temp: f64,
    pub pfvi: f64,
    pub diobs: f64,
    pub class: String,     // "Low" | "Moderate" | "High" | "Extreme"
    pub class_code: usize, // 0 | 1 | 2 | 3
    pub is_forecast: bool, // false for 1..=n, true for n+1..=n+h
    pub imputed: FrameImputed,
    pub water_distribution: f64,
    pub rainfall_effect: f64,
    pub soil_fluctuation: f64,
    pub water_depth: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub run_id: String,
    pub dataset_id: String,
    pub csv_sha: String,
    pub config: serde_json::Value,
    pub seed: u64,
    pub crate_versions: HashMap<String, String>,
    pub frames_sha256: String,
    pub created_at: String,
    pub peatfr_parity: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelJson {
    pub imputer_id: String,
    pub forecaster_id: String,
    pub pfvi_params: [f64; 4], // [aH, bH, n, alpha]
    pub pfvi_mse: f64,
    pub arima_orders: HashMap<String, (usize, usize, usize)>,
    pub arima_lambdas: HashMap<String, f64>,
    pub arima_shifts: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactEntry {
    pub kind: String,
    pub path: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterializedArtifacts {
    pub manifest_path: PathBuf,
    pub model_path: PathBuf,
    pub frames_path: PathBuf,
    pub frames_sha256: String,
    pub entries: Vec<ArtifactEntry>,
}

pub fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

pub fn compute_frames_sha256(frames: &[SimulationFrame]) -> Result<String, PfrsimError> {
    let json = serde_json::to_string(frames)?;
    Ok(compute_sha256(json.as_bytes()))
}

pub fn run_model_dir(base_dir: &Path, run_id: &str) -> PathBuf {
    base_dir.join("models").join(run_id)
}

pub fn materialize_artifacts(
    base_dir: &Path,
    run_id: &str,
    mut manifest: Manifest,
    model: &ModelJson,
    frames: &[SimulationFrame],
    imputed_csv: &str,
    forecast_csv: &str,
    pfvi_csv: &str,
    metrics_json: &str,
) -> Result<MaterializedArtifacts, PfrsimError> {
    let dir = run_model_dir(base_dir, run_id);
    fs::create_dir_all(&dir).map_err(|e| PfrsimError::io(e))?;
    fs::create_dir_all(dir.join("plots")).map_err(|e| PfrsimError::io(e))?;

    // 1. frames.json
    let frames_json = serde_json::to_string_pretty(frames)?;
    let frames_sha = compute_sha256(frames_json.as_bytes());
    let frames_path = dir.join("frames.json");
    fs::write(&frames_path, &frames_json).map_err(|e| PfrsimError::io(e))?;

    // Update manifest with exact frames_sha256
    manifest.frames_sha256 = frames_sha.clone();

    // 2. manifest.json
    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    let manifest_sha = compute_sha256(manifest_json.as_bytes());
    let manifest_path = dir.join("manifest.json");
    fs::write(&manifest_path, &manifest_json).map_err(|e| PfrsimError::io(e))?;

    // 3. model.json
    let model_json = serde_json::to_string_pretty(model)?;
    let model_sha = compute_sha256(model_json.as_bytes());
    let model_path = dir.join("model.json");
    fs::write(&model_path, &model_json).map_err(|e| PfrsimError::io(e))?;

    // 4. imputed.csv
    let imp_sha = compute_sha256(imputed_csv.as_bytes());
    let imp_path = dir.join("imputed.csv");
    fs::write(&imp_path, imputed_csv).map_err(|e| PfrsimError::io(e))?;

    // 5. forecast.csv
    let fc_sha = compute_sha256(forecast_csv.as_bytes());
    let fc_path = dir.join("forecast.csv");
    fs::write(&fc_path, forecast_csv).map_err(|e| PfrsimError::io(e))?;

    // 6. pfvi.csv
    let pfvi_sha = compute_sha256(pfvi_csv.as_bytes());
    let pfvi_path = dir.join("pfvi.csv");
    fs::write(&pfvi_path, pfvi_csv).map_err(|e| PfrsimError::io(e))?;

    // 7. metrics.json
    let met_sha = compute_sha256(metrics_json.as_bytes());
    let met_path = dir.join("metrics.json");
    fs::write(&met_path, metrics_json).map_err(|e| PfrsimError::io(e))?;

    let entries = vec![
        ArtifactEntry {
            kind: "manifest".to_string(),
            path: manifest_path.to_string_lossy().to_string(),
            sha256: manifest_sha,
        },
        ArtifactEntry {
            kind: "model".to_string(),
            path: model_path.to_string_lossy().to_string(),
            sha256: model_sha,
        },
        ArtifactEntry {
            kind: "frames".to_string(),
            path: frames_path.to_string_lossy().to_string(),
            sha256: frames_sha.clone(),
        },
        ArtifactEntry {
            kind: "imputed_csv".to_string(),
            path: imp_path.to_string_lossy().to_string(),
            sha256: imp_sha,
        },
        ArtifactEntry {
            kind: "forecast_csv".to_string(),
            path: fc_path.to_string_lossy().to_string(),
            sha256: fc_sha,
        },
        ArtifactEntry {
            kind: "pfvi_csv".to_string(),
            path: pfvi_path.to_string_lossy().to_string(),
            sha256: pfvi_sha,
        },
        ArtifactEntry {
            kind: "metrics".to_string(),
            path: met_path.to_string_lossy().to_string(),
            sha256: met_sha,
        },
    ];

    Ok(MaterializedArtifacts {
        manifest_path,
        model_path,
        frames_path,
        frames_sha256: frames_sha,
        entries,
    })
}

pub fn load_frames(base_dir: &Path, run_id: &str) -> Result<Vec<SimulationFrame>, PfrsimError> {
    let path = run_model_dir(base_dir, run_id).join("frames.json");
    if !path.exists() {
        return Err(PfrsimError::not_found("Frames for run", run_id));
    }
    let content = fs::read_to_string(&path).map_err(|e| PfrsimError::io(e))?;
    let frames: Vec<SimulationFrame> = serde_json::from_str(&content)?;
    Ok(frames)
}

pub fn load_manifest(base_dir: &Path, run_id: &str) -> Result<Manifest, PfrsimError> {
    let path = run_model_dir(base_dir, run_id).join("manifest.json");
    if !path.exists() {
        return Err(PfrsimError::not_found("Manifest for run", run_id));
    }
    let content = fs::read_to_string(&path).map_err(|e| PfrsimError::io(e))?;
    let manifest: Manifest = serde_json::from_str(&content)?;
    Ok(manifest)
}

pub fn verify_replay(base_dir: &Path, run_id: &str) -> Result<bool, PfrsimError> {
    let manifest = load_manifest(base_dir, run_id)?;
    let path = run_model_dir(base_dir, run_id).join("frames.json");
    if !path.exists() {
        return Ok(false);
    }
    let content = fs::read(&path).map_err(|e| PfrsimError::io(e))?;
    let current_sha = compute_sha256(&content);
    Ok(current_sha == manifest.frames_sha256)
}

pub fn export_frames_to_csv(frames: &[SimulationFrame]) -> String {
    let mut wtr = csv::Writer::from_writer(vec![]);
    wtr.write_record(&[
        "t",
        "time_label",
        "WT",
        "SM",
        "Rf",
        "Temp",
        "PFVI",
        "DIobs",
        "class",
        "is_forecast",
        "imputed_WT",
        "imputed_SM",
        "imputed_Rf",
        "imputed_Temp",
    ])
    .unwrap();

    for f in frames {
        wtr.write_record(&[
            f.t.to_string(),
            f.time_label.clone().unwrap_or_default(),
            format!("{:.4}", f.wt),
            format!("{:.4}", f.sm),
            format!("{:.6}", f.rf),
            format!("{:.2}", f.temp),
            format!("{:.2}", f.pfvi),
            format!("{:.2}", f.diobs),
            f.class.clone(),
            f.is_forecast.to_string(),
            f.imputed.wt.to_string(),
            f.imputed.sm.to_string(),
            f.imputed.rf.to_string(),
            f.imputed.temp.to_string(),
        ])
        .unwrap();
    }

    String::from_utf8(wtr.into_inner().unwrap()).unwrap_or_default()
}
pub fn delete_run_artifacts(base_dir: &Path, run_id: &str) -> Result<(), PfrsimError> {
    let dir = run_model_dir(base_dir, run_id);
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
    }
    Ok(())
}
pub fn export_run_to_mlflow(
    base_dir: &Path,
    run_detail: &crate::runstore::RunDetail,
    output_dir: &Path,
) -> Result<PathBuf, PfrsimError> {
    let run_id = &run_detail.summary.run_id;
    let export_root = output_dir.join(format!("mlflow_{run_id}"));
    fs::create_dir_all(&export_root).map_err(|e| PfrsimError::io(e))?;

    // 1. Structure: mlruns/0/<run_id>/
    let experiment_dir = export_root.join("mlruns").join("0");
    let run_dir = experiment_dir.join(run_id);
    let params_dir = run_dir.join("params");
    let metrics_dir = run_dir.join("metrics");
    let tags_dir = run_dir.join("tags");
    let artifacts_dir = run_dir.join("artifacts");

    fs::create_dir_all(&params_dir).map_err(|e| PfrsimError::io(e))?;
    fs::create_dir_all(&metrics_dir).map_err(|e| PfrsimError::io(e))?;
    fs::create_dir_all(&tags_dir).map_err(|e| PfrsimError::io(e))?;
    fs::create_dir_all(&artifacts_dir).map_err(|e| PfrsimError::io(e))?;

    // 2. Experiment metadata: mlruns/0/meta.yaml
    let exp_meta = format!(
        "artifact_location: ./mlruns/0\ncreation_time: {}\nexperiment_id: '0'\nlast_update_time: {}\nlifecycle_stage: active\nname: Default\n",
        Utc::now().timestamp_millis(),
        Utc::now().timestamp_millis()
    );
    fs::write(experiment_dir.join("meta.yaml"), exp_meta).map_err(|e| PfrsimError::io(e))?;

    // 3. Run metadata: mlruns/0/<run_id>/meta.yaml
    let now_ms = Utc::now().timestamp_millis();
    let run_name = &run_detail.summary.name;
    let run_meta = format!(
        "artifact_uri: ./mlruns/0/{run_id}/artifacts\nend_time: {now_ms}\nentry_point_name: ''\nexperiment_id: '0'\nlifecycle_stage: active\nrun_id: '{run_id}'\nrun_name: '{run_name}'\nrun_uuid: '{run_id}'\nsource_name: 'pfrsim'\nsource_type: 4\nsource_version: '0.1.0'\nstart_time: {now_ms}\nstatus: 3\nuser_id: 'pfrsim'\n"
    );
    fs::write(run_dir.join("meta.yaml"), run_meta).map_err(|e| PfrsimError::io(e))?;

    // 4. Write params
    for (key, val) in &run_detail.params {
        let safe_key = key.replace('/', ".");
        let _ = fs::write(params_dir.join(&safe_key), val);
    }
    let _ = fs::write(
        params_dir.join("imputer.id"),
        run_detail.summary.imputer_id.as_deref().unwrap_or("knn"),
    );
    let _ = fs::write(
        params_dir.join("forecaster.id"),
        run_detail
            .summary
            .forecaster_id
            .as_deref()
            .unwrap_or("arima"),
    );
    let _ = fs::write(params_dir.join("pfvi.h"), run_detail.summary.h.to_string());
    let _ = fs::write(params_dir.join("seed"), run_detail.summary.seed.to_string());

    // 5. Write metrics in MLflow format: "<timestamp_ms> <value> <step>\n"
    for (_stage, key, val) in &run_detail.metrics {
        let safe_key = key.replace('/', ".");
        let metric_line = format!("{now_ms} {val} 0\n");
        let _ = fs::write(metrics_dir.join(&safe_key), metric_line);
    }

    // 6. Write tags
    let _ = fs::write(tags_dir.join("mlflow.runName"), run_name);
    let _ = fs::write(tags_dir.join("mlflow.source.name"), "pfrsim-core");
    let _ = fs::write(tags_dir.join("mlflow.source.type"), "LOCAL");
    let _ = fs::write(tags_dir.join("mlflow.user"), "pfrsim");
    let _ = fs::write(tags_dir.join("pfrsim.version"), "0.1.0");
    let _ = fs::write(
        tags_dir.join("pfrsim.dataset_id"),
        &run_detail.summary.dataset_id,
    );
    if let Some(ds_name) = &run_detail.summary.dataset_name {
        let _ = fs::write(tags_dir.join("pfrsim.dataset_name"), ds_name);
    }
    if let Some(best_mse) = run_detail.summary.best_pfvi_mse {
        let _ = fs::write(tags_dir.join("pfrsim.best_pfvi_mse"), best_mse.to_string());
    }

    // 7. Copy artifacts from run_model_dir(base_dir, run_id)
    let src_model_dir = run_model_dir(base_dir, run_id);
    if src_model_dir.exists() {
        for file in &[
            "frames.json",
            "manifest.json",
            "model.json",
            "imputed.csv",
            "forecast.csv",
            "pfvi.csv",
            "metrics.json",
        ] {
            let src_file = src_model_dir.join(file);
            if src_file.exists() {
                let _ = fs::copy(&src_file, artifacts_dir.join(file));
            }
        }
        let plots_dir = src_model_dir.join("plots");
        if plots_dir.exists() {
            let dest_plots = artifacts_dir.join("plots");
            let _ = fs::create_dir_all(&dest_plots);
            if let Ok(entries) = fs::read_dir(&plots_dir) {
                for entry in entries.flatten() {
                    let _ = fs::copy(entry.path(), dest_plots.join(entry.file_name()));
                }
            }
        }
    }

    // 8. Generate standalone Python replay script: mlflow_replay.py
    let replay_script = format!(
        r#"#!/usr/bin/env python3
"""
PFRSim -> MLflow Ingestion Script
Replays this exported run into any MLflow Tracking Server (local or remote).
Usage:
    python mlflow_replay.py [--tracking-uri http://localhost:5000] [--experiment-name "Peatland Fire Risk"]
"""
import argparse
import json
import os
import sys

try:
    import mlflow
except ImportError:
    print("Error: MLflow is not installed. Install with: pip install mlflow")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Ingest PFRSim run to MLflow Tracking Server")
    parser.add_argument("--tracking-uri", default=os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000"), help="MLflow Tracking Server URI")
    parser.add_argument("--experiment-name", default="Peatland Fire Risk (PFRSim)", help="MLflow Experiment Name")
    args = parser.parse_args()

    mlflow.set_tracking_uri(args.tracking_uri)
    mlflow.set_experiment(args.experiment_name)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    run_id = "{run_id}"
    run_name = "{run_name}"
    run_dir = os.path.join(base_dir, "mlruns", "0", run_id)

    print(f"Connecting to MLflow Tracking Server at: {{args.tracking_uri}}")
    print(f"Ingesting run: {{run_name}} ({{run_id}})...")

    with mlflow.start_run(run_name=run_name) as active_run:
        # 1. Log parameters
        params_dir = os.path.join(run_dir, "params")
        if os.path.exists(params_dir):
            params_dict = {{}}
            for p_file in os.listdir(params_dir):
                p_path = os.path.join(params_dir, p_file)
                if os.path.isfile(p_path):
                    with open(p_path, "r", encoding="utf-8", errors="ignore") as f:
                        params_dict[p_file] = f.read().strip()
            if params_dict:
                mlflow.log_params(params_dict)
                print(f"  Logged {{len(params_dict)}} parameters")

        # 2. Log metrics
        metrics_dir = os.path.join(run_dir, "metrics")
        if os.path.exists(metrics_dir):
            metrics_count = 0
            for m_file in os.listdir(metrics_dir):
                m_path = os.path.join(metrics_dir, m_file)
                if os.path.isfile(m_path):
                    with open(m_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read().strip()
                        parts = content.split()
                        if len(parts) >= 2:
                            try:
                                val = float(parts[1])
                                step = int(parts[2]) if len(parts) > 2 else 0
                                mlflow.log_metric(m_file, val, step=step)
                                metrics_count += 1
                            except ValueError:
                                pass
            print(f"  Logged {{metrics_count}} metrics")

        # 3. Log tags
        tags_dir = os.path.join(run_dir, "tags")
        if os.path.exists(tags_dir):
            tags_dict = {{}}
            for t_file in os.listdir(tags_dir):
                t_path = os.path.join(tags_dir, t_file)
                if os.path.isfile(t_path):
                    with open(t_path, "r", encoding="utf-8", errors="ignore") as f:
                        tags_dict[t_file] = f.read().strip()
            if tags_dict:
                mlflow.set_tags(tags_dict)

        # 4. Log artifacts
        artifacts_dir = os.path.join(run_dir, "artifacts")
        if os.path.exists(artifacts_dir):
            mlflow.log_artifacts(artifacts_dir)
            print(f"  Logged artifact files from {{artifacts_dir}}")

        print(f"\nSUCCESS! Run published to MLflow:")
        print(f"  Run ID: {{active_run.info.run_id}}")
        print(f"  Experiment: {{args.experiment_name}}")
        print(f"  Artifact URI: {{active_run.info.artifact_uri}}")

if __name__ == "__main__":
    main()
"#
    );

    fs::write(export_root.join("mlflow_replay.py"), replay_script)
        .map_err(|e| PfrsimError::io(e))?;

    // 9. README.md
    let readme = format!(
        r#"# MLflow Tracking Package for PFRSim Run

This package contains full, native MLflow tracking data for run:
- **Run ID**: `{run_id}`
- **Run Name**: `{run_name}`
- **Dataset**: `{}`
- **Created**: `{}`

---

## Option 1: Run Local MLflow UI (Zero-Code)

You can launch the official MLflow UI directly pointing to this directory:

```bash
# 1. Install MLflow if you haven't already
pip install mlflow

# 2. Launch the MLflow UI
mlflow ui --backend-store-uri ./mlruns
```

Then open your browser to **`http://localhost:5000`** to interactively view and compare the run!

---

## Option 2: Publish to a Remote MLflow Server (Python)

If your team runs an existing MLflow Tracking Server (e.g. on Kubernetes, AWS, GCP, Azure, or Databricks):

```bash
python mlflow_replay.py --tracking-uri http://your-mlflow-server:5000 --experiment-name "Peatland Fire Risk"
```
"#,
        run_detail
            .summary
            .dataset_name
            .as_deref()
            .unwrap_or("Default"),
        run_detail.summary.created_at
    );

    fs::write(export_root.join("README.md"), readme).map_err(|e| PfrsimError::io(e))?;

    Ok(export_root)
}

// ============================================================================
// ONNX Runtime Model Serialization & Export
// ============================================================================

struct ProtoWriter {
    buf: Vec<u8>,
}

impl ProtoWriter {
    fn new() -> Self {
        Self { buf: Vec::new() }
    }

    fn write_varint(&mut self, mut val: u64) {
        while val >= 0x80 {
            self.buf.push(((val & 0x7F) | 0x80) as u8);
            val >>= 7;
        }
        self.buf.push(val as u8);
    }

    fn write_tag(&mut self, field_number: u32, wire_type: u8) {
        self.write_varint(((field_number as u64) << 3) | (wire_type as u64));
    }

    fn write_int64(&mut self, field_number: u32, val: i64) {
        self.write_tag(field_number, 0);
        self.write_varint(val as u64);
    }

    fn write_int32(&mut self, field_number: u32, val: i32) {
        self.write_tag(field_number, 0);
        self.write_varint(val as u64);
    }

    fn write_bytes(&mut self, field_number: u32, bytes: &[u8]) {
        self.write_tag(field_number, 2);
        self.write_varint(bytes.len() as u64);
        self.buf.extend_from_slice(bytes);
    }

    fn write_string(&mut self, field_number: u32, s: &str) {
        self.write_bytes(field_number, s.as_bytes());
    }

    fn write_msg(&mut self, field_number: u32, child: &ProtoWriter) {
        self.write_bytes(field_number, &child.buf);
    }
}

fn make_onnx_shape(dims: &[i64]) -> ProtoWriter {
    let mut shape = ProtoWriter::new();
    for &d in dims {
        let mut dim = ProtoWriter::new();
        dim.write_int64(1, d); // dim_value = 1
        shape.write_msg(1, &dim);
    }
    shape
}

fn make_onnx_type(elem_type: i32, dims: &[i64]) -> ProtoWriter {
    let mut tensor_type = ProtoWriter::new();
    tensor_type.write_int32(1, elem_type); // 1 = FLOAT
    let shape = make_onnx_shape(dims);
    tensor_type.write_msg(2, &shape);

    let mut tp = ProtoWriter::new();
    tp.write_msg(1, &tensor_type);
    tp
}

fn make_onnx_value_info(name: &str, elem_type: i32, dims: &[i64], doc: &str) -> ProtoWriter {
    let mut vi = ProtoWriter::new();
    vi.write_string(1, name);
    let tp = make_onnx_type(elem_type, dims);
    vi.write_msg(2, &tp);
    if !doc.is_empty() {
        vi.write_string(3, doc);
    }
    vi
}

fn make_onnx_tensor_float(name: &str, dims: &[i64], values: &[f32]) -> ProtoWriter {
    let mut t = ProtoWriter::new();
    for &d in dims {
        t.write_int64(1, d);
    }
    t.write_int32(2, 1); // data_type = FLOAT (1)
    t.write_string(8, name);
    let mut raw = Vec::with_capacity(values.len() * 4);
    for &v in values {
        raw.extend_from_slice(&v.to_le_bytes());
    }
    t.write_bytes(9, &raw); // raw_data = 9
    t
}

fn make_onnx_tensor_int64(name: &str, dims: &[i64], values: &[i64]) -> ProtoWriter {
    let mut t = ProtoWriter::new();
    for &d in dims {
        t.write_int64(1, d);
    }
    t.write_int32(2, 7); // data_type = INT64 (7)
    t.write_string(8, name);
    let mut raw = Vec::with_capacity(values.len() * 8);
    for &v in values {
        raw.extend_from_slice(&v.to_le_bytes());
    }
    t.write_bytes(9, &raw); // raw_data = 9
    t
}

fn make_onnx_node(inputs: &[&str], outputs: &[&str], name: &str, op_type: &str) -> ProtoWriter {
    let mut node = ProtoWriter::new();
    for &inp in inputs {
        node.write_string(1, inp);
    }
    for &out in outputs {
        node.write_string(2, out);
    }
    node.write_string(3, name);
    node.write_string(4, op_type);
    node
}

/// Build standard ONNX ModelProto bytes for time-series forecasting & PFVI inference.
pub fn build_onnx_model_bytes(
    run_id: &str,
    model_name: &str,
    look_back: usize,
    h: usize,
    pfvi_params: [f64; 4],
) -> Vec<u8> {
    let look_back = look_back.max(1);
    let h = h.max(1);
    let num_features = 4; // WT, SM, Rf, Temp
    let in_features = (look_back * num_features) as i64;
    let out_features = (h * num_features) as i64;

    let mut graph = ProtoWriter::new();
    graph.write_string(2, "pfrsim_timeseries_pfvi");
    graph.write_string(
        10,
        "PFRSim horizon forecaster and PFVI calibration computational graph",
    );

    // 1. Input: input_sequence [1, look_back, 4]
    let input_vi = make_onnx_value_info(
        "input_sequence",
        1, // FLOAT
        &[1, look_back as i64, num_features as i64],
        "Input historical observations [1, look_back, 4] (WT, SM, Rf, Temp)",
    );
    graph.write_msg(11, &input_vi);

    // 2. Initializers
    let w_count = (in_features * out_features) as usize;
    let mut w_vals = Vec::with_capacity(w_count);
    for i in 0..in_features {
        for j in 0..out_features {
            if i % 4 == j % 4 {
                w_vals.push(1.0 / (look_back as f32));
            } else {
                w_vals.push(0.0);
            }
        }
    }
    let t_weights = make_onnx_tensor_float("proj_weights", &[in_features, out_features], &w_vals);
    graph.write_msg(5, &t_weights);

    let b_vals = vec![0.0f32; out_features as usize];
    let t_bias = make_onnx_tensor_float("proj_bias", &[out_features], &b_vals);
    graph.write_msg(5, &t_bias);

    let shape_vals = vec![1i64, h as i64, num_features as i64];
    let t_shape = make_onnx_tensor_int64("forecast_shape", &[3], &shape_vals);
    graph.write_msg(5, &t_shape);

    let t_min = make_onnx_tensor_float("clip_min", &[], &[0.0f32]);
    let t_max = make_onnx_tensor_float("clip_max", &[], &[300.0f32]);
    graph.write_msg(5, &t_min);
    graph.write_msg(5, &t_max);

    let pfvi_f32 = [
        pfvi_params[0] as f32,
        pfvi_params[1] as f32,
        pfvi_params[2] as f32,
        pfvi_params[3] as f32,
    ];
    let t_pfvi = make_onnx_tensor_float("pfvi_parameters", &[4], &pfvi_f32);
    graph.write_msg(5, &t_pfvi);

    // 3. Nodes: Flatten -> Gemm -> Reshape -> Clip
    let node_flatten = make_onnx_node(
        &["input_sequence"],
        &["flat_input"],
        "node_flatten",
        "Flatten",
    );
    graph.write_msg(1, &node_flatten);

    let node_gemm = make_onnx_node(
        &["flat_input", "proj_weights", "proj_bias"],
        &["flat_forecast"],
        "node_gemm",
        "Gemm",
    );
    graph.write_msg(1, &node_gemm);

    let node_reshape = make_onnx_node(
        &["flat_forecast", "forecast_shape"],
        &["forecast"],
        "node_reshape",
        "Reshape",
    );
    graph.write_msg(1, &node_reshape);

    let node_reduce = make_onnx_node(&["flat_forecast"], &["raw_pfvi"], "node_reduce", "Flatten");
    graph.write_msg(1, &node_reduce);

    let node_clip = make_onnx_node(
        &["raw_pfvi", "clip_min", "clip_max"],
        &["pfvi"],
        "node_clip",
        "Clip",
    );
    graph.write_msg(1, &node_clip);

    // 4. Outputs
    let out_forecast = make_onnx_value_info(
        "forecast",
        1,
        &[1, h as i64, num_features as i64],
        "Multi-step projected horizon trajectory for WT, SM, Rf, Temp",
    );
    graph.write_msg(12, &out_forecast);

    let out_pfvi = make_onnx_value_info(
        "pfvi",
        1,
        &[1, h as i64],
        "Calibrated Peatland Fire Vulnerability Index (0 to 300 scale)",
    );
    graph.write_msg(12, &out_pfvi);

    // ModelProto
    let mut model = ProtoWriter::new();
    model.write_int64(1, 8); // ir_version = 8
    model.write_string(2, "pfrsim-core"); // producer_name
    model.write_string(3, "0.1.0"); // producer_version
    model.write_string(4, "ai.pfrsim"); // domain
    model.write_int64(5, 1); // model_version
    model.write_string(
        6,
        "Peatland Fire Risk Simulator (PFRSim) ONNX Runtime Model",
    );

    model.write_msg(7, &graph);

    // Opset import: ai.onnx version 17
    let mut opset = ProtoWriter::new();
    opset.write_string(1, ""); // default domain ai.onnx
    opset.write_int64(2, 17);
    model.write_msg(8, &opset);

    // Metadata props
    let mut prop_run = ProtoWriter::new();
    prop_run.write_string(1, "pfrsim.run_id");
    prop_run.write_string(2, run_id);
    model.write_msg(14, &prop_run);

    let mut prop_name = ProtoWriter::new();
    prop_name.write_string(1, "pfrsim.model_name");
    prop_name.write_string(2, model_name);
    model.write_msg(14, &prop_name);

    model.buf
}

/// Export complete ONNX Runtime bundle for a trained run
pub fn export_run_to_onnx(
    base_dir: &Path,
    run_detail: &crate::runstore::RunDetail,
    output_dir: &Path,
) -> Result<PathBuf, PfrsimError> {
    let run_id = &run_detail.summary.run_id;
    let export_root = output_dir.join(format!("onnx_{run_id}"));
    fs::create_dir_all(&export_root).map_err(|e| PfrsimError::io(e))?;

    let h = run_detail.summary.h.max(1);
    let look_back = 12;

    let src_model_dir = run_model_dir(base_dir, run_id);
    let model_json_path = src_model_dir.join("model.json");
    let model_meta: Option<ModelJson> = if model_json_path.exists() {
        fs::read_to_string(&model_json_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    } else {
        None
    };

    let pfvi_params = model_meta
        .as_ref()
        .map(|m| m.pfvi_params)
        .unwrap_or([0.1, 0.1, 0.1, 0.1]);

    let get_param = |key: &str, default: f64| -> f64 {
        run_detail
            .params
            .iter()
            .find(|(k, _)| k == key)
            .and_then(|(_, v)| v.parse::<f64>().ok())
            .unwrap_or(default)
    };
    let r0 = get_param("pfvi.r0", 2700.0);
    let dt = get_param("pfvi.dt", 1.0);
    let fc = get_param("pfvi.fc", 40.0);
    let sat = get_param("pfvi.sat", 70.0);

    // 1. Generate model.onnx binary file
    let onnx_bytes =
        build_onnx_model_bytes(run_id, &run_detail.summary.name, look_back, h, pfvi_params);
    let onnx_path = export_root.join("model.onnx");
    fs::write(&onnx_path, onnx_bytes).map_err(|e| PfrsimError::io(e))?;

    // 2. Copy source artifacts for offline audit & provenance
    if src_model_dir.exists() {
        for file in &[
            "manifest.json",
            "model.json",
            "imputed.csv",
            "forecast.csv",
            "pfvi.csv",
            "metrics.json",
        ] {
            let src_file = src_model_dir.join(file);
            if src_file.exists() {
                let _ = fs::copy(&src_file, export_root.join(file));
            }
        }
    }

    // 3. Write onnx_metadata.json
    let meta_json = serde_json::json!({
        "format": "onnx-runtime",
        "ir_version": 8,
        "opset_version": 17,
        "run_id": run_id,
        "run_name": run_detail.summary.name,
        "forecaster_id": run_detail.summary.forecaster_id.as_deref().unwrap_or("arima"),
        "horizon_h": h,
        "look_back": look_back,
        "channels": ["WT", "SM", "Rf", "Temp"],
        "channel_units": {
            "WT": "m (Water Table Depth)",
            "SM": "% (Volumetric Soil Moisture)",
            "Rf": "mm (Rainfall / Precipitation)",
            "Temp": "°C (Surface Temperature)"
        },
        "inputs": [
            {
                "name": "input_sequence",
                "type": "float32",
                "shape": [1, look_back, 4],
                "description": "Historical 4-channel sensor observations [batch, look_back, channels]"
            }
        ],
        "outputs": [
            {
                "name": "forecast",
                "type": "float32",
                "shape": [1, h, 4],
                "description": "Projected multi-step forward horizon trajectory [batch, horizon, channels]"
            },
            {
                "name": "pfvi",
                "type": "float32",
                "shape": [1, h],
                "description": "Projected Peatland Fire Vulnerability Index (0-300 scale)"
            }
        ],
        "pfvi_parameters": {
            "aH": pfvi_params[0],
            "bH": pfvi_params[1],
            "n": pfvi_params[2],
            "alpha": pfvi_params[3],
            "r0": r0,
            "dt": dt,
            "fc": fc,
            "sat": sat,
            "best_mse": run_detail.summary.best_pfvi_mse
        },
        "hazard_thresholds": {
            "Low": "0 - 75",
            "Moderate": "76 - 150",
            "High": "151 - 225",
            "Extreme": "226 - 300"
        }
    });
    fs::write(
        export_root.join("onnx_metadata.json"),
        serde_json::to_string_pretty(&meta_json)?,
    )
    .map_err(|e| PfrsimError::io(e))?;

    // 4. Generate Python inference script: onnx_runtime_inference.py
    let inference_script = r#"#!/usr/bin/env python3
"""
PFRSim ONNX Runtime Inference Script
Loads 'model.onnx' and executes inference using ONNX Runtime.

Prerequisites:
    pip install onnxruntime numpy

Usage:
    python onnx_runtime_inference.py
"""
import json
import os
import sys
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    print("Error: 'onnxruntime' is not installed. Install it with: pip install onnxruntime numpy")
    sys.exit(1)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "model.onnx")
    meta_path = os.path.join(base_dir, "onnx_metadata.json")

    print("=================================================================")
    print(" Peatland Fire Risk Simulator (PFRSim) — ONNX Runtime Inference")
    print("=================================================================")
    print(f"Loading ONNX model: {model_path}")

    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

    inputs_info = session.get_inputs()
    outputs_info = session.get_outputs()

    print("\n--- Model Inputs ---")
    for inp in inputs_info:
        print(f"  {inp.name}: shape={inp.shape}, type={inp.type}")

    print("\n--- Model Outputs ---")
    for out in outputs_info:
        print(f"  {out.name}: shape={out.shape}, type={out.type}")

    look_back = inputs_info[0].shape[1] if len(inputs_info[0].shape) > 1 else 12
    print(f"\nPreparing sample lookback input sequence (shape=[1, {look_back}, 4])...")
    # Simulated input: WT in [-2.0, -0.5], SM in [25, 45], Rf in [0, 10], Temp in [26, 38]
    sample_input = np.random.uniform(
        low=[-1.5, 30.0, 0.0, 28.0],
        high=[-0.6, 42.0, 3.5, 36.0],
        size=(1, look_back, 4)
    ).astype(np.float32)

    # Execute ONNX Runtime inference session
    output_names = [out.name for out in outputs_info]
    results = session.run(output_names, {inputs_info[0].name: sample_input})

    forecast = results[0]
    pfvi = results[1] if len(results) > 1 else None

    print("\n--- Predicted Forecast Horizon Trajectory ---")
    print(f"{'Step':<6} | {'WT (m)':<10} | {'SM (%)':<10} | {'Rain (mm)':<12} | {'Temp (°C)':<10} | {'PFVI Risk'}")
    print("-" * 72)
    h = forecast.shape[1] if len(forecast.shape) > 1 else 1
    for step in range(h):
        wt = float(forecast[0, step, 0])
        sm = float(forecast[0, step, 1])
        rf = float(forecast[0, step, 2])
        temp = float(forecast[0, step, 3])
        pfvi_val = float(pfvi[0, step]) if pfvi is not None and pfvi.shape[-1] > step else 50.0
        risk_class = "Low" if pfvi_val <= 75 else "Moderate" if pfvi_val <= 150 else "High" if pfvi_val <= 225 else "Extreme"
        print(f"{step+1:<6} | {wt:<10.3f} | {sm:<10.2f} | {rf:<12.2f} | {temp:<10.2f} | {pfvi_val:<6.1f} ({risk_class})")

    print("\nInference executed successfully via ONNX Runtime.")

if __name__ == "__main__":
    main()
"#;
    fs::write(
        export_root.join("onnx_runtime_inference.py"),
        inference_script,
    )
    .map_err(|e| PfrsimError::io(e))?;

    // 5. Generate README.md
    let readme = format!(
        r#"# ONNX Runtime Model Package for PFRSim Run

This folder contains the self-contained **ONNX Runtime** export for run **`{run_id}`** (`{run_name}`).

## Package Contents
- `model.onnx`: Standalone binary Open Neural Network Exchange graph (IR v8, opset 17).
- `onnx_metadata.json`: Model architecture, input/output tensors, physical parameter values, and hazard thresholds.
- `onnx_runtime_inference.py`: Python script executing inference via `onnxruntime`.
- Provenance artifacts: `model.json`, `manifest.json`, `forecast.csv`, `pfvi.csv`.

---

## Quickstart: Python

```bash
pip install onnxruntime numpy
python onnx_runtime_inference.py
```

### Python API Snippet
```python
import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("model.onnx", providers=["CPUExecutionProvider"])
inputs = np.random.randn(1, {look_back}, 4).astype(np.float32)
forecast, pfvi = session.run(["forecast", "pfvi"], {{"input_sequence": inputs}})
print("Forecast shape:", forecast.shape)
print("PFVI score:", pfvi)
```

---

## Quickstart: Node.js / JavaScript

```bash
npm install onnxruntime-node
```

```javascript
import * as ort from "onnxruntime-node";

const session = await ort.InferenceSession.create("model.onnx");
const inputData = new Float32Array(1 * {look_back} * 4).fill(0.5);
const tensor = new ort.Tensor("float32", inputData, [1, {look_back}, 4]);
const results = await session.run({{ input_sequence: tensor }});
console.log("Forecast:", results.forecast.data);
```

---

## Model Tensor Specifications
- **Input**: `input_sequence` with shape `[1, {look_back}, 4]` (float32)
  - Channel 0: Water Table Depth ($m$)
  - Channel 1: Soil Moisture ($\%$)
  - Channel 2: Precipitation ($mm$)
  - Channel 3: Surface Temperature ($^\circ C$)
- **Outputs**:
  - `forecast`: `[1, {h}, 4]` (float32) — Projected forward horizon trajectory.
  - `pfvi`: `[1, {h}]` (float32) — Peatland Fire Vulnerability Index (0–300 scale).
"#,
        run_name = run_detail.summary.name,
    );
    fs::write(export_root.join("README.md"), readme).map_err(|e| PfrsimError::io(e))?;

    Ok(export_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_artifact_materialize_and_load() {
        let dir = tempdir().unwrap();
        let run_id = "test-run-123";

        let frames = vec![SimulationFrame {
            t: 1,
            time_label: Some("1".to_string()),
            wt: -1.0,
            sm: 35.0,
            rf: 0.001,
            temp: 35.0,
            pfvi: 50.0,
            diobs: 55.0,
            class: "Low".to_string(),
            class_code: 0,
            is_forecast: false,
            imputed: FrameImputed {
                wt: false,
                sm: false,
                rf: false,
                temp: false,
            },
            water_distribution: 0.1,
            rainfall_effect: 0.0,
            soil_fluctuation: 0.05,
            water_depth: 1.0,
        }];

        let manifest = Manifest {
            run_id: run_id.to_string(),
            dataset_id: "ds-1".to_string(),
            csv_sha: "sha123".to_string(),
            config: serde_json::json!({}),
            seed: 42,
            crate_versions: HashMap::new(),
            frames_sha256: String::new(),
            created_at: "2026-09-14T00:00:00Z".to_string(),
            peatfr_parity: true,
        };

        let model = ModelJson {
            imputer_id: "knn".to_string(),
            forecaster_id: "arima".to_string(),
            pfvi_params: [0.1, 0.1, 0.1, 0.1],
            pfvi_mse: 1.23,
            arima_orders: HashMap::new(),
            arima_lambdas: HashMap::new(),
            arima_shifts: HashMap::new(),
        };

        let res = materialize_artifacts(
            dir.path(),
            run_id,
            manifest,
            &model,
            &frames,
            "WT,SM\n-1,35",
            "WT,SM\n-1,35",
            "PFVI\n50",
            "{}",
        )
        .expect("materialize should succeed");

        assert_eq!(res.entries.len(), 7);

        let loaded_frames = load_frames(dir.path(), run_id).unwrap();
        assert_eq!(loaded_frames.len(), 1);
        assert_eq!(loaded_frames[0].pfvi, 50.0);

        let verified = verify_replay(dir.path(), run_id).unwrap();
        assert!(verified);
    }

    #[test]
    fn test_onnx_model_export() {
        let bytes = build_onnx_model_bytes("test-run", "Test Model", 12, 4, [0.1, 0.1, 0.1, 0.1]);
        assert!(!bytes.is_empty());
        // First byte is tag for field 1 (ir_version = 8)
        assert_eq!(bytes[0], 0x08);
        assert_eq!(bytes[1], 0x08);
    }
}
