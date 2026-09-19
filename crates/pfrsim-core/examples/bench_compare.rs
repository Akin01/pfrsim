use std::path::Path;
use std::time::Instant;
use tempfile::tempdir;

use pfrsim_core::forecaster::{get_forecaster, ArimaConfig, ForecasterConfig, NnConfig};
use pfrsim_core::imputer::{get_imputer, ImputerConfig};
use pfrsim_core::ingest::parse_csv;
use pfrsim_core::pfvi::{fit_pfvi, PfviConfig};
use pfrsim_core::pipeline::{execute_pipeline, PipelineConfig};
use pfrsim_core::runstore::RunStore;

fn measure_ms<F: FnMut()>(mut f: F, reps: usize) -> f64 {
    let mut times = Vec::with_capacity(reps);
    for _ in 0..reps {
        let t0 = Instant::now();
        f();
        times.push(t0.elapsed().as_secs_f64() * 1000.0);
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    times[times.len() / 2]
}

fn main() {
    println!("=== RUNNING RUST (pfrsim-core) BENCHMARK ON SABANGAU DATASET (192 ROWS) ===");

    let csv_content = include_str!("../../../fixtures/sabangau_sample.csv");
    let ds = parse_csv(csv_content, "Sabangau 192-day").expect("parse_csv");
    println!(
        "Observations: {} rows | Missing counts: WT={}, SM={}, Rf={}, Temp={}\n",
        ds.n,
        ds.columns.wt.iter().filter(|v| v.is_nan()).count(),
        ds.columns.sm.iter().filter(|v| v.is_nan()).count(),
        ds.columns.rf.iter().filter(|v| v.is_nan()).count(),
        ds.columns.temp.iter().filter(|v| v.is_nan()).count(),
    );

    // 1. Stage Microbenchmarks: Imputation
    println!("1. Running Imputation Microbenchmarks...");
    let lin_imp = get_imputer("linear").unwrap();
    let lin_cfg = ImputerConfig {
        id: "linear".to_string(),
        ..Default::default()
    };
    let linear_ms = measure_ms(
        || {
            let _ = lin_imp.impute(&ds.columns, &lin_cfg, 42).unwrap();
        },
        20,
    );
    println!("   - Linear: {:.4} ms", linear_ms);

    let spl_imp = get_imputer("spline").unwrap();
    let spl_cfg = ImputerConfig {
        id: "spline".to_string(),
        ..Default::default()
    };
    let spline_ms = measure_ms(
        || {
            let _ = spl_imp.impute(&ds.columns, &spl_cfg, 42).unwrap();
        },
        20,
    );
    println!("   - Cubic Spline: {:.4} ms", spline_ms);

    let loe_imp = get_imputer("loess").unwrap();
    let loe_cfg = ImputerConfig {
        id: "loess".to_string(),
        span: 0.5,
        ..Default::default()
    };
    let loess_ms = measure_ms(
        || {
            let _ = loe_imp.impute(&ds.columns, &loe_cfg, 42).unwrap();
        },
        20,
    );
    println!("   - LOESS (span=0.5): {:.4} ms", loess_ms);

    let knn_imp = get_imputer("knn").unwrap();
    let knn_cfg = ImputerConfig {
        id: "knn".to_string(),
        k: 5,
        ..Default::default()
    };
    let knn_ms = measure_ms(
        || {
            let _ = knn_imp.impute(&ds.columns, &knn_cfg, 42).unwrap();
        },
        20,
    );
    println!("   - k-NN (k=5): {:.4} ms", knn_ms);

    // 2. Stage Microbenchmarks: Forecasting
    println!("\n2. Running Forecaster Microbenchmarks (h=4)...");
    let imp_res = lin_imp.impute(&ds.columns, &lin_cfg, 42).unwrap();
    let arima_fc = get_forecaster("arima").unwrap();
    let arima_cfg = ForecasterConfig {
        id: "arima".to_string(),
        arima: ArimaConfig {
            test_split_ratio: 0.2,
            ..Default::default()
        },
        ..Default::default()
    };
    let arima_ms = measure_ms(
        || {
            let _ = arima_fc
                .forecast(&imp_res.imputed, &arima_cfg, 4, 42, None)
                .unwrap();
        },
        10,
    );
    println!("   - AutoARIMA: {:.2} ms", arima_ms);

    // 3. Stage Microbenchmarks: PFVI Nelder-Mead Optimization
    println!("\n3. Running Nelder-Mead PFVI Optimization Microbenchmark...");
    let pfvi_cfg = PfviConfig {
        h: 4,
        r0: 2700.0,
        dt: 1.0,
        max_grid_m: 2,
        ..Default::default()
    };
    let pfvi_ms = measure_ms(
        || {
            let _ = fit_pfvi(
                &imp_res.imputed.wt,
                &imp_res.imputed.sm,
                &imp_res.imputed.rf,
                &imp_res.imputed.temp,
                &pfvi_cfg,
            )
            .unwrap();
        },
        10,
    );
    println!("   - Nelder-Mead PFVI: {:.2} ms", pfvi_ms);

    // 4. End-to-End Pipeline Execution
    println!("\n4. Running End-to-End Pipeline Benchmarks...");
    let temp_dir = tempdir().expect("tempdir");
    let base_path = temp_dir.path().to_path_buf();
    let db_path = base_path.join("runs_bench.sqlite");
    let store = RunStore::open(&db_path).expect("runstore");
    store.save_dataset(&ds).expect("save_dataset");

    let run_e2e = |imputer_id: &str, forecaster_id: &str| -> f64 {
        let mut cfg = PipelineConfig::default();
        cfg.imputer.id = imputer_id.to_string();
        cfg.forecaster.id = forecaster_id.to_string();
        cfg.pfvi.h = 4;
        cfg.pfvi.r0 = 2700.0;
        cfg.pfvi.dt = 1.0;
        cfg.pfvi.max_grid_m = 2;
        cfg.seed = 42;
        if forecaster_id == "gru" || forecaster_id == "lstm" {
            let nn_cfg = NnConfig {
                epochs: 100,
                batch_size: 32,
                learning_rate: 0.02,
                look_back: 12,
                ..Default::default()
            };
            if forecaster_id == "gru" {
                cfg.forecaster.gru = Some(nn_cfg);
            } else {
                cfg.forecaster.lstm = Some(nn_cfg);
            }
        }
        let reps = if forecaster_id == "arima" { 5 } else { 2 };
        let job_name = format!("bench-{}-{}", imputer_id, forecaster_id);
        measure_ms(
            || {
                let _ = execute_pipeline(&ds, &cfg, &base_path, &store, &job_name, None).unwrap();
            },
            reps,
        )
    };

    println!("   - e2e: linear + arima...");
    let e2e_linear_arima_ms = run_e2e("linear", "arima");
    println!("     -> {:.2} ms", e2e_linear_arima_ms);

    println!("   - e2e: spline + arima...");
    let e2e_spline_arima_ms = run_e2e("spline", "arima");
    println!("     -> {:.2} ms", e2e_spline_arima_ms);

    println!("   - e2e: loess + arima...");
    let e2e_loess_arima_ms = run_e2e("loess", "arima");
    println!("     -> {:.2} ms", e2e_loess_arima_ms);

    println!("   - e2e: knn + arima...");
    let e2e_knn_arima_ms = run_e2e("knn", "arima");
    println!("     -> {:.2} ms", e2e_knn_arima_ms);

    println!("   - e2e: linear + gru...");
    let e2e_linear_gru_ms = run_e2e("linear", "gru");
    println!("     -> {:.2} ms", e2e_linear_gru_ms);

    println!("   - e2e: knn + gru...");
    let e2e_knn_gru_ms = run_e2e("knn", "gru");
    println!("     -> {:.2} ms", e2e_knn_gru_ms);

    println!("   - e2e: linear + lstm...");
    let e2e_linear_lstm_ms = run_e2e("linear", "lstm");
    println!("     -> {:.2} ms", e2e_linear_lstm_ms);

    println!("   - e2e: knn + lstm...");
    let e2e_knn_lstm_ms = run_e2e("knn", "lstm");
    println!("     -> {:.2} ms", e2e_knn_lstm_ms);

    let output_json = format!(
        r#"{{
  "dataset": "sabangau_sample.csv (192 rows)",
  "stages": {{
    "linear_impute_ms": {:.4},
    "spline_impute_ms": {:.4},
    "loess_impute_ms": {:.4},
    "knn_impute_ms": {:.4},
    "arima_forecast_ms": {:.2},
    "pfvi_calibration_ms": {:.2}
  }},
  "e2e": {{
    "linear_arima_ms": {:.2},
    "spline_arima_ms": {:.2},
    "loess_arima_ms": {:.2},
    "knn_arima_ms": {:.2},
    "linear_gru_ms": {:.2},
    "knn_gru_ms": {:.2},
    "linear_lstm_ms": {:.2},
    "knn_lstm_ms": {:.2}
  }}
}}"#,
        linear_ms,
        spline_ms,
        loess_ms,
        knn_ms,
        arima_ms,
        pfvi_ms,
        e2e_linear_arima_ms,
        e2e_spline_arima_ms,
        e2e_loess_arima_ms,
        e2e_knn_arima_ms,
        e2e_linear_gru_ms,
        e2e_knn_gru_ms,
        e2e_linear_lstm_ms,
        e2e_knn_lstm_ms
    );

    let out_path = Path::new("benchmark/rust_benchmark.json");
    std::fs::write(out_path, output_json).expect("write json");
    println!("\nResults written to benchmark/rust_benchmark.json");
}
