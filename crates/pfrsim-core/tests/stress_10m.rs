use std::time::Instant;

use pfrsim_core::forecaster::{ArimaConfig, ForecasterConfig, NnConfig};
use pfrsim_core::ingest::{
    compute_autocorrelation, compute_decomposition_ext, inspect_dataset_file, lttb_downsample,
    lttb_downsample_indexed_f64,
};
fn get_10m_pq_path() -> std::path::PathBuf {
    let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let p = manifest_dir.join("../../fixtures/10m_stress_test.parquet");
    if p.exists() {
        return p;
    }
    manifest_dir.join("../../fixtures/ten_million_stress_test.parquet")
}

#[test]
fn test_ten_million_rows_load_and_downsample() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        println!("Skipping 10M stress test: fixture not generated yet.");
        return;
    }

    println!("\n============================================================");
    println!(" Stress Test: 10,000,000 Rows Ingestion & Downsampling");
    println!(" File: {}", pq_path.display());
    println!("============================================================");

    // 1. Ingestion Inspection Test
    let start_inspect = Instant::now();
    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect_dataset_file must succeed on 10M parquet");
    let elapsed_inspect = start_inspect.elapsed();

    println!(
        "1. Ingestion Inspection: {:.2?} (throughput: {:.1} M rows/sec)",
        elapsed_inspect,
        (inspection.row_count_estimate as f64 / 1_000_000.0) / elapsed_inspect.as_secs_f64()
    );

    assert_eq!(inspection.format, "parquet");
    assert_eq!(inspection.row_count_estimate, 10_000_000);
    assert_eq!(inspection.detected_columns.len(), 5);
    assert!(inspection.suggested_mapping.contains_key("Time"));
    assert!(inspection.suggested_mapping.contains_key("WT"));
    assert!(inspection.suggested_mapping.contains_key("SM"));
    assert!(inspection.suggested_mapping.contains_key("Rf"));
    assert!(inspection.suggested_mapping.contains_key("Temp"));

    // 2. High-Frequency LTTB Downsampling Test (Stress load: 1,000,000 points downsampled to 2,500)
    let n_pts = 1_000_000;
    println!("2. Benchmarking LTTB Downsampling on {n_pts} points down to 2,500 visual points...");
    let x: Vec<f64> = (0..n_pts).map(|i| i as f64).collect();
    let y: Vec<Option<f64>> = (0..n_pts)
        .map(|i| {
            let t = i as f64;
            Some(-0.85 + 0.45 * (t / 100.0).sin())
        })
        .collect();

    let start_lttb = Instant::now();
    let (down_x, down_y) = lttb_downsample(&x, &y, 2500);
    let elapsed_lttb = start_lttb.elapsed();

    println!("   LTTB Downsampling completed in {:.2?}!", elapsed_lttb);
    assert_eq!(down_x.len(), 2500);
    assert_eq!(down_y.len(), 2500);

    println!("============================================================\n");
}

#[test]
fn test_ten_million_rows_import_and_paging() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        return;
    }

    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = pfrsim_core::runstore::RunStore::open(&db_path).expect("open store");

    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect");

    let start_import = Instant::now();
    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "ten_million_stress_test.parquet",
        Some("Ten Million Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import must succeed on 10M rows");
    let elapsed_import = start_import.elapsed();

    println!(
        "3. Ingesting & Columnar Extraction of 10,000,000 Rows: {:.2?} (throughput: {:.1} M rows/sec)",
        elapsed_import,
        (dataset.n as f64 / 1_000_000.0) / elapsed_import.as_secs_f64()
    );
    assert_eq!(dataset.n, 10_000_000);

    let start_save = Instant::now();
    store.save_dataset(&dataset).expect("save_dataset");
    let elapsed_save = start_save.elapsed();
    println!(
        "4. Persisting 10,000,000 Rows to Store: {:.2?}",
        elapsed_save
    );

    let start_preview = Instant::now();
    let preview = store
        .get_dataset_preview(&dataset.dataset_id)
        .expect("get_preview")
        .unwrap();
    let elapsed_preview = start_preview.elapsed();
    println!("5. Loading Dataset Preview: {:.2?}", elapsed_preview);
    assert_eq!(preview.head.len(), 25);

    let start_rows = Instant::now();
    let page = store
        .get_dataset_rows(&dataset.dataset_id, 1000, 50)
        .expect("get_rows")
        .unwrap();
    let elapsed_rows = start_rows.elapsed();
    println!(
        "6. Streaming 50 Windowed Rows at Offset 1000: {:.2?}",
        elapsed_rows
    );
    assert_eq!(page.rows.len(), 50);
}
#[test]
fn test_ten_million_rows_forecasting_dl_and_stats() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        return;
    }

    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect");

    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "ten_million_stress_test.parquet",
        Some("Ten Million Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import must succeed on 10M rows");

    println!("\n============================================================");
    println!(" Testing DL (LSTM) Forecasting on 10,000,000 Rows Dataset");
    println!("============================================================");

    let lstm = pfrsim_core::forecaster::get_forecaster("lstm").expect("lstm forecaster");
    let dl_epochs_seen = parking_lot::Mutex::new(Vec::new());
    let dl_cb = |var: &str, epoch: usize, total_epochs: usize| {
        println!("   [DL Forecast] var={var} epoch={epoch}/{total_epochs}");
        dl_epochs_seen.lock().push((var.to_string(), epoch));
    };

    let fc_config_dl = ForecasterConfig {
        id: "lstm".to_string(),
        arima: ArimaConfig::default(),
        lstm: Some(NnConfig {
            look_back: 12,
            epochs: 10,
            layer_units: vec![16],
            batch_size: 32,
            learning_rate: 0.02,
            device: "cpu".to_string(),
        }),
        gru: None,
    };

    let start_dl = Instant::now();
    let dl_fc_res = lstm
        .forecast(&dataset.columns, &fc_config_dl, 4, 42, Some(&dl_cb))
        .expect("LSTM forecast must succeed on 10M rows");
    let elapsed_dl = start_dl.elapsed();

    println!(
        "   LSTM Forecast on 10M rows completed in {:.2?}!",
        elapsed_dl
    );
    assert_eq!(dl_fc_res.forecast.wt.len(), 4);
    assert_eq!(dl_fc_res.forecast.sm.len(), 4);
    assert_eq!(dl_fc_res.forecast.rf.len(), 4);
    assert_eq!(dl_fc_res.forecast.temp.len(), 4);
    let seen_dl = dl_epochs_seen.lock();
    assert!(seen_dl.iter().any(|(v, ep)| v == "WT" && *ep == 0));
    assert!(seen_dl.iter().any(|(v, ep)| v == "WT" && *ep == 10));
    println!("\n============================================================");
    println!(" Testing Stats (AutoARIMA) Forecasting on 10,000,000 Rows");
    println!("============================================================");

    let arima = pfrsim_core::forecaster::get_forecaster("arima").expect("arima forecaster");
    let arima_vars_seen = parking_lot::Mutex::new(Vec::new());
    let arima_cb = |var: &str, epoch: usize, total_epochs: usize| {
        println!("   [ARIMA Forecast] var={var} step={epoch}/{total_epochs}");
        arima_vars_seen.lock().push(var.to_string());
    };
    let fc_config_arima = ForecasterConfig {
        id: "arima".to_string(),
        arima: ArimaConfig {
            test_split_ratio: 0.2,
            learning_rate: 0.01,
        },
        lstm: None,
        gru: None,
    };

    let start_arima = Instant::now();
    let arima_fc_res = arima
        .forecast(&dataset.columns, &fc_config_arima, 4, 42, Some(&arima_cb))
        .expect("ARIMA forecast must succeed on 10M rows");
    let elapsed_arima = start_arima.elapsed();

    println!(
        "   AutoARIMA Forecast on 10M rows completed in {:.2?}!",
        elapsed_arima
    );
    assert_eq!(arima_fc_res.forecast.wt.len(), 4);
    assert_eq!(arima_fc_res.forecast.sm.len(), 4);
    assert_eq!(arima_fc_res.forecast.rf.len(), 4);
    assert_eq!(arima_fc_res.forecast.temp.len(), 4);
    let seen_arima = arima_vars_seen.lock();
    assert!(seen_arima.contains(&"WT".to_string()));
    assert!(seen_arima.contains(&"SM".to_string()));
    assert!(seen_arima.contains(&"Rf".to_string()));
    assert!(seen_arima.contains(&"Temp".to_string()));
    println!("\n============================================================");
    println!(" Testing Fast Zero-Allocation Downsampling & Decomposition");
    println!("============================================================");

    let start_down = Instant::now();
    let (down_x, down_y) = lttb_downsample_indexed_f64(&dataset.columns.wt, 2500);
    let elapsed_down = start_down.elapsed();
    println!(
        "   Zero-allocation LTTB on 10M floats: {:.2?}!",
        elapsed_down
    );
    assert_eq!(down_x.len(), 2500);
    assert_eq!(down_y.len(), 2500);

    let start_decomp = Instant::now();
    let valid_sample = &dataset.columns.wt[..10_000];
    let decomp = compute_decomposition_ext(valid_sample, &dataset.columns.wt, None, false);
    let elapsed_decomp = start_decomp.elapsed();
    println!("   STL Decomposition on 10M rows: {:.2?}!", elapsed_decomp);
    assert!(decomp.is_some());

    let start_acf = Instant::now();
    let valid_slice: Vec<f64> = dataset.columns.wt[..10_000].to_vec();
    let acf = compute_autocorrelation(&valid_slice, Some(39));
    let elapsed_acf = start_acf.elapsed();
    println!("   Autocorrelation on 10M sample: {:.2?}!", elapsed_acf);
    assert!(acf.is_some());
}

#[test]
fn test_ten_million_rows_full_pipeline_dl() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        return;
    }

    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = pfrsim_core::runstore::RunStore::open(&db_path).expect("open store");

    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect");

    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "ten_million_stress_test.parquet",
        Some("Ten Million Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import must succeed on 10M rows");

    println!("\n============================================================");
    println!(" Full Pipeline Test on 10,000,000 Rows: DL (LSTM)");
    println!("============================================================");

    let dl_stages_seen = parking_lot::Mutex::new(Vec::new());
    let dl_cb = |info: &pfrsim_core::pipeline::PipelineProgressInfo| {
        let mut seen = dl_stages_seen.lock();
        if !seen.contains(&info.stage) {
            println!(
                "   [DL Progress] stage='{}' progress={:.3}",
                info.stage, info.progress
            );
            seen.push(info.stage.clone());
        }
    };

    let dl_config = pfrsim_core::pipeline::PipelineConfig {
        imputer: pfrsim_core::imputer::ImputerConfig {
            id: "linear".to_string(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "lstm".to_string(),
            arima: ArimaConfig::default(),
            lstm: Some(NnConfig {
                look_back: 12,
                epochs: 5,
                layer_units: vec![16],
                batch_size: 32,
                learning_rate: 0.02,
                device: "cpu".to_string(),
            }),
            gru: None,
        },
        pfvi: pfrsim_core::pfvi::PfviConfig {
            h: 4,
            r0: 0.05,
            dt: 1.0,
            fc: 0.35,
            sat: 0.85,
            max_grid_m: 1,
            timeout_s: 30.0,
        },
        seed: 42,
    };

    let start_dl = Instant::now();
    let dl_res = pfrsim_core::pipeline::execute_pipeline(
        &dataset,
        &dl_config,
        temp_dir.path(),
        &store,
        "job-stress-dl-10m-full",
        Some(&dl_cb),
    )
    .expect("Full DL pipeline execution must succeed on 10M rows");
    let elapsed_dl = start_dl.elapsed();

    println!(
        "   Full DL Pipeline on 10M rows completed in {:.2?}!",
        elapsed_dl
    );
    assert!(!dl_res.run_id.is_empty());

    let seen = dl_stages_seen.lock();
    assert!(seen.iter().any(|s| s.contains("validat")));
    assert!(seen.iter().any(|s| s.contains("imput")));
    assert!(seen.iter().any(|s| s.contains("forecast")));
    assert!(seen.iter().any(|s| s.contains("pfvi")));
    assert!(seen.iter().any(|s| s.contains("material")));
}

#[test]
fn test_ten_million_rows_full_pipeline_stats() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        return;
    }

    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = pfrsim_core::runstore::RunStore::open(&db_path).expect("open store");

    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect");

    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "ten_million_stress_test.parquet",
        Some("Ten Million Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import must succeed on 10M rows");

    println!("\n============================================================");
    println!(" Full Pipeline Test on 10,000,000 Rows: Stats (AutoARIMA)");
    println!("============================================================");

    let stats_stages_seen = parking_lot::Mutex::new(Vec::new());
    let stats_cb = |info: &pfrsim_core::pipeline::PipelineProgressInfo| {
        let mut seen = stats_stages_seen.lock();
        if !seen.contains(&info.stage) {
            println!(
                "   [Stats Progress] stage='{}' progress={:.3}",
                info.stage, info.progress
            );
            seen.push(info.stage.clone());
        }
    };

    let stats_config = pfrsim_core::pipeline::PipelineConfig {
        imputer: pfrsim_core::imputer::ImputerConfig {
            id: "linear".to_string(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".to_string(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: pfrsim_core::pfvi::PfviConfig {
            h: 4,
            r0: 0.05,
            dt: 1.0,
            fc: 0.35,
            sat: 0.85,
            max_grid_m: 1,
            timeout_s: 30.0,
        },
        seed: 42,
    };

    let start_stats = Instant::now();
    let stats_res = pfrsim_core::pipeline::execute_pipeline(
        &dataset,
        &stats_config,
        temp_dir.path(),
        &store,
        "job-stress-stats-10m-full",
        Some(&stats_cb),
    )
    .expect("Full Stats pipeline execution must succeed on 10M rows");
    let elapsed_stats = start_stats.elapsed();

    println!(
        "   Full Stats Pipeline on 10M rows completed in {:.2?}!",
        elapsed_stats
    );
    assert!(!stats_res.run_id.is_empty());

    let seen = stats_stages_seen.lock();
    assert!(seen.iter().any(|s| s.contains("validat")));
    assert!(seen.iter().any(|s| s.contains("imput")));
    assert!(seen.iter().any(|s| s.contains("forecast")));
    assert!(seen.iter().any(|s| s.contains("pfvi")));
    assert!(seen.iter().any(|s| s.contains("material")));
}

#[test]
fn test_ten_million_rows_full_pipeline_gru() {
    let pq_path = get_10m_pq_path();

    if !pq_path.exists() {
        return;
    }

    let temp_dir = tempfile::tempdir().expect("create temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = pfrsim_core::runstore::RunStore::open(&db_path).expect("open store");

    let inspection = inspect_dataset_file(Some(&pq_path), None, "ten_million_stress_test.parquet")
        .expect("inspect");

    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "ten_million_stress_test.parquet",
        Some("Ten Million Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import must succeed on 10M rows");

    println!("\n============================================================");
    println!(" Full Pipeline Test on 10,000,000 Rows: DL (GRU)");
    println!("============================================================");

    let gru_stages_seen = parking_lot::Mutex::new(Vec::new());
    let gru_cb = |info: &pfrsim_core::pipeline::PipelineProgressInfo| {
        let mut seen = gru_stages_seen.lock();
        if !seen.contains(&info.stage) {
            println!(
                "   [GRU Progress] stage='{}' progress={:.3}",
                info.stage, info.progress
            );
            seen.push(info.stage.clone());
        }
    };

    let gru_config = pfrsim_core::pipeline::PipelineConfig {
        imputer: pfrsim_core::imputer::ImputerConfig {
            id: "linear".to_string(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "gru".to_string(),
            arima: ArimaConfig::default(),
            lstm: None,
            gru: Some(NnConfig {
                look_back: 12,
                epochs: 5,
                layer_units: vec![16],
                batch_size: 32,
                learning_rate: 0.02,
                device: "cpu".to_string(),
            }),
        },
        pfvi: pfrsim_core::pfvi::PfviConfig {
            h: 4,
            r0: 0.05,
            dt: 1.0,
            fc: 0.35,
            sat: 0.85,
            max_grid_m: 1,
            timeout_s: 30.0,
        },
        seed: 42,
    };

    let start_gru = Instant::now();
    let gru_res = pfrsim_core::pipeline::execute_pipeline(
        &dataset,
        &gru_config,
        temp_dir.path(),
        &store,
        "job-stress-gru-10m-full",
        Some(&gru_cb),
    )
    .expect("Full GRU pipeline execution must succeed on 10M rows");
    let elapsed_gru = start_gru.elapsed();

    println!(
        "   Full GRU Pipeline on 10M rows completed in {:.2?}!",
        elapsed_gru
    );
    assert!(!gru_res.run_id.is_empty());

    let seen = gru_stages_seen.lock();
    assert!(seen.iter().any(|s| s.contains("validat")));
    assert!(seen.iter().any(|s| s.contains("imput")));
    assert!(seen.iter().any(|s| s.contains("forecast")));
    assert!(seen.iter().any(|s| s.contains("pfvi")));
    assert!(seen.iter().any(|s| s.contains("material")));
}
