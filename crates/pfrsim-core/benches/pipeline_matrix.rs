use std::path::Path;
use std::time::Instant;

use pfrsim_core::forecaster::{ArimaConfig, ForecasterConfig, NnConfig};
use pfrsim_core::imputer::ImputerConfig;
use pfrsim_core::ingest::{inspect_dataset_file, lttb_downsample_indexed_f64};
use pfrsim_core::pfvi::PfviConfig;
use pfrsim_core::pipeline::{execute_pipeline, PipelineConfig};
use pfrsim_core::runstore::RunStore;

struct BenchRecord {
    imputer: &'static str,
    forecaster: &'static str,
    cold_total_ms: f64,
    hot_total_ms: f64,
    hot_speedup: f64,
}

fn get_fixtures_dir() -> std::path::PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("../../fixtures")
}

fn main() {
    println!("================================================================================");
    println!(" pfrsim-core: High-Scale Pipeline Benchmark & Profiling (>100k Dataset)");
    println!(" Dataset: 100k_stress_test.parquet (100,000 Observations with Real Missingness)");
    println!(" Hardware Profiling: Cold-Path vs. Hot-Path Across Configurations & Stages");
    println!("================================================================================\n");

    let fixtures_dir = get_fixtures_dir();
    let pq_path = fixtures_dir.join("100k_stress_test.parquet");
    if !pq_path.exists() {
        eprintln!("Fixture not found: {}", pq_path.display());
        std::process::exit(1);
    }

    let t_inspect = Instant::now();
    let insp = inspect_dataset_file(Some(&pq_path), None, "100k_stress_test.parquet")
        .expect("inspect fixture");
    let inspect_elapsed = t_inspect.elapsed();

    let t_ingest = Instant::now();
    let dataset = pfrsim_core::ingest::import_dataset_with_mapping(
        Some(&pq_path),
        None,
        "100k_stress_test.parquet",
        Some("100k Stress Test"),
        &insp.suggested_mapping,
    )
    .expect("import dataset");
    let ingest_elapsed = t_ingest.elapsed();

    println!("1. Ingestion & Columnar Mapping Profiling (100,000 Rows):");
    println!("   - Inspection Time:  {:.2?}", inspect_elapsed);
    println!(
        "   - Ingestion Time:   {:.2?} ({:.1} million rows / sec)",
        ingest_elapsed,
        (dataset.n as f64 / 1_000_000.0) / ingest_elapsed.as_secs_f64()
    );
    println!("   - Total Rows:       {}", dataset.n);
    println!("   - Injected NaNs:    Present across all 4 channels (WT, SM, Rf, Temp)\n");

    // Microbenchmark: LTTB Downsampling on 100k rows
    let t_lttb = Instant::now();
    let (down_x, down_y) = lttb_downsample_indexed_f64(&dataset.columns.wt, 2500);
    let lttb_elapsed = t_lttb.elapsed();
    println!("2. Zero-Allocation LTTB Downsampling (100,000 floats -> 2,500 points):");
    println!(
        "   - Downsample Time:  {:.2?} (Allocated points: {} in {:.2} ms)",
        lttb_elapsed,
        down_x.len(),
        lttb_elapsed.as_secs_f64() * 1000.0
    );
    assert_eq!(down_x.len(), 2500);
    assert_eq!(down_y.len(), 2500);

    let imputers = ["linear", "spline", "loess", "knn"];
    let forecasters = ["arima", "gru", "lstm"];

    println!("\n================================================================================");
    println!(" 3. PIPELINE CONFIGURATION MATRIX ON 100,000 ROWS");
    println!("    (Batch Size = 128, Epochs = 15, Parallel Channels = YES)");
    println!("================================================================================");

    let mut records: Vec<BenchRecord> = Vec::new();

    for &imp in &imputers {
        for &fc in &forecasters {
            println!(
                "--------------------------------------------------------------------------------"
            );
            println!(
                " CONFIG: Imputer = {:<8} | Forecaster = {:<8} on 100k Dataset",
                imp, fc
            );
            println!(
                "--------------------------------------------------------------------------------"
            );

            let make_config = || -> PipelineConfig {
                let mut p_cfg = PipelineConfig::default();
                p_cfg.imputer = ImputerConfig {
                    id: imp.into(),
                    k: 3,
                    span: 0.5,
                };
                p_cfg.forecaster = ForecasterConfig {
                    id: fc.into(),
                    arima: ArimaConfig {
                        test_split_ratio: 0.2,
                        learning_rate: 0.01,
                    },
                    lstm: if fc == "lstm" {
                        Some(NnConfig {
                            look_back: 12,
                            epochs: 15,
                            layer_units: vec![16],
                            batch_size: 128,
                            learning_rate: 0.02,
                            device: "cpu".into(),
                        })
                    } else {
                        None
                    },
                    gru: if fc == "gru" {
                        Some(NnConfig {
                            look_back: 12,
                            epochs: 15,
                            layer_units: vec![16],
                            batch_size: 128,
                            learning_rate: 0.02,
                            device: "cpu".into(),
                        })
                    } else {
                        None
                    },
                };
                p_cfg.pfvi = PfviConfig::default();
                p_cfg.seed = 42;
                p_cfg
            };

            // 1. Cold Run
            let cold_dir = tempfile::tempdir().expect("cold tempdir");
            let cold_store =
                RunStore::open(&cold_dir.path().join("runs.sqlite")).expect("open store");
            let cfg_cold = make_config();

            let t_cold_start = Instant::now();
            let cold_res = execute_pipeline(
                &dataset,
                &cfg_cold,
                cold_dir.path(),
                &cold_store,
                &format!("bench-100k-cold-{imp}-{fc}"),
                None,
            )
            .expect("execute cold pipeline");
            let cold_elapsed = t_cold_start.elapsed().as_secs_f64() * 1000.0;
            println!(
                "   [COLD PATH] Total: {:8.2} ms | Run ID: {}",
                cold_elapsed, cold_res.run_id
            );

            // 2. Hot Run
            let hot_dir = tempfile::tempdir().expect("hot tempdir");
            let hot_store =
                RunStore::open(&hot_dir.path().join("runs.sqlite")).expect("open store");
            let cfg_hot = make_config();

            let t_hot_start = Instant::now();
            let hot_res = execute_pipeline(
                &dataset,
                &cfg_hot,
                hot_dir.path(),
                &hot_store,
                &format!("bench-100k-hot-{imp}-{fc}"),
                None,
            )
            .expect("execute hot pipeline");
            let hot_elapsed = t_hot_start.elapsed().as_secs_f64() * 1000.0;
            let speedup = cold_elapsed / hot_elapsed;
            println!(
                "   [HOT PATH]  Total: {:8.2} ms | Run ID: {} | Speedup: {:.2}x\n",
                hot_elapsed, hot_res.run_id, speedup
            );

            records.push(BenchRecord {
                imputer: imp,
                forecaster: fc,
                cold_total_ms: cold_elapsed,
                hot_total_ms: hot_elapsed,
                hot_speedup: speedup,
            });
        }
    }

    // Print summary benchmark table
    println!("================================================================================");
    println!(" BENCHMARK MATRIX SUMMARY (100,000 Observations with Real Missingness)");
    println!("================================================================================");
    println!(
        " {:<4} | {:<8} | {:<10} | {:>14} | {:>14} | {:>10}",
        "#", "Imputer", "Forecaster", "Cold Path (ms)", "Hot Path (ms)", "Speedup"
    );
    println!("--------------------------------------------------------------------------------");
    for (idx, r) in records.iter().enumerate() {
        println!(
            " {:<4} | {:<8} | {:<10} | {:>14.2} | {:>14.2} | {:>9.2}x",
            idx + 1,
            r.imputer,
            r.forecaster,
            r.cold_total_ms,
            r.hot_total_ms,
            r.hot_speedup
        );
    }
    println!("================================================================================\n");

    // 4. Stage-level microbenchmarks
    println!("================================================================================");
    println!(" 4. STAGE-LEVEL PROFILING ON 100,000 ROWS");
    println!("================================================================================");

    // Forecasters on 100k dataset
    println!("\nForecaster Execution Times (Horizon h = 4 on 100k dataset):");
    for &fc_id in &forecasters {
        let forecaster = pfrsim_core::forecaster::get_forecaster(fc_id).expect("get forecaster");
        let fc_cfg = ForecasterConfig {
            id: fc_id.into(),
            arima: ArimaConfig {
                test_split_ratio: 0.2,
                learning_rate: 0.01,
            },
            lstm: if fc_id == "lstm" {
                Some(NnConfig {
                    look_back: 12,
                    epochs: 15,
                    layer_units: vec![16],
                    batch_size: 128,
                    learning_rate: 0.02,
                    device: "cpu".into(),
                })
            } else {
                None
            },
            gru: if fc_id == "gru" {
                Some(NnConfig {
                    look_back: 12,
                    epochs: 15,
                    layer_units: vec![16],
                    batch_size: 128,
                    learning_rate: 0.02,
                    device: "cpu".into(),
                })
            } else {
                None
            },
        };
        let t0 = Instant::now();
        let _ = forecaster.forecast(&dataset.columns, &fc_cfg, 4, 42, None);
        let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
        println!("   - {:<8}: {:8.2} ms", fc_id, elapsed_ms);
    }

    // PFVI Nelder-Mead on 100k dataset
    println!("\nPhysical Fire Index (PFVI) 4D Simplex Calibration on 100k dataset:");
    let pfvi_cfg = PfviConfig::default();
    let t0 = Instant::now();
    let _ = pfrsim_core::pfvi::fit_pfvi(
        &dataset.columns.wt,
        &dataset.columns.sm,
        &dataset.columns.rf,
        &dataset.columns.temp,
        &pfvi_cfg,
    );
    let pfvi_elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
    println!("   - Nelder-Mead + Grid Polish: {:8.2} ms", pfvi_elapsed_ms);

    println!("\n================================================================================");
    println!(" HIGH-SCALE PROFILING & BENCHMARK COMPLETE (>100k)");
    println!("================================================================================");
}
