use tempfile::tempdir;

use pfrsim_core::artifact::{load_frames, load_manifest, verify_replay};
use pfrsim_core::forecaster::NnConfig;
use pfrsim_core::imputer::{get_imputer, ImputerConfig};
use pfrsim_core::ingest::parse_csv;
use pfrsim_core::pipeline::{execute_pipeline, PipelineConfig};
use pfrsim_core::runstore::RunStore;

#[test]
fn test_example8_parity_and_pipeline_full() {
    let csv_content = include_str!("../../../fixtures/example8.csv");
    let ds = parse_csv(csv_content, "example8.csv").expect("parse_csv on example8 must succeed");

    // 1. Dataset verification
    assert_eq!(ds.n, 8);
    assert_eq!(ds.missing.wt.count, 1);
    assert_eq!(ds.missing.sm.count, 1);
    assert_eq!(ds.missing.rf.count, 2);
    assert_eq!(ds.missing.temp.count, 1);
    assert_eq!(ds.missing.total, 5);
    assert!(ds.preview.verdict.is_valid);

    // 2. Imputers verification
    // a) kNN (default parity method)
    let knn = get_imputer("knn").unwrap();
    let knn_cfg = ImputerConfig {
        id: "knn".to_string(),
        k: 5,
        span: 0.5,
    };
    let knn_res = knn
        .impute(&ds.columns, &knn_cfg, 42)
        .expect("knn imputation must succeed");
    assert_eq!(knn_res.n_imputed, 5);
    assert!(!knn_res.imputed.wt.iter().any(|v| v.is_nan()));
    assert!(!knn_res.imputed.sm.iter().any(|v| v.is_nan()));
    assert!(!knn_res.imputed.rf.iter().any(|v| v.is_nan()));
    assert!(!knn_res.imputed.temp.iter().any(|v| v.is_nan()));

    // b) Spline
    let spline = get_imputer("spline").unwrap();
    let spline_cfg = ImputerConfig {
        id: "spline".to_string(),
        k: 5,
        span: 0.5,
    };
    let spline_res = spline
        .impute(&ds.columns, &spline_cfg, 42)
        .expect("spline must succeed");
    assert_eq!(spline_res.n_imputed, 5);

    // c) LOESS
    let loess = get_imputer("loess").unwrap();
    let loess_cfg = ImputerConfig {
        id: "loess".to_string(),
        k: 5,
        span: 0.5,
    };
    let loess_res = loess
        .impute(&ds.columns, &loess_cfg, 42)
        .expect("loess must succeed");
    assert_eq!(loess_res.n_imputed, 5);

    // 3. End-to-end Pipeline Execution with SQLite RunStore
    let dir = tempdir().expect("tempdir");
    let store = RunStore::open_in_memory().expect("in-memory runstore");
    store.save_dataset(&ds).expect("save_dataset");

    let mut config = PipelineConfig::default();
    config.imputer.id = "knn".to_string();
    config.imputer.k = 5;
    config.forecaster.id = "arima".to_string();
    config.forecaster.arima.test_split_ratio = 0.2;
    config.pfvi.r0 = 2700.0;
    config.pfvi.dt = 1.0;
    config.pfvi.h = 4;
    config.seed = 42;

    let res1 = execute_pipeline(&ds, &config, dir.path(), &store, "job-full-1", None)
        .expect("pipeline execution 1 must succeed");

    assert_eq!(res1.n_frames, 12); // 8 history + 4 forecast
    assert_eq!(res1.h_classes.len(), 4);
    for cls in &res1.h_classes {
        assert!(["Low", "Moderate", "High", "Extreme"].contains(&cls.as_str()));
    }

    // 4. Artifact inspection
    let frames = load_frames(dir.path(), &res1.run_id).expect("load_frames");
    assert_eq!(frames.len(), 12);
    // History frames (t=1..8)
    for f in &frames[..8] {
        assert!(!f.is_forecast);
        assert!(f.pfvi >= 0.0 && f.pfvi <= 300.0);
        assert!(f.diobs >= 0.0 && f.diobs <= 300.0);
    }
    // Forecast frames (t=9..12)
    for f in &frames[8..] {
        assert!(f.is_forecast);
        assert!(f.pfvi >= 0.0 && f.pfvi <= 300.0);
        assert!(f.diobs >= 0.0 && f.diobs <= 300.0);
    }

    let manifest = load_manifest(dir.path(), &res1.run_id).expect("load_manifest");
    assert_eq!(manifest.dataset_id, ds.dataset_id);
    assert_eq!(manifest.seed, 42);
    assert_eq!(manifest.frames_sha256, res1.frames_sha256);

    // 5. Replay verification
    let replay_ok = verify_replay(dir.path(), &res1.run_id).expect("verify_replay");
    assert!(
        replay_ok,
        "frames.json SHA-256 must match manifest.frames_sha256"
    );

    // 6. Determinism verification: repeat execution with identical inputs
    let res2 = execute_pipeline(&ds, &config, dir.path(), &store, "job-full-2", None)
        .expect("pipeline execution 2 must succeed");

    assert_eq!(
        res1.frames_sha256, res2.frames_sha256,
        "Identical inputs + seed must produce identical frames_sha256"
    );

    // 7. RunStore record verification
    let run_detail = store
        .get_run(&res1.run_id)
        .unwrap()
        .expect("run detail must exist");
    assert_eq!(run_detail.summary.status, "DONE");
    assert_eq!(run_detail.stages.len(), 4); // validating, impute, forecast, pfvi
    assert!(!run_detail.metrics.is_empty());

    let has_pfvi_mse = run_detail.metrics.iter().any(|m| m.1 == "pfvi.mse");
    let has_impute_count = run_detail.metrics.iter().any(|m| m.1 == "impute.n_imputed");
    let has_arima_wt_aic = run_detail.metrics.iter().any(|m| m.1 == "arima.wt.aic");
    assert!(has_pfvi_mse);
    assert!(has_impute_count);
    assert!(has_arima_wt_aic);
}
#[test]
fn test_example8_lstm_pipeline() {
    let csv_content = include_str!("../../../fixtures/example8.csv");
    let ds = parse_csv(csv_content, "example8.csv").expect("parse_csv");
    let dir = tempdir().expect("tempdir");
    let store = RunStore::open_in_memory().expect("store");
    store.save_dataset(&ds).expect("save_dataset");

    let mut config = PipelineConfig::default();
    config.imputer.id = "knn".to_string();
    config.forecaster.id = "lstm".to_string();
    config.forecaster.lstm = Some(NnConfig {
        look_back: 3,
        layer_units: vec![16],
        epochs: 10,
        batch_size: 16,
        learning_rate: 0.02,
        device: "gpu".to_string(),
    });
    config.pfvi.r0 = 2700.0;
    config.pfvi.h = 4;
    config.seed = 42;
    let res = execute_pipeline(&ds, &config, dir.path(), &store, "job-lstm", None)
        .expect("pipeline execution with LSTM must succeed");

    assert_eq!(res.n_frames, 12);
    assert_eq!(res.h_classes.len(), 4);
    assert!(res.pfvi_mse >= 0.0);
    let frames = load_frames(dir.path(), &res.run_id).expect("load_frames");
    for f in &frames[8..] {
        assert!(f.is_forecast);
        assert!(f.pfvi >= 0.0 && f.pfvi <= 300.0);
    }

    let detail = store.get_run(&res.run_id).unwrap().expect("run detail");
    assert_eq!(detail.summary.status, "DONE");
    assert_eq!(detail.summary.forecaster_id.as_deref(), Some("lstm"));
}

#[test]
fn test_example8_gru_pipeline() {
    let csv_content = include_str!("../../../fixtures/example8.csv");
    let ds = parse_csv(csv_content, "example8.csv").expect("parse_csv");
    let dir = tempdir().expect("tempdir");
    let store = RunStore::open_in_memory().expect("store");
    store.save_dataset(&ds).expect("save_dataset");
    let mut config = PipelineConfig::default();
    config.imputer.id = "knn".to_string();
    config.forecaster.id = "gru".to_string();
    config.forecaster.gru = Some(NnConfig {
        look_back: 3,
        layer_units: vec![16],
        epochs: 10,
        batch_size: 16,
        learning_rate: 0.02,
        device: "gpu".to_string(),
    });
    config.pfvi.r0 = 2700.0;
    config.pfvi.h = 4;
    config.seed = 42;

    let res = execute_pipeline(&ds, &config, dir.path(), &store, "job-gru", None)
        .expect("pipeline execution with GRU must succeed");

    assert_eq!(res.n_frames, 12);
    assert_eq!(res.h_classes.len(), 4);
    assert!(res.pfvi_mse >= 0.0);

    let frames = load_frames(dir.path(), &res.run_id).expect("load_frames");
    assert_eq!(frames.len(), 12);
    for f in &frames[8..] {
        assert!(f.is_forecast);
        assert!(f.pfvi >= 0.0 && f.pfvi <= 300.0);
    }

    let detail = store.get_run(&res.run_id).unwrap().expect("run detail");
    assert_eq!(detail.summary.status, "DONE");
    assert_eq!(detail.summary.forecaster_id.as_deref(), Some("gru"));
}
#[test]
fn test_concurrent_pipeline_execution() {
    use std::sync::Arc;
    let csv_content = include_str!("../../../fixtures/example8.csv");
    let ds = parse_csv(csv_content, "example8.csv").expect("parse_csv");
    let dir = tempdir().expect("tempdir");
    let base_path = dir.path().to_path_buf();
    let db_path = base_path.join("runs_concurrent.sqlite");
    let store = Arc::new(RunStore::open(&db_path).expect("store"));
    store.save_dataset(&ds).expect("save_dataset");

    let ds1 = ds.clone();
    let store1 = store.clone();
    let path1 = base_path.clone();
    let handle1 = std::thread::spawn(move || {
        let mut config1 = PipelineConfig::default();
        config1.imputer.id = "knn".to_string();
        config1.forecaster.id = "arima".to_string();
        config1.pfvi.h = 4;
        config1.seed = 42;
        execute_pipeline(
            &ds1,
            &config1,
            &path1,
            &store1,
            "job-concurrent-arima",
            None,
        )
        .expect("concurrent arima must succeed")
    });

    let ds2 = ds.clone();
    let store2 = store.clone();
    let path2 = base_path.clone();
    let handle2 = std::thread::spawn(move || {
        let mut config2 = PipelineConfig::default();
        config2.imputer.id = "knn".to_string();
        config2.forecaster.id = "lstm".to_string();
        config2.pfvi.h = 4;
        config2.seed = 43;
        execute_pipeline(&ds2, &config2, &path2, &store2, "job-concurrent-lstm", None)
            .expect("concurrent lstm must succeed")
    });

    let res1 = handle1.join().unwrap();
    let res2 = handle2.join().unwrap();

    assert_eq!(res1.n_frames, 12);
    assert_eq!(res2.n_frames, 12);

    let runs = store.list_runs(10, 0, None).unwrap();
    assert_eq!(
        runs.len(),
        2,
        "Both concurrent runs must be recorded in SQLite"
    );
    assert!(runs.iter().all(|r| r.status == "DONE"));
}
