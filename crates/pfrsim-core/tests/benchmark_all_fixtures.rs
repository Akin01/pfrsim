use std::path::Path;
use std::time::Instant;

use pfrsim_core::forecaster::{ArimaConfig, ForecasterConfig, NnConfig};
use pfrsim_core::imputer::ImputerConfig;
use pfrsim_core::ingest::{
    compute_decomposition_ext, inspect_dataset_file, lttb_downsample_indexed_f64,
};
use pfrsim_core::pfvi::PfviConfig;
use pfrsim_core::pipeline::{execute_pipeline, PipelineConfig};
use pfrsim_core::runstore::RunStore;

fn get_fixtures_dir() -> std::path::PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("../../fixtures")
}

#[test]
fn test_benchmark_example8_csv() {
    let fixtures_dir = get_fixtures_dir();
    let file_path = fixtures_dir.join("example8.csv");
    if !file_path.exists() {
        return;
    }

    println!("\n============================================================");
    println!(" Benchmark 1: example8.csv (8-point R Manual Baseline)");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    let t0 = Instant::now();
    let inspection = inspect_dataset_file(Some(&file_path), None, "example8.csv").expect("inspect");
    println!(
        "   1. Inspection: {:.2?} (n={})",
        t0.elapsed(),
        inspection.row_count_estimate
    );
    assert_eq!(inspection.row_count_estimate, 8);

    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&file_path),
        None,
        "example8.csv",
        Some("Example 8 Parity"),
        &inspection.suggested_mapping,
    )
    .expect("import");

    // AutoARIMA Pipeline
    let arima_cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: PfviConfig::default(),
        seed: 42,
    };
    let t_arima = Instant::now();
    let arima_res = execute_pipeline(
        &dataset,
        &arima_cfg,
        temp_dir.path(),
        &store,
        "job-ex8-arima",
        None,
    )
    .expect("arima");
    println!(
        "   2. AutoARIMA Pipeline: {:.2?} (Run ID: {})",
        t_arima.elapsed(),
        arima_res.run_id
    );
    assert!(!arima_res.run_id.is_empty());
}

#[test]
fn test_benchmark_sabangau_sample_formats() {
    let fixtures_dir = get_fixtures_dir();
    let pq_file = fixtures_dir.join("sabangau_sample.parquet");
    let xlsx_file = fixtures_dir.join("sabangau_sample.xlsx");

    println!("\n============================================================");
    println!(" Benchmark 2: sabangau_sample in Parquet and Excel");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    if pq_file.exists() {
        let t0 = Instant::now();
        let insp = inspect_dataset_file(Some(&pq_file), None, "sabangau_sample.parquet")
            .expect("inspect pq");
        let ds = pfrsim_core::ingest::import_dataset_with_mapping(
            Some(&pq_file),
            None,
            "sabangau_sample.parquet",
            Some("Sabangau Parquet"),
            &insp.suggested_mapping,
        )
        .expect("import pq");
        println!(
            "   Parquet (192 rows): Ingest {:.2?} (n={})",
            t0.elapsed(),
            ds.n
        );
        assert_eq!(ds.n, 192);

        // Run full GRU pipeline on Sabangau
        let gru_cfg = PipelineConfig {
            imputer: ImputerConfig {
                id: "knn".into(),
                k: 3,
                span: 0.5,
            },
            forecaster: ForecasterConfig {
                id: "gru".into(),
                arima: ArimaConfig::default(),
                lstm: None,
                gru: Some(NnConfig {
                    look_back: 8,
                    epochs: 15,
                    layer_units: vec![16],
                    batch_size: 32,
                    learning_rate: 0.02,
                    device: "cpu".into(),
                }),
            },
            pfvi: PfviConfig::default(),
            seed: 42,
        };
        let t_pipe = Instant::now();
        let res = execute_pipeline(
            &ds,
            &gru_cfg,
            temp_dir.path(),
            &store,
            "job-sabangau-gru",
            None,
        )
        .expect("pipeline");
        println!(
            "   Sabangau Full Pipeline (KNN + GRU): {:.2?} (Run ID: {})",
            t_pipe.elapsed(),
            res.run_id
        );
    }

    if xlsx_file.exists() {
        let t0 = Instant::now();
        let insp = inspect_dataset_file(Some(&xlsx_file), None, "sabangau_sample.xlsx")
            .expect("inspect xlsx");
        let ds = pfrsim_core::ingest::import_dataset_with_mapping(
            Some(&xlsx_file),
            None,
            "sabangau_sample.xlsx",
            Some("Sabangau Excel"),
            &insp.suggested_mapping,
        )
        .expect("import xlsx");
        println!(
            "   Excel (192 rows): Ingest {:.2?} (n={})",
            t0.elapsed(),
            ds.n
        );
        assert_eq!(ds.n, 192);
    }
}

#[test]
fn test_benchmark_seasonal_passed_sample() {
    let fixtures_dir = get_fixtures_dir();
    let file_path = fixtures_dir.join("seasonal_passed_sample.parquet");
    if !file_path.exists() {
        return;
    }

    println!("\n============================================================");
    println!(" Benchmark 3: seasonal_passed_sample.parquet (365-day Monsoon)");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    let t0 = Instant::now();
    let insp = inspect_dataset_file(Some(&file_path), None, "seasonal_passed_sample.parquet")
        .expect("inspect");
    let ds = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&file_path),
        None,
        "seasonal_passed_sample.parquet",
        Some("Seasonal Passed Sample"),
        &insp.suggested_mapping,
    )
    .expect("import");
    println!("   Ingest: {:.2?} (n={})", t0.elapsed(), ds.n);

    let t_decomp = Instant::now();
    let decomp =
        compute_decomposition_ext(&ds.columns.wt, &ds.columns.wt, None, false).expect("decomp");
    println!(
        "   STL Decomposition: {:.2?} | Period: {} | Trend: {:.3} | Seasonality (Fs): {:.3}",
        t_decomp.elapsed(),
        decomp.period,
        decomp.trend_strength,
        decomp.seasonal_strength
    );
    assert!(decomp.seasonal_strength >= 0.50);

    let cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: PfviConfig::default(),
        seed: 42,
    };
    let t_pipe = Instant::now();
    let res = execute_pipeline(
        &ds,
        &cfg,
        temp_dir.path(),
        &store,
        "job-seasonal-arima",
        None,
    )
    .expect("pipeline");
    println!(
        "   Full Pipeline (AutoARIMA): {:.2?} (Run ID: {})",
        t_pipe.elapsed(),
        res.run_id
    );
}

#[test]
fn test_benchmark_500_and_1k_stress_tests() {
    let fixtures_dir = get_fixtures_dir();
    let p500 = fixtures_dir.join("500_stress_test.parquet");
    let p1k = fixtures_dir.join("1k_stress_test.parquet");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    if p500.exists() {
        println!("\n============================================================");
        println!(" Benchmark 4A: 500_stress_test.parquet (500 Rows with NaNs)");
        println!("============================================================");

        let t0 = Instant::now();
        let insp = inspect_dataset_file(Some(&p500), None, "500_stress_test.parquet")
            .expect("inspect 500");
        let ds = pfrsim_core::ingest::import_dataset_with_mapping(
            Some(&p500),
            None,
            "500_stress_test.parquet",
            Some("500 Stress Test"),
            &insp.suggested_mapping,
        )
        .expect("import 500");
        println!("   500 Rows: Ingest {:.2?} (n={})", t0.elapsed(), ds.n);
        assert_eq!(ds.n, 500);

        let cfg = PipelineConfig {
            imputer: ImputerConfig {
                id: "knn".into(),
                k: 5,
                span: 0.5,
            },
            forecaster: ForecasterConfig {
                id: "lstm".into(),
                arima: ArimaConfig::default(),
                lstm: Some(NnConfig {
                    look_back: 12,
                    epochs: 10,
                    layer_units: vec![16],
                    batch_size: 32,
                    learning_rate: 0.02,
                    device: "cpu".into(),
                }),
                gru: None,
            },
            pfvi: PfviConfig::default(),
            seed: 42,
        };
        let t_pipe = Instant::now();
        let res = execute_pipeline(&ds, &cfg, temp_dir.path(), &store, "job-500-lstm", None)
            .expect("500 pipe");
        println!(
            "   500 Rows Full Pipeline (KNN + LSTM): {:.2?} (Run ID: {})",
            t_pipe.elapsed(),
            res.run_id
        );
    }

    if p1k.exists() {
        println!("\n============================================================");
        println!(" Benchmark 4B: 1k_stress_test.parquet (1,000 Rows with NaNs)");
        println!("============================================================");

        let t0 = Instant::now();
        let insp =
            inspect_dataset_file(Some(&p1k), None, "1k_stress_test.parquet").expect("inspect 1k");
        let ds = pfrsim_core::ingest::import_dataset_with_mapping(
            Some(&p1k),
            None,
            "1k_stress_test.parquet",
            Some("1k Stress Test"),
            &insp.suggested_mapping,
        )
        .expect("import 1k");
        println!("   1,000 Rows: Ingest {:.2?} (n={})", t0.elapsed(), ds.n);
        assert_eq!(ds.n, 1000);

        let cfg = PipelineConfig {
            imputer: ImputerConfig {
                id: "linear".into(),
                k: 5,
                span: 0.5,
            },
            forecaster: ForecasterConfig {
                id: "arima".into(),
                arima: ArimaConfig {
                    test_split_ratio: 0.2,
                    learning_rate: 0.01,
                },
                lstm: None,
                gru: None,
            },
            pfvi: PfviConfig::default(),
            seed: 42,
        };
        let t_pipe = Instant::now();
        let res = execute_pipeline(&ds, &cfg, temp_dir.path(), &store, "job-1k-arima", None)
            .expect("1k pipe");
        println!(
            "   1k Rows Full Pipeline (Linear + AutoARIMA): {:.2?} (Run ID: {})",
            t_pipe.elapsed(),
            res.run_id
        );
    }
}

#[test]
fn test_benchmark_100k_stress_test() {
    let fixtures_dir = get_fixtures_dir();
    let file_path = fixtures_dir.join("100k_stress_test.parquet");
    if !file_path.exists() {
        return;
    }

    println!("\n============================================================");
    println!(" Benchmark 5: 100k_stress_test.parquet (100,000 Rows with NaNs)");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    let t0 = Instant::now();
    let insp =
        inspect_dataset_file(Some(&file_path), None, "100k_stress_test.parquet").expect("inspect");
    println!("   1. Ingest Inspection (100k rows): {:.2?}", t0.elapsed());
    assert_eq!(insp.row_count_estimate, 100_000);
    assert!(insp.suggested_mapping.contains_key("Time"));

    let t1 = Instant::now();
    let ds = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&file_path),
        None,
        "100k_stress_test.parquet",
        Some("100k Stress Test"),
        &insp.suggested_mapping,
    )
    .expect("import");
    println!("   2. Columnar Ingest: {:.2?} (n={})", t1.elapsed(), ds.n);

    // Fast zero-allocation LTTB
    let t_down = Instant::now();
    let (dx, dy) = lttb_downsample_indexed_f64(&ds.columns.wt, 2500);
    println!(
        "   3. Zero-Allocation LTTB (100k floats -> 2500 pts): {:.2?}",
        t_down.elapsed()
    );
    assert_eq!(dx.len(), 2500);
    assert_eq!(dy.len(), 2500);

    // Full Pipeline AutoARIMA on 100k rows
    let cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: PfviConfig {
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
    let t_pipe = Instant::now();
    let res = execute_pipeline(&ds, &cfg, temp_dir.path(), &store, "job-100k-arima", None)
        .expect("pipeline");
    println!(
        "   4. Full Pipeline (AutoARIMA) on 100k Rows: {:.2?} (Run ID: {})",
        t_pipe.elapsed(),
        res.run_id
    );
}

#[test]
fn test_benchmark_1m_stress_test() {
    let fixtures_dir = get_fixtures_dir();
    let pq_path = fixtures_dir.join("1m_stress_test.parquet");
    if !pq_path.exists() {
        return;
    }

    println!("\n============================================================");
    println!(" Benchmark 6: 1m_stress_test.parquet (1,000,000 Rows with NaNs)");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    let t_insp = Instant::now();
    let inspection =
        inspect_dataset_file(Some(&pq_path), None, "1m_stress_test.parquet").expect("inspect");
    println!(
        "   1. Ingestion Inspection (1M rows): {:.2?}",
        t_insp.elapsed()
    );
    assert_eq!(inspection.row_count_estimate, 1_000_000);
    assert!(inspection.suggested_mapping.contains_key("Time"));

    let t_imp = Instant::now();
    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "1m_stress_test.parquet",
        Some("1M Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import");
    println!(
        "   2. Columnar Ingest: {:.2?} (n={})",
        t_imp.elapsed(),
        dataset.n
    );

    // Full Pipeline AutoARIMA on 1M rows
    let stats_cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: PfviConfig {
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
    let t_stat = Instant::now();
    let stat_res = execute_pipeline(
        &dataset,
        &stats_cfg,
        temp_dir.path(),
        &store,
        "job-1m-arima",
        None,
    )
    .expect("arima");
    println!(
        "   3. Full Pipeline (AutoARIMA) on 1M Rows: {:.2?} (Run ID: {})",
        t_stat.elapsed(),
        stat_res.run_id
    );

    // Full Pipeline LSTM on 1M rows (CPU/GPU)
    let dl_cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "lstm".into(),
            arima: ArimaConfig::default(),
            lstm: Some(NnConfig {
                look_back: 12,
                epochs: 10,
                layer_units: vec![16],
                batch_size: 32,
                learning_rate: 0.02,
                device: "cpu".into(),
            }),
            gru: None,
        },
        pfvi: PfviConfig {
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
    let t_dl = Instant::now();
    let dl_res = execute_pipeline(
        &dataset,
        &dl_cfg,
        temp_dir.path(),
        &store,
        "job-1m-lstm",
        None,
    )
    .expect("lstm");
    println!(
        "   4. Full Pipeline (LSTM) on 1M Rows: {:.2?} (Run ID: {})",
        t_dl.elapsed(),
        dl_res.run_id
    );
}

#[test]
fn test_benchmark_10m_stress_test() {
    let fixtures_dir = get_fixtures_dir();
    let pq_path = fixtures_dir.join("10m_stress_test.parquet");
    if !pq_path.exists() {
        return;
    }

    println!("\n============================================================");
    println!(" Benchmark 7: 10m_stress_test.parquet (10,000,000 Rows with NaNs)");
    println!("============================================================");

    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_path = temp_dir.path().join("runs.sqlite");
    let store = RunStore::open(&db_path).expect("store");

    let t_insp = Instant::now();
    let inspection =
        inspect_dataset_file(Some(&pq_path), None, "10m_stress_test.parquet").expect("inspect");
    println!(
        "   1. Ingestion Inspection (10M rows): {:.2?}",
        t_insp.elapsed()
    );
    assert_eq!(inspection.row_count_estimate, 10_000_000);

    let t_imp = Instant::now();
    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "10m_stress_test.parquet",
        Some("10M Stress Test"),
        &inspection.suggested_mapping,
    )
    .expect("import");
    println!(
        "   2. Columnar Ingest: {:.2?} (n={})",
        t_imp.elapsed(),
        dataset.n
    );

    let stats_cfg = PipelineConfig {
        imputer: ImputerConfig {
            id: "linear".into(),
            k: 5,
            span: 0.5,
        },
        forecaster: ForecasterConfig {
            id: "arima".into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: None,
            gru: None,
        },
        pfvi: PfviConfig {
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
    let t_stat = Instant::now();
    let stat_res = execute_pipeline(
        &dataset,
        &stats_cfg,
        temp_dir.path(),
        &store,
        "job-10m-arima",
        None,
    )
    .expect("arima");
    println!(
        "   3. Full Pipeline (AutoARIMA) on 10M Rows: {:.2?} (Run ID: {})",
        t_stat.elapsed(),
        stat_res.run_id
    );
}
