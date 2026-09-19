use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::time::Instant;

use polars::prelude::*;

/// Fast Gregorian date algorithm (Civil date from Euclidean affine)
#[inline(always)]
fn format_iso_timestamp(epoch_secs: i64) -> String {
    let secs_in_day = 86400;
    let mut days = (epoch_secs / secs_in_day) as i32;
    let mut day_secs = (epoch_secs % secs_in_day) as i32;
    if day_secs < 0 {
        day_secs += secs_in_day as i32;
        days -= 1;
    }
    let hour = day_secs / 3600;
    let minute = (day_secs % 3600) / 60;
    let second = day_secs % 60;

    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1020 + doe / 1461 - doe / 146096) / 365;
    let y = (yoe as i32) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        y, m, d, hour, minute, second
    )
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let n_rows: usize = args
        .get(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(10_000_000);
    let default_prefix = if n_rows >= 10_000_000 {
        "10m_stress_test"
    } else if n_rows >= 1_000_000 {
        "1m_stress_test"
    } else if n_rows >= 100_000 {
        "100k_stress_test"
    } else if n_rows >= 1_000 {
        "1k_stress_test"
    } else {
        "500_stress_test"
    };

    let file_prefix = args
        .get(2)
        .filter(|s| !s.starts_with("--"))
        .map(|s| s.as_str())
        .unwrap_or(default_prefix);

    let write_csv = args.iter().any(|a| a == "--csv" || a == "--all");
    println!("=================================================================");
    println!(" Peatland Fire Risk Simulator — Large Scale Data Fixture Generator");
    println!(
        " Target Rows: {n_rows} ({:.1} million rows)",
        n_rows as f64 / 1_000_000.0
    );
    println!(" Features: ISO Datetime Index, Non-Monotonic Multi-Regime Trends, Missing NaNs");
    println!("=================================================================");

    let fixtures_dir = Path::new("fixtures");
    if !fixtures_dir.exists() {
        std::fs::create_dir_all(fixtures_dir)?;
    }

    let gen_start = Instant::now();
    println!("1. Synthesizing realistic tropical peatland timeseries with ISO datetimes & NaNs...");

    let mut timestamps: Vec<String> = Vec::with_capacity(n_rows);
    let mut wt: Vec<f64> = Vec::with_capacity(n_rows);
    let mut sm: Vec<f64> = Vec::with_capacity(n_rows);
    let mut rf: Vec<f64> = Vec::with_capacity(n_rows);
    let mut temp: Vec<f64> = Vec::with_capacity(n_rows);

    let mut state_wt = -0.75f64;
    let mut state_temp = 31.0f64;

    // Fast deterministic LCG pseudo-random generator
    let mut lcg_seed: u64 = 42;
    let mut next_rand = || -> f64 {
        lcg_seed = lcg_seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((lcg_seed >> 11) as f64) / ((1u64 << 53) as f64)
    };

    let start_epoch_sec: i64 = 1577836800; // 2020-01-01 00:00:00 UTC
    let report_step = n_rows / 10;
    let pi = std::f64::consts::PI;

    let mut total_nan_wt = 0;
    let mut total_nan_sm = 0;
    let mut total_nan_rf = 0;
    let mut total_nan_temp = 0;

    for i in 0..n_rows {
        // Continuous 1-minute time index
        let cur_epoch = start_epoch_sec + (i as i64) * 60;
        timestamps.push(format_iso_timestamp(cur_epoch));

        let t = i as f64;
        let day = t / 1440.0;

        // 1. Multi-scale environmental cycles (Non-monotonic hydrodynamics)
        // A. 3.5-year ENSO interannual drought / La Niña flood oscillation
        let enso_cycle = (2.0 * pi * day / (365.25 * 3.5)).sin();

        // B. Annual tropical monsoon wet/dry cycle (365 days)
        let monsoon_cycle = (2.0 * pi * day / 365.25).sin();

        // C. Intraseasonal Madden-Julian Oscillation (45 days)
        let mjo_cycle = (2.0 * pi * day / 45.0).sin();

        // D. 24-hour diurnal thermal cycle (day / night)
        let diurnal_cycle = (2.0 * pi * (t % 1440.0) / 1440.0).sin();

        // Combined target water table (Base -0.95m, ranges from -0.15m down to -1.95m)
        let target_wt = -0.95 + 0.40 * monsoon_cycle + 0.28 * enso_cycle + 0.08 * mjo_cycle;
        let noise_wt = (next_rand() - 0.5) * 0.015;
        state_wt = 0.985 * state_wt + 0.015 * target_wt + noise_wt;
        let mut wt_val = state_wt.clamp(-1.95, -0.10);

        // 2. Rainfall pulse events: zero-inflated with heavy storm tail
        let rain_prob = (0.08 + 0.06 * monsoon_cycle).clamp(0.02, 0.22);
        let mut rf_val = if next_rand() < rain_prob {
            let u = next_rand();
            let storm = (-8.0 * (1.0 - u).ln()).clamp(0.1, 75.0);
            // Infiltrating rainfall rapidly recharges the water table
            state_wt = (state_wt + storm * 0.0035).min(-0.10);
            storm
        } else {
            0.0
        };

        // 3. Soil Moisture (%): Non-linearly coupled with Water Table via retention curve
        let sm_base = 54.0 + 19.0 * (wt_val + 0.95) + (rf_val * 0.45);
        let sm_noise = (next_rand() - 0.5) * 1.2;
        let mut sm_val = (sm_base + sm_noise).clamp(21.0, 78.0);

        // 4. Temperature (°C): Diurnal day/night swings + dry-season heatwaves
        let target_temp = 29.5 + 4.5 * diurnal_cycle - 2.2 * monsoon_cycle + 1.2 * enso_cycle;
        let temp_noise = (next_rand() - 0.5) * 0.8;
        state_temp = 0.92 * state_temp + 0.08 * target_temp + temp_noise * 0.1;
        let mut temp_val = state_temp.clamp(21.5, 38.5);

        // 5. Realistic Sensor Missing Values (NaNs)
        // Preserve first and last 4 rows to prevent edge NaNs on boundary
        if i >= 4 && i < n_rows - 4 {
            // Periodic sensor power / telemetry outages (~120 minutes every ~45,000 steps)
            let in_outage = (i / 45_000) % 7 == 3 && (i % 45_000) < 120;

            // Individual channel dropouts
            if in_outage || next_rand() < 0.012 {
                wt_val = f64::NAN;
                total_nan_wt += 1;
            }
            if in_outage || next_rand() < 0.010 {
                sm_val = f64::NAN;
                total_nan_sm += 1;
            }
            if next_rand() < 0.006 {
                rf_val = f64::NAN;
                total_nan_rf += 1;
            }
            if next_rand() < 0.005 {
                temp_val = f64::NAN;
                total_nan_temp += 1;
            }
        }

        wt.push(wt_val);
        sm.push(sm_val);
        rf.push(rf_val);
        temp.push(temp_val);

        if (i + 1) % report_step == 0 {
            let pct = ((i + 1) as f64 / n_rows as f64) * 100.0;
            println!("   Generated {:>9} / {n_rows} rows ({pct:.0}%)...", i + 1);
        }
    }

    let gen_elapsed = gen_start.elapsed();
    println!(
        "   Done in {:.2?} ({:.1} million rows/sec)\n",
        gen_elapsed,
        (n_rows as f64 / 1_000_000.0) / gen_elapsed.as_secs_f64()
    );
    println!(
        "   Injected Missing Values (NaNs): WT={total_nan_wt}, SM={total_nan_sm}, Rf={total_nan_rf}, Temp={total_nan_temp}"
    );

    // 2. Write to Apache Parquet
    let pq_path = fixtures_dir.join(format!("{file_prefix}.parquet"));
    println!("2. Serializing to Apache Parquet: {}...", pq_path.display());
    let pq_start = Instant::now();
    let mut df = DataFrame::new(
        n_rows,
        vec![
            Series::new("Timestamp".into(), &timestamps).into(),
            Series::new("Water Table".into(), &wt).into(),
            Series::new("Soil Moisture".into(), &sm).into(),
            Series::new("Rainfall".into(), &rf).into(),
            Series::new("Temperature".into(), &temp).into(),
        ],
    )?;

    let mut pq_file = File::create(&pq_path)?;
    ParquetWriter::new(&mut pq_file)
        .with_compression(ParquetCompression::Snappy)
        .finish(&mut df)?;

    let pq_elapsed = pq_start.elapsed();
    let pq_size_mb = std::fs::metadata(&pq_path)?.len() as f64 / (1024.0 * 1024.0);
    println!(
        "   Parquet written in {:.2?} | Size on disk: {:.2} MB\n",
        pq_elapsed, pq_size_mb
    );

    // 3. Optionally write to CSV
    if write_csv {
        let csv_path = fixtures_dir.join(format!("{file_prefix}.csv"));
        println!("3. Streaming to CSV format: {}...", csv_path.display());
        let csv_start = Instant::now();
        let file = File::create(&csv_path)?;
        let mut wtr = BufWriter::with_capacity(1024 * 1024, file);
        writeln!(
            wtr,
            "Timestamp,Water Table,Soil Moisture,Rainfall,Temperature"
        )?;

        for i in 0..n_rows {
            let wt_str = if wt[i].is_nan() {
                String::new()
            } else {
                format!("{:.4}", wt[i])
            };
            let sm_str = if sm[i].is_nan() {
                String::new()
            } else {
                format!("{:.2}", sm[i])
            };
            let rf_str = if rf[i].is_nan() {
                String::new()
            } else {
                format!("{:.4}", rf[i])
            };
            let temp_str = if temp[i].is_nan() {
                String::new()
            } else {
                format!("{:.2}", temp[i])
            };
            writeln!(
                wtr,
                "{},{},{},{},{}",
                timestamps[i], wt_str, sm_str, rf_str, temp_str
            )?;
        }
        wtr.flush()?;

        let csv_elapsed = csv_start.elapsed();
        let csv_size_mb = std::fs::metadata(&csv_path)?.len() as f64 / (1024.0 * 1024.0);
        println!(
            "   CSV written in {:.2?} | Size on disk: {:.2} MB\n",
            csv_elapsed, csv_size_mb
        );
    }

    // 4. Test Ingestion Verification
    println!("4. Verifying ingestion inspection via pfrsim-core::ingest::inspect_dataset_file...");
    let inspect_start = Instant::now();
    let file_name = format!("{file_prefix}.parquet");
    let inspection = pfrsim_core::ingest::inspect_dataset_file(Some(&pq_path), None, &file_name)?;
    let inspect_elapsed = inspect_start.elapsed();

    println!("   Inspection Completed in {:.2?}!", inspect_elapsed);
    println!("   - Detected Format: {}", inspection.format);
    println!("   - Row Count Estimate: {}", inspection.row_count_estimate);
    println!("   - Detected Columns: {:?}", inspection.detected_columns);
    println!("   - Suggested Mapping: {:?}", inspection.suggested_mapping);
    println!("   - Sample Preview Rows: {}", inspection.sample_rows.len());

    println!("\n============================================================");
    println!(" REAL-WORLD STRESS FIXTURE GENERATION COMPLETE");
    println!(" Path: {}", pq_path.display());
    println!(" Total Rows: {}", inspection.row_count_estimate);
    println!(" Parquet Size: {:.2} MB", pq_size_mb);
    println!("============================================================");

    Ok(())
}
