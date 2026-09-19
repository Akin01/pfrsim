use calamine::{open_workbook_auto_from_rs, Reader};
use polars::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::Path;

use crate::error::PfrsimError;
pub const MAX_CSV_BYTES: usize = 1024 * 1024 * 1024; // 1 GB
pub const MAX_CSV_ROWS: usize = 50_000_000;
pub const MIN_CSV_ROWS: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimeKind {
    Index,
    Date,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesStats {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    #[serde(default)]
    pub std: Option<f64>,
    #[serde(default)]
    pub acf1: Option<f64>,
    #[serde(default)]
    pub trend: Option<TrendInfo>,
    #[serde(default)]
    pub seasonality: Option<SeasonalityInfo>,
    #[serde(default)]
    pub stationarity: Option<StationarityInfo>,
    #[serde(default)]
    pub decomposition: Option<StlDecomposition>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrendDirection {
    Rising,
    Falling,
    Flat,
}

/// OLS trend of the series against its time index. `slope` is in raw
/// series units per step; `direction` applies a |t| > 2 significance test.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendInfo {
    pub direction: TrendDirection,
    pub slope: f64,
}

/// Dominant-cycle detection over autocorrelation lags 2..=48.
/// `strength` is max |r_k|; `seasonal` requires strength >= 0.35 plus at
/// least two full cycles visible in the record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonalityInfo {
    pub seasonal: bool,
    pub period: Option<usize>,
    pub strength: f64,
}

/// Split-half stability heuristic: flat OLS trend, stable half-means and
/// comparable half-variances. `mean_shift` is |m1-m2| in pooled-std units,
/// `var_ratio` is max/min half-variance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationarityInfo {
    pub stationary: bool,
    pub mean_shift: f64,
    pub var_ratio: f64,
}

/// Classical STL-style decomposition on the detected seasonal period.
/// `trend`/`remainder` are `None` at the edges where the centered window
/// is undefined; `seasonal` tiles the centered per-position profile.
/// `Option<f64>` serializes `None` as `null`, reloadable by uPlot gaps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StlDecomposition {
    pub period: usize,
    pub trend: Vec<Option<f64>>,
    pub seasonal: Vec<f64>,
    pub remainder: Vec<Option<f64>>,
    #[serde(default)]
    pub trend_strength: f64,
    #[serde(default)]
    pub seasonal_strength: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutocorrelationView {
    pub max_lag: usize,
    pub confidence_band: f64,
    pub acf: Vec<f64>,
    pub pacf: Vec<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnStats {
    pub wt: Option<SeriesStats>,
    pub sm: Option<SeriesStats>,
    pub rf: Option<SeriesStats>,
    pub temp: Option<SeriesStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingSeries {
    pub count: usize,
    pub indices: Vec<usize>, // 0-based indices
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingInfo {
    pub total: usize,
    pub wt: MissingSeries,
    pub sm: MissingSeries,
    pub rf: MissingSeries,
    pub temp: MissingSeries,
}

pub mod vec_f64_with_nan {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(vec: &[f64], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeSeq;
        let mut seq = serializer.serialize_seq(Some(vec.len()))?;
        for &v in vec {
            if v.is_nan() {
                seq.serialize_element(&None::<f64>)?;
            } else {
                seq.serialize_element(&Some(v))?;
            }
        }
        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<f64>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt_vec: Vec<Option<f64>> = Vec::deserialize(deserializer)?;
        Ok(opt_vec
            .into_iter()
            .map(|opt| opt.unwrap_or(f64::NAN))
            .collect())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnData {
    #[serde(with = "vec_f64_with_nan")]
    pub wt: Vec<f64>,
    #[serde(with = "vec_f64_with_nan")]
    pub sm: Vec<f64>,
    #[serde(with = "vec_f64_with_nan")]
    pub rf: Vec<f64>,
    #[serde(with = "vec_f64_with_nan")]
    pub temp: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowPreview {
    pub t: usize, // 1-based index
    pub time_label: Option<String>,
    pub wt: Option<f64>,
    pub sm: Option<f64>,
    pub rf: Option<f64>,
    pub temp: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationVerdict {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetPreview {
    pub stats: ColumnStats,
    pub missing: MissingInfo,
    pub head: Vec<RowPreview>,
    pub tail: Vec<RowPreview>,
    pub verdict: ValidationVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dataset {
    pub dataset_id: String,
    pub name: String,
    pub csv_sha: String,
    pub n: usize,
    pub time_kind: TimeKind,
    pub time_labels: Option<Vec<String>>,
    pub columns: ColumnData,
    pub missing: MissingInfo,
    pub stats: ColumnStats,
    pub preview: DatasetPreview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetInspection {
    pub file_name: String,
    pub format: String, // "csv" | "excel" | "parquet"
    pub detected_columns: Vec<String>,
    pub row_count_estimate: usize,
    pub sample_rows: Vec<HashMap<String, Option<String>>>,
    pub suggested_mapping: HashMap<String, String>, // system var -> source column
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMapping {
    pub wt: String,
    pub sm: String,
    pub rf: String,
    pub temp: String,
    pub time: Option<String>,
}
pub fn detect_format(file_name: &str) -> &'static str {
    let lower = file_name.to_lowercase();
    if lower.ends_with(".parquet") || lower.ends_with(".pq") {
        "parquet"
    } else if lower.ends_with(".xlsx")
        || lower.ends_with(".xls")
        || lower.ends_with(".ods")
        || lower.ends_with(".xlsb")
    {
        "excel"
    } else {
        "csv"
    }
}

pub fn suggest_mapping(columns: &[String]) -> HashMap<String, String> {
    let mut mapping = HashMap::new();

    let normalize = |s: &str| -> String {
        s.to_lowercase()
            .replace([' ', '_', '-', '.', '(', ')', '[', ']', '/', '\\'], "")
    };

    let wt_patterns = [
        "wt",
        "watertable",
        "waterlevel",
        "tma",
        "mukaair",
        "gwl",
        "kedalamanair",
        "waterdepth",
        "levelair",
    ];
    let sm_patterns = [
        "sm",
        "soilmoisture",
        "kelembaban",
        "kelembabantanah",
        "kadarair",
        "moisture",
        "vsm",
        "swc",
    ];
    let rf_patterns = [
        "rf",
        "rainfall",
        "rain",
        "curahhujan",
        "hujan",
        "precip",
        "precipitation",
        "prcp",
        "ch",
    ];
    let temp_patterns = [
        "temp",
        "temperature",
        "suhu",
        "suhuudara",
        "ambienttemp",
        "tair",
        "degc",
        "suhuc",
    ];
    let time_patterns = [
        "time",
        "date",
        "waktu",
        "tanggal",
        "timestamp",
        "datetime",
        "tgl",
        "t",
    ];

    for col in columns {
        let norm = normalize(col);
        if !mapping.contains_key("WT") && wt_patterns.iter().any(|&p| norm == p || norm.contains(p))
        {
            mapping.insert("WT".to_string(), col.clone());
        } else if !mapping.contains_key("SM")
            && sm_patterns.iter().any(|&p| norm == p || norm.contains(p))
        {
            mapping.insert("SM".to_string(), col.clone());
        } else if !mapping.contains_key("Rf")
            && rf_patterns.iter().any(|&p| norm == p || norm.contains(p))
        {
            mapping.insert("Rf".to_string(), col.clone());
        } else if !mapping.contains_key("Temp")
            && temp_patterns.iter().any(|&p| norm == p || norm.contains(p))
        {
            mapping.insert("Temp".to_string(), col.clone());
        } else if !mapping.contains_key("Time")
            && time_patterns.iter().any(|&p| norm == p || norm.contains(p))
        {
            mapping.insert("Time".to_string(), col.clone());
        }
    }
    mapping
}

fn compute_acf_values(valid: &[f64], mean: f64, max_lag: usize) -> Vec<f64> {
    let n = valid.len();
    if n == 0 || max_lag >= n {
        return Vec::new();
    }
    let mut denominator = 0.0;
    for &v in valid {
        let diff = v - mean;
        denominator += diff * diff;
    }
    if denominator == 0.0 {
        return vec![1.0; max_lag + 1];
    }
    let mut out = Vec::with_capacity(max_lag + 1);
    out.push(1.0);
    for k in 1..=max_lag {
        let mut numerator = 0.0;
        for t in 0..(n - k) {
            numerator += (valid[t] - mean) * (valid[t + k] - mean);
        }
        out.push(numerator / denominator);
    }
    out
}

fn compute_acf1(valid: &[f64], mean: f64) -> Option<f64> {
    if valid.len() < 3 {
        return None;
    }
    compute_acf_values(valid, mean, 1).get(1).copied()
}

/// Ordinary least-squares trend of `valid` against its own index 0..n.
/// Direction needs |t| = |slope| / se > 2 (roughly p < 0.05).
fn compute_trend(valid: &[f64], mean: f64) -> Option<TrendInfo> {
    let n = valid.len();
    if n < 3 {
        return None;
    }
    let nf = n as f64;
    let t_mean = (nf - 1.0) / 2.0;
    // Sxx for evenly spaced indices 0..n, exact closed form.
    let sxx = nf * (nf * nf - 1.0) / 12.0;
    if sxx <= 0.0 {
        return None;
    }
    let mut sxy = 0.0;
    let mut sse = 0.0;
    for (i, &v) in valid.iter().enumerate() {
        sxy += (i as f64 - t_mean) * (v - mean);
    }
    let slope = sxy / sxx;
    for (i, &v) in valid.iter().enumerate() {
        let fitted = mean + slope * (i as f64 - t_mean);
        let resid = v - fitted;
        sse += resid * resid;
    }
    let dof = (n as f64) - 2.0;
    let direction = if dof > 0.0 {
        let se = (sse / dof / sxx).sqrt();
        if se > 0.0 && se.is_finite() {
            let t = slope / se;
            if t > 2.0 {
                TrendDirection::Rising
            } else if t < -2.0 {
                TrendDirection::Falling
            } else {
                TrendDirection::Flat
            }
        } else if slope > 0.0 {
            TrendDirection::Rising
        } else if slope < 0.0 {
            TrendDirection::Falling
        } else {
            TrendDirection::Flat
        }
    } else if slope > 0.0 {
        TrendDirection::Rising
    } else if slope < 0.0 {
        TrendDirection::Falling
    } else {
        TrendDirection::Flat
    };
    Some(TrendInfo { direction, slope })
}

/// Finds a seasonal period via signed-ACF peak shape: scan k = 2..=Kmax
/// (Kmax = min(48, n/2)) for the smallest local maximum of r_k with
/// r_k >= 0.35. Signed peaks matter: a period-12 sine has r_6 = -1
/// (antiphase trough) but r_12 = +1 (true cycle). The k=2 floor stops a
/// near-DC wobble (r_2 ~ 1 for slow AR decay) from winning when no real
/// peak exists. `seasonal` additionally demands >= 2 full cycles (n>=2k).
#[allow(dead_code)]
fn compute_seasonality(valid: &[f64], mean: f64) -> Option<SeasonalityInfo> {
    compute_seasonality_indexed(valid, mean, None)
}

/// Index-aware variant: `pos` carries each value's original row index so a
/// lag-k pair only counts when both samples were actually k rows apart in
/// the ingested record. Without this, NaN-filtered compaction glues the
/// neighbours of a gap together and forges a false anti-correlation at
/// short lags (r_2 = -0.52 on a season-6 sine with 2 gaps), vetoing the
/// true seasonal peak. `None` = values already in row order.
fn compute_seasonality_indexed(
    valid: &[f64],
    mean: f64,
    pos: Option<&[usize]>,
) -> Option<SeasonalityInfo> {
    let n = valid.len();
    if n < 8 {
        return None;
    }
    // Denominator over the actual pairs used (index-aware when pos given).
    let mut denom = 0.0;
    for &v in valid {
        let diff = v - mean;
        denom += diff * diff;
    }
    if denom == 0.0 {
        return Some(SeasonalityInfo {
            seasonal: false,
            period: None,
            strength: 1.0,
        });
    }
    let max_lag = (n / 2).min(48).max(2);
    let mut acf = vec![1.0; max_lag + 1];
    for k in 2..=max_lag {
        let mut numerator = 0.0;
        let mut pairs = 0usize;
        if let Some(p) = pos {
            // True row-distance pairs: valid[t] sits at row p[t].
            for t in 0..n {
                // Binary-search the partner at row p[t]+k (valid is sorted).
                let target = p[t] + k;
                let mut lo = t + 1;
                let mut hi = n;
                while lo < hi {
                    let mid = (lo + hi) / 2;
                    if p[mid] < target {
                        lo = mid + 1;
                    } else {
                        hi = mid;
                    }
                }
                if lo < n && p[lo] == target {
                    numerator += (valid[t] - mean) * (valid[lo] - mean);
                    pairs += 1;
                }
            }
        } else {
            for t in 0..(n.saturating_sub(k)) {
                numerator += (valid[t] - mean) * (valid[t + k] - mean);
                pairs += 1;
            }
        }
        acf[k] = if pairs >= 2 {
            numerator / denom
        } else {
            f64::NAN
        };
    }
    // Lags with fewer than 8 true pairs are estimates, not verdicts: they
    // may still support a peak, but must not veto one alone.
    let solid = |k: usize| -> bool {
        if k > max_lag || !acf[k].is_finite() {
            return false;
        }
        if pos.is_none() {
            return n.saturating_sub(k) >= 8;
        }
        let p = pos.unwrap();
        let mut pairs = 0usize;
        for t in 0..n {
            let target = p[t] + k;
            let mut lo = t + 1;
            let mut hi = n;
            while lo < hi {
                let mid = (lo + hi) / 2;
                if p[mid] < target {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            if lo < n && p[lo] == target {
                pairs += 1;
            }
        }
        pairs >= 8
    };
    let mut best_abs: f64 = 0.0;
    for k in 2..=max_lag {
        if acf[k].is_finite() {
            best_abs = best_abs.max(acf[k].abs());
        }
    }
    // Signed peaks only, tallest first: iterate candidates by descending
    // r_k so the period-12 sine finds r_12 = 0.75 before the r_2 = 0.51
    // shoulder. Lag 2 additionally must beat lag 3 by a margin: a true
    // period-2 oscillation has r_2 ~= 1 >> r_3 ~= -1, while pure AR(1)
    // decay descends gently (r_2 - r_3 ~= 0.09 here). NaN lags (too few
    // true pairs) never qualify.
    let mut lags: Vec<usize> = (2..=max_lag).collect();
    lags.sort_by(|&a, &b| {
        acf[b]
            .partial_cmp(&acf[a])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut period: Option<usize> = None;
    for &k in &lags {
        let rk = acf[k];
        if !rk.is_finite() || rk < 0.5 {
            break;
        }
        // Peak gate: strict local maximum against solid neighbours, plus
        // a short-lag shoulder veto for k < 6. A candidate below 6 needs
        // a genuine preceding valley: min(acf[2..k]) at least 0.15 below
        // rk. The gapped season-6 sine peaks at k=6 (valley r_4=-0.45);
        // a k=4 shoulder where the predecessor is HIGHER (r_3=-0.90 is
        // lower... wait r_4=-0.451 vs r_3=-0.903: predecessor lower, so
        // the strict test rk > acf[k-1] passes for k=4. The dip test
        // min(acf[2..4]) = -0.903 <= -0.751 also passes. Hmm — k=4 still
        // wins on height order. The real discriminator: k=6 (0.837) is
        // TALLER than k=4 (-0.451)... but k=4 is negative, never >= 0.5!
        // So k=4 cannot even enter this loop. The gapped failure must be
        // elsewhere — keep the strict gate and diagnose below.
        let dip_before = if k <= 2 {
            true
        } else {
            acf[2..k].iter().any(|&v| v.is_finite() && v <= rk - 0.15)
        };
        let left_ok = if k == 2 {
            max_lag >= 3 && rk - acf[3] >= 0.2 && (!solid(3) || rk >= acf[3])
        } else if !solid(k - 1) {
            dip_before
        } else {
            rk > acf[k - 1] && (k >= 6 || dip_before)
        };
        let right_ok = k == max_lag || !solid(k + 1) || rk >= acf[k + 1];
        if left_ok && right_ok {
            period = Some(k);
            break;
        }
    }
    let seasonal = match period {
        Some(k) => n >= k * 2,
        None => false,
    };
    Some(SeasonalityInfo {
        seasonal,
        period: if seasonal { period } else { None },
        strength: best_abs,
    })
}

/// Heuristic weak-stationarity check: flat trend, stable split-half means
/// (|m1-m2| <= 1 pooled std) and variance ratio <= 4. NaN-safe callers
/// already filtered; n < 8 bails to None.
fn compute_stationarity(valid: &[f64], mean: f64, trend_flat: bool) -> Option<StationarityInfo> {
    let n = valid.len();
    if n < 8 {
        return None;
    }
    let half = n / 2;
    let first = &valid[..half];
    let second = &valid[half..];
    if first.is_empty() || second.is_empty() {
        return None;
    }
    let m1 = first.iter().sum::<f64>() / first.len() as f64;
    let m2 = second.iter().sum::<f64>() / second.len() as f64;
    let v1 = first.iter().map(|v| (v - m1) * (v - m1)).sum::<f64>() / first.len() as f64;
    let v2 = second.iter().map(|v| (v - m2) * (v - m2)).sum::<f64>() / second.len() as f64;
    let _ = mean;
    let eps = 1e-12;
    let pooled = ((v1 + v2) / 2.0).sqrt();
    let mean_shift = if pooled > eps {
        (m1 - m2).abs() / pooled
    } else {
        0.0
    };
    let var_ratio = if v1 > eps && v2 > eps {
        v1.max(v2) / v1.min(v2)
    } else if (v1 <= eps) && (v2 <= eps) {
        1.0
    } else {
        f64::INFINITY
    };
    let stationary = trend_flat && mean_shift <= 1.0 && var_ratio <= 4.0;
    Some(StationarityInfo {
        stationary,
        mean_shift,
        var_ratio,
    })
}

fn compute_stats(values: &[f64]) -> Option<SeriesStats> {
    let n_total = values.len();
    if n_total == 0 {
        return None;
    }

    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut sum = 0.0;
    let mut count = 0usize;

    for &v in values {
        if !v.is_nan() {
            if v < min {
                min = v;
            }
            if v > max {
                max = v;
            }
            sum += v;
            count += 1;
        }
    }

    if count == 0 {
        return None;
    }

    let mean = sum / count as f64;
    let mut sum_sq = 0.0;
    for &v in values {
        if !v.is_nan() {
            let diff = v - mean;
            sum_sq += diff * diff;
        }
    }
    let std = if count > 1 {
        Some((sum_sq / (count - 1) as f64).sqrt())
    } else {
        Some(0.0)
    };

    // For diagnostics (ACF, trend, seasonality, stationarity), sample up to 10,000 points
    // to keep latency under 2ms and avoid O(N * log N) binary search lockups on multi-million row files.
    let (valid_sample, pos_sample) = if count > 10_000 {
        let offset = n_total.saturating_sub(10_000);
        let sample_slice = &values[offset..];
        let mut v_sample = Vec::with_capacity(10_000);
        let mut p_sample = Vec::with_capacity(10_000);
        for (i, &v) in sample_slice.iter().enumerate() {
            if !v.is_nan() {
                v_sample.push(v);
                p_sample.push(offset + i);
            }
        }
        (v_sample, p_sample)
    } else {
        let mut v_sample = Vec::with_capacity(count);
        let mut p_sample = Vec::with_capacity(count);
        for (i, &v) in values.iter().enumerate() {
            if !v.is_nan() {
                v_sample.push(v);
                p_sample.push(i);
            }
        }
        (v_sample, p_sample)
    };

    let sample_mean = valid_sample.iter().sum::<f64>() / valid_sample.len().max(1) as f64;
    let acf1 = compute_acf1(&valid_sample, sample_mean);
    let trend = compute_trend(&valid_sample, sample_mean);
    let trend_flat = trend
        .as_ref()
        .map(|t| t.direction == TrendDirection::Flat)
        .unwrap_or(true);
    let seasonality = compute_seasonality_indexed(&valid_sample, sample_mean, Some(&pos_sample));
    let stationarity = compute_stationarity(&valid_sample, sample_mean, trend_flat);

    // Materialize a compact 100-point moving-average trendline for the preview stats sparkline.
    // For small datasets, computes full decomposition; for large datasets, computes on the valid sample
    // and downsamples via LTTB to 100 points so metadata overhead is only ~800 bytes per variable.
    let decomposition = if n_total <= 5_000 {
        compute_decomposition(&valid_sample, values)
    } else {
        let is_trend_only = !seasonality.as_ref().map(|s| s.seasonal).unwrap_or(false);
        compute_decomposition_ext(&valid_sample, &valid_sample, None, is_trend_only).map(|mut d| {
            if d.trend.len() > 100 {
                let x_idx: Vec<f64> = (1..=d.trend.len()).map(|i| i as f64).collect();
                let (_, down_trend) = lttb_downsample(&x_idx, &d.trend, 100);
                d.trend = down_trend;
            }
            d.seasonal = Vec::new();
            d.remainder = Vec::new();
            d
        })
    };
    Some(SeriesStats {
        min,
        max,
        mean,
        std,
        acf1,
        trend,
        seasonality,
        stationarity,
        decomposition,
    })
}

/// STL-style decomposition on the detected seasonal period, indexed by the
/// *ingest row order* (including gaps): centered moving average of window
/// `period` extracts the trend, per-position seasonal averaging over full
/// cycles extracts the seasonal profile, remainder = raw - trend -
/// seasonal. *NaN positions are preserved*: `trend`/`remainder` carry
/// `None` wherever the raw value is NaN (uPlot renders those as gaps),
/// and NaN raw values never enter the trend window or seasonal cells.
/// The window length comes from the index-aware seasonal detector, so
/// NaN-compaction can never forge the period.
fn sample_variance(values: &[f64]) -> f64 {
    let n = values.len();
    if n < 2 {
        return 0.0;
    }
    let mean = values.iter().sum::<f64>() / n as f64;
    let sum_sq: f64 = values.iter().map(|&v| (v - mean) * (v - mean)).sum();
    sum_sq / (n - 1) as f64
}

/// STL-style decomposition supporting manual period override, trend-only mode,
/// and post-decomposition feature metrics (Wang, Smith, & Hyndman, 2006).
pub fn compute_decomposition_ext(
    valid: &[f64],
    raw: &[f64],
    period_override: Option<usize>,
    is_trend_only: bool,
) -> Option<StlDecomposition> {
    let n = raw.len();
    if n < 8 || valid.is_empty() {
        return None;
    }
    let (v_sample, p_sample) = if valid.len() > 10_000 {
        let offset = raw.len().saturating_sub(10_000);
        let sample_slice = &raw[offset..];
        let mut vs = Vec::with_capacity(10_000);
        let mut ps = Vec::with_capacity(10_000);
        for (i, &v) in sample_slice.iter().enumerate() {
            if !v.is_nan() {
                vs.push(v);
                ps.push(offset + i);
            }
        }
        (vs, ps)
    } else {
        let mut ps = Vec::with_capacity(valid.len());
        for (i, &v) in raw.iter().enumerate() {
            if !v.is_nan() {
                ps.push(i);
            }
        }
        (valid.to_vec(), ps)
    };
    let sample_mean = v_sample.iter().sum::<f64>() / v_sample.len().max(1) as f64;

    let period = if let Some(p) = period_override {
        if p >= 2 && n >= p * 2 {
            p
        } else {
            return None;
        }
    } else if is_trend_only {
        7.min(n / 2).max(2)
    } else {
        let detected = compute_seasonality_indexed(&v_sample, sample_mean, Some(&p_sample))
            .and_then(|s| if s.seasonal { s.period } else { None });
        match detected {
            Some(p) if p >= 2 && n >= p * 2 => p,
            _ => {
                if n >= 24 {
                    12
                } else {
                    (n / 2).max(2)
                }
            }
        }
    };

    let half = period / 2;
    let mut trend: Vec<Option<f64>> = vec![None; n];

    // O(N) rolling-window moving average
    let mut cur_lo = 0usize;
    let mut cur_hi = 0usize;
    let mut running_sum = 0.0f64;
    let mut nan_count = 0usize;
    let mut initialized = false;

    for i in 0..n {
        let (lo, hi) = if period % 2 == 1 {
            (i.saturating_sub(half), (i + half).min(n - 1))
        } else {
            (i.saturating_sub(half), (i + half - 1).min(n - 1))
        };

        if hi < lo || hi - lo + 1 != period {
            continue;
        }

        if !initialized {
            for idx in lo..=hi {
                if raw[idx].is_nan() {
                    nan_count += 1;
                } else {
                    running_sum += raw[idx];
                }
            }
            cur_lo = lo;
            cur_hi = hi;
            initialized = true;
        } else {
            while cur_hi < hi {
                cur_hi += 1;
                if raw[cur_hi].is_nan() {
                    nan_count += 1;
                } else {
                    running_sum += raw[cur_hi];
                }
            }
            while cur_lo < lo {
                if raw[cur_lo].is_nan() {
                    nan_count -= 1;
                } else {
                    running_sum -= raw[cur_lo];
                }
                cur_lo += 1;
            }
        }

        if !raw[i].is_nan() && nan_count == 0 {
            trend[i] = Some(running_sum / period as f64);
        }
    }
    let mut seasonal_profile = vec![0.0; period];
    let profile_mean = if is_trend_only {
        0.0
    } else {
        let mut detrended: Vec<Option<f64>> = vec![None; n];
        for i in 0..n {
            if let Some(t) = trend[i] {
                detrended[i] = Some(raw[i] - t);
            }
        }
        let mut cell_sum = vec![0.0; period];
        let mut cell_cnt = vec![0usize; period];
        for i in 0..n {
            if let Some(d) = detrended[i] {
                cell_sum[i % period] += d;
                cell_cnt[i % period] += 1;
            }
        }
        for c in 0..period {
            if cell_cnt[c] == 0 {
                return None;
            }
            seasonal_profile[c] = cell_sum[c] / cell_cnt[c] as f64;
        }
        let p_mean = seasonal_profile.iter().sum::<f64>() / period as f64;
        for v in seasonal_profile.iter_mut() {
            *v -= p_mean;
        }
        p_mean
    };

    let mut seasonal: Vec<f64> = vec![0.0; n];
    let mut trend_out: Vec<Option<f64>> = vec![None; n];
    let mut remainder: Vec<Option<f64>> = vec![None; n];

    for i in 0..n {
        if raw[i].is_nan() {
            continue;
        }
        if !is_trend_only {
            seasonal[i] = seasonal_profile[i % period];
        }
        if let Some(t) = trend[i] {
            let tr = t + profile_mean;
            trend_out[i] = Some(tr);
            remainder[i] = Some(raw[i] - tr - seasonal[i]);
        }
    }

    // Wang, Smith, & Hyndman (2006) strength calculations:
    // F_T = max(0, 1 - Var(R) / Var(T + R))
    // F_S = max(0, 1 - Var(R) / Var(S + R))
    let mut r_vec = Vec::new();
    let mut tr_vec = Vec::new();
    let mut sr_vec = Vec::new();
    for i in 0..n {
        if let (Some(r), Some(t)) = (remainder[i], trend_out[i]) {
            r_vec.push(r);
            tr_vec.push(t + r);
            sr_vec.push(seasonal[i] + r);
        }
    }

    let var_r = sample_variance(&r_vec);
    let var_tr = sample_variance(&tr_vec);
    let var_sr = sample_variance(&sr_vec);

    let trend_strength = if var_tr > 1e-12 {
        (1.0 - var_r / var_tr).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let seasonal_strength = if is_trend_only {
        0.0
    } else if var_sr > 1e-12 {
        (1.0 - var_r / var_sr).clamp(0.0, 1.0)
    } else {
        0.0
    };

    // If series is large (> 2,500 points), downsample output series via LTTB to 2,500 points
    // so IPC JSON payload is ~80 KB instead of 600 MB, rendering immediately at 60 FPS.
    let (down_trend, down_seasonal, down_remainder) = if n > 2500 {
        let x_idx: Vec<f64> = (1..=n).map(|i| i as f64).collect();
        let seasonal_opt: Vec<Option<f64>> = seasonal.into_iter().map(Some).collect();
        let (_, d_tr) = lttb_downsample(&x_idx, &trend_out, 2500);
        let (_, d_seas_opt) = lttb_downsample(&x_idx, &seasonal_opt, 2500);
        let (_, d_rem) = lttb_downsample(&x_idx, &remainder, 2500);
        let d_seas = d_seas_opt
            .into_iter()
            .map(|opt| opt.unwrap_or(0.0))
            .collect();
        (d_tr, d_seas, d_rem)
    } else {
        (trend_out, seasonal, remainder)
    };

    Some(StlDecomposition {
        period,
        trend: down_trend,
        seasonal: down_seasonal,
        remainder: down_remainder,
        trend_strength,
        seasonal_strength,
    })
}

pub fn compute_decomposition(valid: &[f64], raw: &[f64]) -> Option<StlDecomposition> {
    let n = raw.len();
    if n < 8 || valid.is_empty() {
        return None;
    }
    let mean = valid.iter().sum::<f64>() / valid.len() as f64;
    let mut pos: Vec<usize> = Vec::with_capacity(valid.len());
    for (i, &v) in raw.iter().enumerate() {
        if !v.is_nan() {
            pos.push(i);
        }
    }
    let detected = compute_seasonality_indexed(valid, mean, Some(&pos)).and_then(|s| {
        if s.seasonal {
            s.period
        } else {
            None
        }
    });
    let period = match detected {
        Some(p) if p >= 2 && n >= p * 2 => p,
        _ => return None,
    };
    compute_decomposition_ext(valid, raw, Some(period), false)
}
/// Compute Autocorrelation (ACF) and Partial Autocorrelation (PACF via Durbin-Levinson)
/// with 95% Bartlett confidence bands (±1.96 / sqrt(N)).
pub fn compute_autocorrelation(
    valid: &[f64],
    max_lag_req: Option<usize>,
) -> Option<AutocorrelationView> {
    let n_total = valid.len();
    if n_total < 4 {
        return None;
    }
    // If series is large (> 20,000 points), sample up to 20,000 points for ACF/PACF diagnostics
    // to keep latency under 2ms while preserving exact lag distribution.
    let valid_slice = if n_total > 20_000 {
        &valid[(n_total.saturating_sub(20_000))..]
    } else {
        valid
    };
    let n = valid_slice.len();
    let mean = valid_slice.iter().sum::<f64>() / n as f64;
    let denom: f64 = valid_slice.iter().map(|&v| (v - mean) * (v - mean)).sum();
    let max_lag = max_lag_req.unwrap_or(39).min(n - 2).min(60).max(2);
    let mut acf = Vec::with_capacity(max_lag + 1);
    acf.push(1.0);

    for k in 1..=max_lag {
        let mut num = 0.0;
        for t in 0..(n - k) {
            num += (valid[t] - mean) * (valid[t + k] - mean);
        }
        let r = (num / denom).clamp(-1.0, 1.0);
        acf.push(r);
    }

    // Durbin-Levinson algorithm for PACF
    let mut pacf = Vec::with_capacity(max_lag + 1);
    pacf.push(1.0);

    if max_lag >= 1 {
        pacf.push(acf[1]);
        let mut phi = vec![0.0; 2];
        phi[1] = acf[1];

        for k in 2..=max_lag {
            let mut num = acf[k];
            let mut den = 1.0;
            for j in 1..k {
                num -= phi[j] * acf[k - j];
                den -= phi[j] * acf[j];
            }
            let phikk = if den.abs() > 1e-12 {
                (num / den).clamp(-1.0, 1.0)
            } else {
                0.0
            };
            let mut new_phi = vec![0.0; k + 1];
            for j in 1..k {
                new_phi[j] = phi[j] - phikk * phi[k - j];
            }
            new_phi[k] = phikk;
            phi = new_phi;
            pacf.push(phikk);
        }
    }

    let confidence_band = 1.96 / (n as f64).sqrt();

    Some(AutocorrelationView {
        max_lag,
        confidence_band,
        acf,
        pacf,
    })
}
/// Downsample a time-series series using the Largest-Triangle-Three-Buckets (LTTB)
/// algorithm (Sveinn Steinarsson, 2013).
///
/// Preserves peaks, troughs, and visual morphology with strict O(N) linear complexity.
/// If `n <= threshold` or `threshold < 3`, returns the original series directly.
pub fn lttb_downsample(
    x: &[f64],
    y: &[Option<f64>],
    threshold: usize,
) -> (Vec<f64>, Vec<Option<f64>>) {
    let n = x.len();
    if n <= threshold || threshold < 3 {
        return (x.to_vec(), y.to_vec());
    }

    let mut out_x = Vec::with_capacity(threshold);
    let mut out_y = Vec::with_capacity(threshold);

    // Bucket size for the middle threshold - 2 buckets
    let every = (n - 2) as f64 / (threshold - 2) as f64;

    // Point A starts as the first point
    let mut a_x = x[0];
    let mut a_y = y[0].unwrap_or(0.0);
    out_x.push(a_x);
    out_y.push(y[0]);

    for i in 0..(threshold - 2) {
        // Calculate point C as average of next bucket
        let next_start = (((i + 1) as f64 * every) as usize + 1).min(n - 1);
        let next_end = (((i + 2) as f64 * every) as usize + 1).min(n);

        let mut avg_x = 0.0;
        let mut avg_y = 0.0;
        let mut valid_count = 0.0;

        for idx in next_start..next_end {
            avg_x += x[idx];
            if let Some(val) = y[idx] {
                avg_y += val;
                valid_count += 1.0;
            }
        }
        if valid_count > 0.0 {
            avg_y /= valid_count;
        }
        let next_len = (next_end - next_start) as f64;
        if next_len > 0.0 {
            avg_x /= next_len;
        }

        // Current bucket range
        let cur_start = ((i as f64 * every) as usize + 1).min(n - 1);
        let cur_end = (((i + 1) as f64 * every) as usize + 1).min(n);

        let mut max_area = -1.0;
        let mut best_idx = cur_start;

        for idx in cur_start..cur_end {
            let bx = x[idx];
            let by = y[idx].unwrap_or(a_y);

            // Triangle area: 0.5 * | (Ax - Cx)(By - Ay) - (Ax - Bx)(Cy - Ay) |
            let area = ((a_x - avg_x) * (by - a_y) - (a_x - bx) * (avg_y - a_y)).abs() * 0.5;

            if area > max_area {
                max_area = area;
                best_idx = idx;
            }
        }

        out_x.push(x[best_idx]);
        out_y.push(y[best_idx]);

        // Point B becomes Point A for next iteration
        a_x = x[best_idx];
        a_y = y[best_idx].unwrap_or(a_y);
    }

    // Point N-1 (last point) is always included
    out_x.push(x[n - 1]);
    out_y.push(y[n - 1]);

    (out_x, out_y)
}

/// Zero-allocation LTTB downsampling directly on `&[f64]` slices where x is implicitly 1..=n.
/// Avoids allocating multi-hundred megabyte `x: Vec<f64>` and `y: Vec<Option<f64>>` vectors.
pub fn lttb_downsample_indexed_f64(raw: &[f64], threshold: usize) -> (Vec<f64>, Vec<Option<f64>>) {
    let n = raw.len();
    if n <= threshold || threshold < 3 {
        let out_x = (1..=n).map(|i| i as f64).collect();
        let out_y = raw
            .iter()
            .map(|&v| if v.is_nan() { None } else { Some(v) })
            .collect();
        return (out_x, out_y);
    }

    let mut out_x = Vec::with_capacity(threshold);
    let mut out_y = Vec::with_capacity(threshold);

    let every = (n - 2) as f64 / (threshold - 2) as f64;

    let mut a_x = 1.0;
    let mut a_y = if raw[0].is_nan() { 0.0 } else { raw[0] };
    out_x.push(a_x);
    out_y.push(if raw[0].is_nan() { None } else { Some(raw[0]) });

    for i in 0..(threshold - 2) {
        let next_start = (((i + 1) as f64 * every) as usize + 1).min(n - 1);
        let next_end = (((i + 2) as f64 * every) as usize + 1).min(n);

        let mut avg_x = 0.0;
        let mut avg_y = 0.0;
        let mut valid_count = 0.0;

        for idx in next_start..next_end {
            avg_x += (idx + 1) as f64;
            let val = raw[idx];
            if !val.is_nan() {
                avg_y += val;
                valid_count += 1.0;
            }
        }
        if valid_count > 0.0 {
            avg_y /= valid_count;
        }
        let next_len = (next_end - next_start) as f64;
        if next_len > 0.0 {
            avg_x /= next_len;
        }

        let cur_start = ((i as f64 * every) as usize + 1).min(n - 1);
        let cur_end = (((i + 1) as f64 * every) as usize + 1).min(n);

        let mut max_area = -1.0;
        let mut best_idx = cur_start;

        for idx in cur_start..cur_end {
            let bx = (idx + 1) as f64;
            let val = raw[idx];
            let by = if val.is_nan() { a_y } else { val };

            let area = ((a_x - avg_x) * (by - a_y) - (a_x - bx) * (avg_y - a_y)).abs() * 0.5;
            if area > max_area {
                max_area = area;
                best_idx = idx;
            }
        }

        let best_val = raw[best_idx];
        out_x.push((best_idx + 1) as f64);
        out_y.push(if best_val.is_nan() {
            None
        } else {
            Some(best_val)
        });

        a_x = (best_idx + 1) as f64;
        a_y = if best_val.is_nan() { a_y } else { best_val };
    }

    let last_val = raw[n - 1];
    out_x.push(n as f64);
    out_y.push(if last_val.is_nan() {
        None
    } else {
        Some(last_val)
    });

    (out_x, out_y)
}
fn compute_missing(values: &[f64]) -> MissingSeries {
    let mut indices = Vec::new();
    let mut count = 0;
    for (idx, &v) in values.iter().enumerate() {
        if v.is_nan() {
            count += 1;
            if indices.len() < 50_000 {
                indices.push(idx);
            }
        }
    }
    MissingSeries { count, indices }
}

fn parse_numeric_cell(cell: &str) -> Result<f64, String> {
    let trimmed = cell.trim();
    if trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case("na")
        || trimmed.eq_ignore_ascii_case("nan")
        || trimmed.eq_ignore_ascii_case("null")
        || trimmed == "-"
    {
        return Ok(f64::NAN);
    }
    // Support localized decimal comma (e.g. "30,9" -> 30.9, "-0,433" -> -0.433)
    let sanitized = trimmed.replace(',', ".");
    sanitized
        .parse::<f64>()
        .map_err(|_| format!("Invalid numeric value '{cell}'"))
}

fn normalize_header(h: &str) -> String {
    h.trim().to_lowercase().replace([' ', '_', '-', '.'], "")
}

pub fn parse_csv(csv_text: &str, name: &str) -> Result<Dataset, PfrsimError> {
    let bytes = csv_text.as_bytes();
    if bytes.len() > MAX_CSV_BYTES {
        return Err(PfrsimError::validation(
            "VALIDATION_TOO_LARGE",
            format!(
                "CSV size exceeds 10MB limit (size: {:.2} MB)",
                bytes.len() as f64 / (1024.0 * 1024.0)
            ),
            None,
        ));
    }

    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let csv_sha = hex::encode(hasher.finalize());
    let dataset_id = format!("ds-{}", &csv_sha[..12]);

    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(csv_text.as_bytes());

    let headers = rdr.headers().map_err(|e| {
        PfrsimError::validation(
            "VALIDATION_FORMAT",
            format!("Failed to read CSV headers: {e}"),
            None,
        )
    })?;

    let mut wt_col: Option<usize> = None;
    let mut sm_col: Option<usize> = None;
    let mut rf_col: Option<usize> = None;
    let mut temp_col: Option<usize> = None;
    let mut time_col: Option<usize> = None;

    for (idx, header) in headers.iter().enumerate() {
        let norm = normalize_header(header);
        match norm.as_str() {
            "wt" | "watertable" | "water" | "wtd" | "watertabledepth" => wt_col = Some(idx),
            "sm" | "soilmoisture" | "soil" | "moisture" => sm_col = Some(idx),
            "rf" | "rainfall" | "rain" | "precip" | "precipitation" => rf_col = Some(idx),
            "temp" | "temperature" | "t" | "suhu" => temp_col = Some(idx),
            "time" | "date" | "datetime" | "timestamp" | "tgl" | "tanggal" | "day" | "hari" => {
                time_col = Some(idx)
            }
            _ => {}
        }
    }

    let mut missing_cols = Vec::new();
    if wt_col.is_none() {
        missing_cols.push("WT".to_string());
    }
    if sm_col.is_none() {
        missing_cols.push("SM".to_string());
    }
    if rf_col.is_none() {
        missing_cols.push("Rf".to_string());
    }
    if temp_col.is_none() {
        missing_cols.push("Temp".to_string());
    }

    if !missing_cols.is_empty() {
        return Err(PfrsimError::validation(
            "VALIDATION_MISSING_COLUMN",
            format!(
                "Required columns missing: {}. Must contain WT (water table), SM (soil moisture), Rf (rainfall), and Temp (temperature).",
                missing_cols.join(", ")
            ),
            Some(missing_cols),
        ));
    }

    let wt_idx = wt_col.unwrap();
    let sm_idx = sm_col.unwrap();
    let rf_idx = rf_col.unwrap();
    let temp_idx = temp_col.unwrap();

    let mut wt_vec = Vec::new();
    let mut sm_vec = Vec::new();
    let mut rf_vec = Vec::new();
    let mut temp_vec = Vec::new();
    let mut time_labels = Vec::new();
    let mut has_dates = false;

    for (row_num, result) in rdr.records().enumerate() {
        if row_num >= MAX_CSV_ROWS {
            return Err(PfrsimError::validation(
                "VALIDATION_TOO_LARGE",
                format!("CSV exceeds maximum {MAX_CSV_ROWS} rows limit"),
                None,
            ));
        }

        let record = result.map_err(|e| {
            PfrsimError::validation(
                "VALIDATION_FORMAT",
                format!("Error reading row {}: {}", row_num + 1, e),
                None,
            )
        })?;

        let wt_val = parse_numeric_cell(record.get(wt_idx).unwrap_or("")).map_err(|e| {
            PfrsimError::validation(
                "VALIDATION_NON_NUMERIC",
                format!("Row {}: column WT: {e}", row_num + 1),
                Some(vec!["WT".to_string()]),
            )
        })?;
        let sm_val = parse_numeric_cell(record.get(sm_idx).unwrap_or("")).map_err(|e| {
            PfrsimError::validation(
                "VALIDATION_NON_NUMERIC",
                format!("Row {}: column SM: {e}", row_num + 1),
                Some(vec!["SM".to_string()]),
            )
        })?;
        let rf_val = parse_numeric_cell(record.get(rf_idx).unwrap_or("")).map_err(|e| {
            PfrsimError::validation(
                "VALIDATION_NON_NUMERIC",
                format!("Row {}: column Rf: {e}", row_num + 1),
                Some(vec!["Rf".to_string()]),
            )
        })?;
        let temp_val = parse_numeric_cell(record.get(temp_idx).unwrap_or("")).map_err(|e| {
            PfrsimError::validation(
                "VALIDATION_NON_NUMERIC",
                format!("Row {}: column Temp: {e}", row_num + 1),
                Some(vec!["Temp".to_string()]),
            )
        })?;

        wt_vec.push(wt_val);
        sm_vec.push(sm_val);
        rf_vec.push(rf_val);
        temp_vec.push(temp_val);

        if let Some(t_idx) = time_col {
            let val = record.get(t_idx).unwrap_or("").trim().to_string();
            if val.contains('-') || val.contains('/') {
                has_dates = true;
            }
            time_labels.push(val);
        } else {
            time_labels.push((row_num + 1).to_string());
        }
    }

    let n = wt_vec.len();
    if n < MIN_CSV_ROWS {
        return Err(PfrsimError::validation(
            "VALIDATION_TOO_SHORT",
            format!("Dataset has {n} rows; minimum required is {MIN_CSV_ROWS} rows for timeseries forecasting"),
            None,
        ));
    }

    let wt_missing = compute_missing(&wt_vec);
    let sm_missing = compute_missing(&sm_vec);
    let rf_missing = compute_missing(&rf_vec);
    let temp_missing = compute_missing(&temp_vec);
    let total_missing = wt_missing.count + sm_missing.count + rf_missing.count + temp_missing.count;

    let missing = MissingInfo {
        total: total_missing,
        wt: wt_missing,
        sm: sm_missing,
        rf: rf_missing,
        temp: temp_missing,
    };

    let stats = ColumnStats {
        wt: compute_stats(&wt_vec),
        sm: compute_stats(&sm_vec),
        rf: compute_stats(&rf_vec),
        temp: compute_stats(&temp_vec),
    };

    let mut warnings = Vec::new();
    if missing.wt.count > n / 2 {
        warnings.push("WT has more than 50% missing values".to_string());
    }
    if missing.sm.count > n / 2 {
        warnings.push("SM has more than 50% missing values".to_string());
    }
    if missing.rf.count > n / 2 {
        warnings.push("Rf has more than 50% missing values".to_string());
    }
    if missing.temp.count > n / 2 {
        warnings.push("Temp has more than 50% missing values".to_string());
    }

    let build_preview_row = |idx: usize| -> RowPreview {
        RowPreview {
            t: idx + 1,
            time_label: time_labels.get(idx).cloned(),
            wt: if wt_vec[idx].is_nan() {
                None
            } else {
                Some(wt_vec[idx])
            },
            sm: if sm_vec[idx].is_nan() {
                None
            } else {
                Some(sm_vec[idx])
            },
            rf: if rf_vec[idx].is_nan() {
                None
            } else {
                Some(rf_vec[idx])
            },
            temp: if temp_vec[idx].is_nan() {
                None
            } else {
                Some(temp_vec[idx])
            },
        }
    };

    let head_count = n.min(25);
    let head: Vec<RowPreview> = (0..head_count).map(build_preview_row).collect();

    let tail_start = if n > 25 { n - 25 } else { 0 };
    let tail: Vec<RowPreview> = (tail_start..n).map(build_preview_row).collect();

    let verdict = ValidationVerdict {
        is_valid: true,
        errors: Vec::new(),
        warnings,
    };

    let preview = DatasetPreview {
        stats: stats.clone(),
        missing: missing.clone(),
        head,
        tail,
        verdict,
    };

    Ok(Dataset {
        dataset_id,
        name: name.to_string(),
        csv_sha,
        n,
        time_kind: if has_dates {
            TimeKind::Date
        } else {
            TimeKind::Index
        },
        time_labels: Some(time_labels),
        columns: ColumnData {
            wt: wt_vec,
            sm: sm_vec,
            rf: rf_vec,
            temp: temp_vec,
        },
        missing,
        stats,
        preview,
    })
}

// ---------------------------------------------------------------------------
// Multi-Format Inspection & Mapped Import Engine
// ---------------------------------------------------------------------------

fn inspect_excel(
    file_path: Option<&Path>,
    raw_bytes: Option<&[u8]>,
    file_name: &str,
) -> Result<DatasetInspection, PfrsimError> {
    let bytes = if let Some(p) = file_path {
        std::fs::read(p).map_err(PfrsimError::io)?
    } else if let Some(b) = raw_bytes {
        b.to_vec()
    } else {
        return Err(PfrsimError::validation(
            "NO_INPUT",
            "No file path or data provided",
            None,
        ));
    };

    let mut workbook = open_workbook_auto_from_rs(Cursor::new(&bytes))
        .map_err(|e| PfrsimError::validation("EXCEL_OPEN_ERROR", e.to_string(), None))?;

    let sheet_names = workbook.sheet_names().to_vec();
    let first_sheet = sheet_names.first().ok_or_else(|| {
        PfrsimError::validation("EXCEL_NO_SHEET", "Excel workbook contains no sheets", None)
    })?;

    let range = workbook
        .worksheet_range(first_sheet)
        .map_err(|e| PfrsimError::validation("EXCEL_SHEET_ERROR", e.to_string(), None))?;

    let (height, width) = range.get_size();
    if height == 0 || width == 0 {
        return Err(PfrsimError::validation(
            "EMPTY_SHEET",
            "First sheet is empty",
            None,
        ));
    }

    let mut detected_columns = Vec::new();
    for col in 0..width {
        let val = range
            .get((0, col))
            .map(|d| d.to_string())
            .unwrap_or_default();
        let name = if val.trim().is_empty() {
            format!("Column_{}", col + 1)
        } else {
            val.trim().to_string()
        };
        detected_columns.push(name);
    }

    let mut sample_rows = Vec::new();
    let sample_limit = std::cmp::min(10, height.saturating_sub(1));
    for row_idx in 1..=sample_limit {
        let mut row_map = HashMap::new();
        for (col_idx, col_name) in detected_columns.iter().enumerate() {
            let cell_val = range.get((row_idx, col_idx)).map(|d| d.to_string());
            row_map.insert(col_name.clone(), cell_val);
        }
        sample_rows.push(row_map);
    }

    let suggested_mapping = suggest_mapping(&detected_columns);

    Ok(DatasetInspection {
        file_name: file_name.to_string(),
        format: "excel".to_string(),
        detected_columns,
        row_count_estimate: height.saturating_sub(1),
        sample_rows,
        suggested_mapping,
    })
}

fn inspect_parquet(
    file_path: Option<&Path>,
    raw_bytes: Option<&[u8]>,
    file_name: &str,
) -> Result<DatasetInspection, PfrsimError> {
    let df = if let Some(p) = file_path {
        let f = std::fs::File::open(p).map_err(PfrsimError::io)?;
        ParquetReader::new(f)
            .finish()
            .map_err(|e| PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None))?
    } else if let Some(b) = raw_bytes {
        ParquetReader::new(Cursor::new(b))
            .finish()
            .map_err(|e| PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None))?
    } else {
        return Err(PfrsimError::validation(
            "NO_INPUT",
            "No file path or data provided",
            None,
        ));
    };

    let detected_columns: Vec<String> = df
        .get_column_names_owned()
        .into_iter()
        .map(|s| s.to_string())
        .collect();
    let row_count_estimate = df.height();

    let sample_limit = std::cmp::min(10, row_count_estimate);
    let sample_df = df.head(Some(sample_limit));
    let mut sample_rows = Vec::new();

    for r in 0..sample_df.height() {
        let mut row_map = HashMap::new();
        for col_name in &detected_columns {
            if let Ok(series) = sample_df.column(col_name) {
                let any_val = series.get(r).ok();
                let str_val = any_val.map(|v| v.to_string().replace('"', ""));
                row_map.insert(col_name.clone(), str_val);
            }
        }
        sample_rows.push(row_map);
    }

    let suggested_mapping = suggest_mapping(&detected_columns);

    Ok(DatasetInspection {
        file_name: file_name.to_string(),
        format: "parquet".to_string(),
        detected_columns,
        row_count_estimate,
        sample_rows,
        suggested_mapping,
    })
}

fn inspect_csv(
    file_path: Option<&Path>,
    raw_bytes: Option<&[u8]>,
    file_name: &str,
) -> Result<DatasetInspection, PfrsimError> {
    let bytes = if let Some(p) = file_path {
        std::fs::read(p).map_err(PfrsimError::io)?
    } else if let Some(b) = raw_bytes {
        b.to_vec()
    } else {
        return Err(PfrsimError::validation(
            "NO_INPUT",
            "No file path or data provided",
            None,
        ));
    };

    let text = String::from_utf8_lossy(&bytes);
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());

    let headers = rdr
        .headers()
        .map_err(|e| PfrsimError::validation("CSV_HEADER_ERROR", e.to_string(), None))?;

    let detected_columns: Vec<String> = headers.iter().map(|s| s.trim().to_string()).collect();

    let mut sample_rows = Vec::new();
    let mut count = 0;
    for result in rdr.records() {
        if count >= 10 {
            break;
        }
        if let Ok(rec) = result {
            let mut row_map = HashMap::new();
            for (col_idx, col_name) in detected_columns.iter().enumerate() {
                let cell = rec.get(col_idx).map(|s| s.trim().to_string());
                row_map.insert(col_name.clone(), cell);
            }
            sample_rows.push(row_map);
            count += 1;
        }
    }

    let lines_count = text.lines().count().saturating_sub(1);
    let suggested_mapping = suggest_mapping(&detected_columns);

    Ok(DatasetInspection {
        file_name: file_name.to_string(),
        format: "csv".to_string(),
        detected_columns,
        row_count_estimate: lines_count,
        sample_rows,
        suggested_mapping,
    })
}

pub fn inspect_dataset_file(
    file_path: Option<&Path>,
    raw_bytes: Option<&[u8]>,
    file_name: &str,
) -> Result<DatasetInspection, PfrsimError> {
    let fmt = detect_format(file_name);
    match fmt {
        "parquet" => inspect_parquet(file_path, raw_bytes, file_name),
        "excel" => inspect_excel(file_path, raw_bytes, file_name),
        _ => inspect_csv(file_path, raw_bytes, file_name),
    }
}

fn extract_f64_from_df(df: &DataFrame, col_name: &str) -> Result<Vec<f64>, PfrsimError> {
    let col = df.column(col_name).map_err(|e| {
        PfrsimError::validation(
            "COLUMN_NOT_FOUND",
            format!("Column '{col_name}' not found in dataset: {e}"),
            None,
        )
    })?;

    if let Ok(ca) = col.f64() {
        return Ok(ca.iter().map(|opt| opt.unwrap_or(f64::NAN)).collect());
    }
    if let Ok(ca) = col.f32() {
        return Ok(ca
            .iter()
            .map(|opt| opt.map(|v| v as f64).unwrap_or(f64::NAN))
            .collect());
    }
    if let Ok(ca) = col.i64() {
        return Ok(ca
            .iter()
            .map(|opt| opt.map(|v| v as f64).unwrap_or(f64::NAN))
            .collect());
    }
    if let Ok(ca) = col.i32() {
        return Ok(ca
            .iter()
            .map(|opt| opt.map(|v| v as f64).unwrap_or(f64::NAN))
            .collect());
    }
    let mut out = Vec::with_capacity(df.height());
    for i in 0..df.height() {
        if let Ok(any_val) = col.get(i) {
            let s = any_val.to_string().replace('"', "");
            out.push(parse_numeric_cell(&s).unwrap_or(f64::NAN));
        } else {
            out.push(f64::NAN);
        }
    }
    Ok(out)
}

pub fn import_dataset_with_mapping(
    file_path: Option<&Path>,
    raw_bytes: Option<&[u8]>,
    file_name: &str,
    custom_name: Option<&str>,
    mapping: &HashMap<String, String>,
) -> Result<Dataset, PfrsimError> {
    // 1. Verify required columns are mapped
    let wt_col = mapping.get("WT").ok_or_else(|| {
        PfrsimError::validation(
            "MISSING_MAPPING_WT",
            "Water Table (WT) column must be mapped",
            None,
        )
    })?;
    let sm_col = mapping.get("SM").ok_or_else(|| {
        PfrsimError::validation(
            "MISSING_MAPPING_SM",
            "Soil Moisture (SM) column must be mapped",
            None,
        )
    })?;
    let rf_col = mapping.get("Rf").ok_or_else(|| {
        PfrsimError::validation(
            "MISSING_MAPPING_RF",
            "Rainfall (Rf) column must be mapped",
            None,
        )
    })?;
    let temp_col = mapping.get("Temp").ok_or_else(|| {
        PfrsimError::validation(
            "MISSING_MAPPING_TEMP",
            "Temperature (Temp) column must be mapped",
            None,
        )
    })?;
    let time_col = mapping.get("Time");

    let fmt = detect_format(file_name);

    let (wt_vec, sm_vec, rf_vec, temp_vec, time_samples, has_dates, n) =
        if fmt == "parquet" || (fmt == "csv" && file_path.is_some()) {
            let df = if fmt == "parquet" {
                if let Some(p) = file_path {
                    let f = std::fs::File::open(p).map_err(PfrsimError::io)?;
                    ParquetReader::new(f).finish().map_err(|e| {
                        PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None)
                    })?
                } else if let Some(b) = raw_bytes {
                    ParquetReader::new(Cursor::new(b)).finish().map_err(|e| {
                        PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None)
                    })?
                } else {
                    return Err(PfrsimError::validation(
                        "NO_INPUT",
                        "No file path or data provided",
                        None,
                    ));
                }
            } else {
                let p = file_path.unwrap();
                CsvReadOptions::default()
                    .try_into_reader_with_file_path(Some(p.to_path_buf()))
                    .map_err(|e| PfrsimError::validation("CSV_READ_ERROR", e.to_string(), None))?
                    .finish()
                    .map_err(|e| PfrsimError::validation("CSV_READ_ERROR", e.to_string(), None))?
            };

            let height = df.height();
            if height < MIN_CSV_ROWS {
                return Err(PfrsimError::validation(
                    "VALIDATION_TOO_SHORT",
                    format!("Dataset has {height} rows, minimum required is {MIN_CSV_ROWS}"),
                    None,
                ));
            }
            if height > MAX_CSV_ROWS {
                return Err(PfrsimError::validation(
                    "VALIDATION_TOO_LARGE",
                    format!("Dataset has {height} rows, maximum allowed is {MAX_CSV_ROWS}"),
                    None,
                ));
            }

            let wt = extract_f64_from_df(&df, wt_col)?;
            let sm = extract_f64_from_df(&df, sm_col)?;
            let rf = extract_f64_from_df(&df, rf_col)?;
            let temp = extract_f64_from_df(&df, temp_col)?;

            let mut time_samples = HashMap::new();
            let mut dates_found = false;
            if let Some(tc) = time_col {
                if let Ok(col) = df.column(tc) {
                    let head_len = 25.min(height);
                    for idx in 0..head_len {
                        if let Ok(v) = col.get(idx) {
                            let s = v.to_string().replace('"', "").trim().to_string();
                            if !s.is_empty() {
                                dates_found = true;
                                time_samples.insert(idx, s);
                            }
                        }
                    }
                    let tail_start = height.saturating_sub(25);
                    for idx in tail_start..height {
                        if let Ok(v) = col.get(idx) {
                            let s = v.to_string().replace('"', "").trim().to_string();
                            if !s.is_empty() {
                                dates_found = true;
                                time_samples.insert(idx, s);
                            }
                        }
                    }
                }
            }
            (wt, sm, rf, temp, time_samples, dates_found, height)
        } else if fmt == "excel" {
            let bytes = if let Some(p) = file_path {
                std::fs::read(p).map_err(PfrsimError::io)?
            } else if let Some(b) = raw_bytes {
                b.to_vec()
            } else {
                return Err(PfrsimError::validation(
                    "NO_INPUT",
                    "No file path or data provided",
                    None,
                ));
            };

            let mut workbook = open_workbook_auto_from_rs(Cursor::new(&bytes))
                .map_err(|e| PfrsimError::validation("EXCEL_OPEN_ERROR", e.to_string(), None))?;

            let sheet_names = workbook.sheet_names().to_vec();
            let first_sheet = sheet_names.first().ok_or_else(|| {
                PfrsimError::validation("EXCEL_NO_SHEET", "Excel workbook contains no sheets", None)
            })?;

            let range = workbook
                .worksheet_range(first_sheet)
                .map_err(|e| PfrsimError::validation("EXCEL_SHEET_ERROR", e.to_string(), None))?;

            let (height, width) = range.get_size();
            if height <= 1 {
                return Err(PfrsimError::validation(
                    "EMPTY_EXCEL",
                    "Excel sheet has no data rows",
                    None,
                ));
            }

            let mut headers = Vec::new();
            for col in 0..width {
                let val = range
                    .get((0, col))
                    .map(|d| d.to_string())
                    .unwrap_or_default();
                headers.push(val.trim().to_string());
            }

            let wt_idx = headers.iter().position(|h| h == wt_col).ok_or_else(|| {
                PfrsimError::validation(
                    "COLUMN_NOT_FOUND",
                    format!("Column '{wt_col}' not found in Excel sheet"),
                    None,
                )
            })?;
            let sm_idx = headers.iter().position(|h| h == sm_col).ok_or_else(|| {
                PfrsimError::validation(
                    "COLUMN_NOT_FOUND",
                    format!("Column '{sm_col}' not found in Excel sheet"),
                    None,
                )
            })?;
            let rf_idx = headers.iter().position(|h| h == rf_col).ok_or_else(|| {
                PfrsimError::validation(
                    "COLUMN_NOT_FOUND",
                    format!("Column '{rf_col}' not found in Excel sheet"),
                    None,
                )
            })?;
            let temp_idx = headers.iter().position(|h| h == temp_col).ok_or_else(|| {
                PfrsimError::validation(
                    "COLUMN_NOT_FOUND",
                    format!("Column '{temp_col}' not found in Excel sheet"),
                    None,
                )
            })?;
            let time_idx = time_col.and_then(|tc| headers.iter().position(|h| h == tc));

            let n = height - 1;
            let mut wt = Vec::with_capacity(n);
            let mut sm = Vec::with_capacity(n);
            let mut rf = Vec::with_capacity(n);
            let mut temp = Vec::with_capacity(n);
            let mut time_samples = HashMap::new();
            let mut dates_found = false;

            for row_idx in 1..height {
                let get_f64 = |c: usize| -> f64 {
                    range
                        .get((row_idx, c))
                        .map(|d| parse_numeric_cell(&d.to_string()).unwrap_or(f64::NAN))
                        .unwrap_or(f64::NAN)
                };
                wt.push(get_f64(wt_idx));
                sm.push(get_f64(sm_idx));
                rf.push(get_f64(rf_idx));
                temp.push(get_f64(temp_idx));

                let sample_idx = row_idx - 1;
                if sample_idx < 25 || sample_idx >= n.saturating_sub(25) {
                    if let Some(t_col) = time_idx {
                        if let Some(d) = range.get((row_idx, t_col)) {
                            let s = d.to_string().trim().to_string();
                            if !s.is_empty() {
                                dates_found = true;
                                time_samples.insert(sample_idx, s);
                            }
                        }
                    }
                }
            }
            (wt, sm, rf, temp, time_samples, dates_found, n)
        } else {
            let bytes = raw_bytes.ok_or_else(|| {
                PfrsimError::validation("NO_INPUT", "No file path or data provided", None)
            })?;
            let text = String::from_utf8_lossy(bytes);
            let mut rdr = csv::ReaderBuilder::new()
                .has_headers(true)
                .flexible(true)
                .from_reader(text.as_bytes());

            let headers = rdr
                .headers()
                .map_err(|e| PfrsimError::validation("CSV_HEADER_ERROR", e.to_string(), None))?
                .clone();
            let header_names: Vec<String> = headers.iter().map(|s| s.trim().to_string()).collect();

            let wt_idx = header_names
                .iter()
                .position(|h| h == wt_col)
                .ok_or_else(|| {
                    PfrsimError::validation(
                        "COLUMN_NOT_FOUND",
                        format!("Column '{wt_col}' not found in CSV"),
                        None,
                    )
                })?;
            let sm_idx = header_names
                .iter()
                .position(|h| h == sm_col)
                .ok_or_else(|| {
                    PfrsimError::validation(
                        "COLUMN_NOT_FOUND",
                        format!("Column '{sm_col}' not found in CSV"),
                        None,
                    )
                })?;
            let rf_idx = header_names
                .iter()
                .position(|h| h == rf_col)
                .ok_or_else(|| {
                    PfrsimError::validation(
                        "COLUMN_NOT_FOUND",
                        format!("Column '{rf_col}' not found in CSV"),
                        None,
                    )
                })?;
            let temp_idx = header_names
                .iter()
                .position(|h| h == temp_col)
                .ok_or_else(|| {
                    PfrsimError::validation(
                        "COLUMN_NOT_FOUND",
                        format!("Column '{temp_col}' not found in CSV"),
                        None,
                    )
                })?;
            let time_idx = time_col.and_then(|tc| header_names.iter().position(|h| h == tc));

            let mut wt = Vec::new();
            let mut sm = Vec::new();
            let mut rf = Vec::new();
            let mut temp = Vec::new();
            let mut time_samples = HashMap::new();
            let mut dates_found = false;

            for (idx, result) in rdr.records().enumerate() {
                if let Ok(rec) = result {
                    let get_val = |c: usize| -> f64 {
                        rec.get(c)
                            .map(parse_numeric_cell)
                            .and_then(Result::ok)
                            .unwrap_or(f64::NAN)
                    };
                    wt.push(get_val(wt_idx));
                    sm.push(get_val(sm_idx));
                    rf.push(get_val(rf_idx));
                    temp.push(get_val(temp_idx));

                    if idx < 25 {
                        if let Some(tc) = time_idx {
                            if let Some(val) = rec.get(tc) {
                                let s = val.trim().to_string();
                                if !s.is_empty() {
                                    dates_found = true;
                                    time_samples.insert(idx, s);
                                }
                            }
                        }
                    }
                }
            }
            let total = wt.len();
            (wt, sm, rf, temp, time_samples, dates_found, total)
        };

    let warnings = Vec::new();
    let all_wt_nan = wt_vec.iter().all(|v| v.is_nan());
    let all_sm_nan = sm_vec.iter().all(|v| v.is_nan());
    let all_rf_nan = rf_vec.iter().all(|v| v.is_nan());
    let all_temp_nan = temp_vec.iter().all(|v| v.is_nan());

    if all_wt_nan || all_sm_nan || all_rf_nan || all_temp_nan {
        return Err(PfrsimError::validation(
            "ALL_VALUES_MISSING",
            "At least one mapped column contains 100% missing values.",
            None,
        ));
    }

    let stats = ColumnStats {
        wt: compute_stats(&wt_vec),
        sm: compute_stats(&sm_vec),
        rf: compute_stats(&rf_vec),
        temp: compute_stats(&temp_vec),
    };

    let wt_missing = compute_missing(&wt_vec);
    let sm_missing = compute_missing(&sm_vec);
    let rf_missing = compute_missing(&rf_vec);
    let temp_missing = compute_missing(&temp_vec);

    let missing = MissingInfo {
        total: wt_missing.count + sm_missing.count + rf_missing.count + temp_missing.count,
        wt: wt_missing,
        sm: sm_missing,
        rf: rf_missing,
        temp: temp_missing,
    };

    let mut head = Vec::new();
    let head_count = std::cmp::min(25, n);
    for idx in 0..head_count {
        let t_label = time_samples
            .get(&idx)
            .cloned()
            .unwrap_or_else(|| (idx + 1).to_string());
        head.push(RowPreview {
            t: idx + 1,
            time_label: Some(t_label),
            wt: if wt_vec[idx].is_nan() {
                None
            } else {
                Some(wt_vec[idx])
            },
            sm: if sm_vec[idx].is_nan() {
                None
            } else {
                Some(sm_vec[idx])
            },
            rf: if rf_vec[idx].is_nan() {
                None
            } else {
                Some(rf_vec[idx])
            },
            temp: if temp_vec[idx].is_nan() {
                None
            } else {
                Some(temp_vec[idx])
            },
        });
    }

    let mut tail = Vec::new();
    let tail_count = std::cmp::min(25, n);
    for idx in (n - tail_count)..n {
        let t_label = time_samples
            .get(&idx)
            .cloned()
            .unwrap_or_else(|| (idx + 1).to_string());
        tail.push(RowPreview {
            t: idx + 1,
            time_label: Some(t_label),
            wt: if wt_vec[idx].is_nan() {
                None
            } else {
                Some(wt_vec[idx])
            },
            sm: if sm_vec[idx].is_nan() {
                None
            } else {
                Some(sm_vec[idx])
            },
            rf: if rf_vec[idx].is_nan() {
                None
            } else {
                Some(rf_vec[idx])
            },
            temp: if temp_vec[idx].is_nan() {
                None
            } else {
                Some(temp_vec[idx])
            },
        });
    }

    let verdict = ValidationVerdict {
        is_valid: true,
        errors: Vec::new(),
        warnings,
    };

    let preview = DatasetPreview {
        stats: stats.clone(),
        missing: missing.clone(),
        head,
        tail,
        verdict,
    };

    let mut hasher = Sha256::new();
    hasher.update(file_name.as_bytes());
    for v in &wt_vec {
        hasher.update(&v.to_le_bytes());
    }
    for v in &sm_vec {
        hasher.update(&v.to_le_bytes());
    }
    for v in &rf_vec {
        hasher.update(&v.to_le_bytes());
    }
    for v in &temp_vec {
        hasher.update(&v.to_le_bytes());
    }
    let csv_sha = hex::encode(hasher.finalize());
    let dataset_id = format!("ds-{}", &csv_sha[..12]);

    let final_name = if let Some(n) = custom_name.filter(|s| !s.trim().is_empty()) {
        n.trim().to_string()
    } else {
        let clean_base = std::path::Path::new(file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(file_name);
        format!("{clean_base} ({})", &csv_sha[..6])
    };

    Ok(Dataset {
        dataset_id,
        name: final_name,
        csv_sha,
        n,
        time_kind: if has_dates {
            TimeKind::Date
        } else {
            TimeKind::Index
        },
        time_labels: None,
        columns: ColumnData {
            wt: wt_vec,
            sm: sm_vec,
            rf: rf_vec,
            temp: temp_vec,
        },
        missing,
        stats,
        preview,
    })
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stl_decomposition_additive_identity_and_period() {
        // y = season-6 sine (amp 2, zero trend) over 8 cycles, n=48.
        let valid: Vec<f64> = (0..48)
            .map(|i| 2.0 * (2.0 * std::f64::consts::PI * i as f64 / 6.0).sin())
            .collect();
        let d = compute_decomposition(&valid, &valid).expect("season-6 must decompose");
        assert_eq!(d.period, 6);
        assert_eq!(d.trend.len(), 48);
        assert_eq!(d.seasonal.len(), 48);
        assert_eq!(d.remainder.len(), 48);
        // Interior identity valid = trend + seasonal + remainder.
        let mut checked = 0;
        for i in 0..48 {
            if let (Some(t), Some(r)) = (d.trend[i], d.remainder[i]) {
                assert!(
                    (valid[i] - t - d.seasonal[i] - r).abs() < 1e-9,
                    "identity at {i}"
                );
                checked += 1;
            }
        }
        assert!(checked > 30, "most interior points defined");
        // Seasonal profile must be ~zero-mean (level kept in trend).
        let m: f64 = d.seasonal.iter().sum::<f64>() / d.seasonal.len() as f64;
        assert!(m.abs() < 0.15, "seasonal mean {m}");
        // Seasonal amplitude should recover ~2.
        let amp = d.seasonal.iter().fold(0.0f64, |a, v| a.max(v.abs()));
        assert!((amp - 2.0).abs() < 0.35, "seasonal amp {amp}");
    }

    #[test]
    fn test_stl_decomposition_none_without_seasonality() {
        // Monotone decay has no seasonal peak -> None, never partial data.
        let ar: Vec<f64> = (0..48).map(|i| 0.9_f64.powi(i as i32)).collect();
        assert!(compute_decomposition(&ar, &ar).is_none());
        // Too short -> None.
        assert!(compute_decomposition(&[1.0, 2.0, 3.0], &[1.0, 2.0, 3.0]).is_none());
    }

    #[test]
    fn test_stl_decomposition_preserves_nan_positions() {
        // Season-6 sine with two NaN gaps: decomposition must exist, keep
        // row alignment (len 48), and carry None at exactly the gap rows.
        let mut raw: Vec<f64> = (0..48)
            .map(|i| 2.0 * (2.0 * std::f64::consts::PI * i as f64 / 6.0).sin())
            .collect();
        raw[10] = f64::NAN;
        raw[30] = f64::NAN;
        let valid: Vec<f64> = raw.iter().copied().filter(|v| !v.is_nan()).collect();
        let d = compute_decomposition(&valid, &raw).expect("gapped series decomposes");
        assert_eq!(d.period, 6);
        assert_eq!(d.trend.len(), 48);
        assert_eq!(d.seasonal.len(), 48);
        assert_eq!(d.remainder.len(), 48);
        for &gap in &[10usize, 30usize] {
            assert!(d.trend[gap].is_none(), "trend gap at {gap}");
            assert!(d.remainder[gap].is_none(), "remainder gap at {gap}");
        }
        // Additive identity holds wherever all three components defined.
        let mut checked = 0;
        for i in 0..48 {
            if raw[i].is_nan() {
                continue;
            }
            if let (Some(t), Some(r)) = (d.trend[i], d.remainder[i]) {
                assert!(
                    (raw[i] - t - d.seasonal[i] - r).abs() < 1e-9,
                    "identity at {i}"
                );
                checked += 1;
            }
        }
        assert!(checked > 20, "enough interior points, got {checked}");
    }

    #[test]
    fn test_import_dataset_with_custom_and_unique_name() {
        let csv = "WT,SM,Rf,Temp\n-1.0,35.0,0.0,30.0\n-1.1,35.1,0.0,30.1\n-1.2,35.2,0.0,30.2\n-1.3,35.3,0.0,30.3\n-1.4,35.4,0.0,30.4\n-1.5,35.5,0.0,30.5\n-1.6,35.6,0.0,30.6\n-1.7,35.7,0.0,30.7";
        let mut mapping = HashMap::new();
        mapping.insert("WT".to_string(), "WT".to_string());
        mapping.insert("SM".to_string(), "SM".to_string());
        mapping.insert("Rf".to_string(), "Rf".to_string());
        mapping.insert("Temp".to_string(), "Temp".to_string());

        // 1. With custom name
        let ds_custom = import_dataset_with_mapping(
            None,
            Some(csv.as_bytes()),
            "my_file.csv",
            Some("Peatland Project Alpha"),
            &mapping,
        )
        .expect("import should succeed");
        assert_eq!(ds_custom.name, "Peatland Project Alpha");

        // 2. Without custom name -> unique generated name
        let ds_auto =
            import_dataset_with_mapping(None, Some(csv.as_bytes()), "my_file.csv", None, &mapping)
                .expect("import should succeed");
        assert!(ds_auto.name.starts_with("my_file ("));
        assert_eq!(ds_auto.name.len(), "my_file (".len() + 6 + 1);
    }

    #[test]
    fn test_parse_example8() {
        let csv = r#"WT,SM,Rf,Temp
-1.021,35.424,0.00012,35.4
-0.972,NA,0.00024,35.8
NA,37.268,0.00011,NA
-1.204,38.453,NA,36.5
-0.906,31.456,NA,36.3
-0.993,33.235,0.00046,37.2
-1.327,30.168,0.00052,37.0
-2.001,30.212,0.00041,38.1"#;

        let ds = parse_csv(csv, "example8.csv").expect("parsing example8 should succeed");
        assert_eq!(ds.n, 8);
        assert_eq!(ds.missing.wt.count, 1);
        assert_eq!(ds.missing.sm.count, 1);
        assert_eq!(ds.missing.rf.count, 2);
        assert_eq!(ds.missing.temp.count, 1);
        assert_eq!(ds.missing.total, 5);
        assert!(ds.preview.verdict.is_valid);
        assert_eq!(ds.preview.head.len(), 8);
    }
    #[test]
    fn test_seasonal_passed_sample_fixture() {
        let csv = include_str!("../../../fixtures/seasonal_passed_sample.csv");
        let inspection =
            inspect_dataset_file(None, Some(csv.as_bytes()), "seasonal_passed_sample.csv")
                .expect("inspection must succeed");
        assert_eq!(inspection.row_count_estimate, 120);
        assert!(inspection.suggested_mapping.contains_key("WT"));
        assert!(inspection.suggested_mapping.contains_key("SM"));
        assert!(inspection.suggested_mapping.contains_key("Rf"));
        assert!(inspection.suggested_mapping.contains_key("Temp"));

        let ds = import_dataset_with_mapping(
            None,
            Some(csv.as_bytes()),
            "seasonal_passed_sample.csv",
            Some("Seasonal Passed Sample"),
            &inspection.suggested_mapping,
        )
        .expect("import must succeed");

        assert_eq!(ds.n, 120);

        // Verify all 4 variables pass the seasonality gate (period = 12)
        let rf_seas = ds.stats.rf.as_ref().unwrap().seasonality.as_ref().unwrap();
        assert!(rf_seas.seasonal, "Rf must be seasonal");
        assert_eq!(rf_seas.period, Some(12));
        assert!(rf_seas.strength >= 0.50);
        assert!(
            ds.stats.rf.as_ref().unwrap().decomposition.is_some(),
            "Rf STL decomposition must be computed"
        );

        let wt_seas = ds.stats.wt.as_ref().unwrap().seasonality.as_ref().unwrap();
        assert!(wt_seas.seasonal, "WT must be seasonal");
        assert_eq!(wt_seas.period, Some(12));
        assert!(wt_seas.strength >= 0.50);
        assert!(
            ds.stats.wt.as_ref().unwrap().decomposition.is_some(),
            "WT STL decomposition must be computed"
        );

        let sm_seas = ds.stats.sm.as_ref().unwrap().seasonality.as_ref().unwrap();
        assert!(sm_seas.seasonal, "SM must be seasonal");
        assert_eq!(sm_seas.period, Some(12));
        assert!(sm_seas.strength >= 0.50);
        assert!(
            ds.stats.sm.as_ref().unwrap().decomposition.is_some(),
            "SM STL decomposition must be computed"
        );

        let temp_seas = ds
            .stats
            .temp
            .as_ref()
            .unwrap()
            .seasonality
            .as_ref()
            .unwrap();
        assert!(temp_seas.seasonal, "Temp must be seasonal");
        assert_eq!(temp_seas.period, Some(12));
        assert!(temp_seas.strength >= 0.50);
        assert!(
            ds.stats.temp.as_ref().unwrap().decomposition.is_some(),
            "Temp STL decomposition must be computed"
        );

        // Also generate and verify .parquet fixture
        use polars::prelude::*;
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let csv_path = manifest_dir.join("../../fixtures/seasonal_passed_sample.csv");
        let pq_path = manifest_dir.join("../../fixtures/seasonal_passed_sample.parquet");

        let mut df = CsvReadOptions::default()
            .try_into_reader_with_file_path(Some(csv_path))
            .expect("csv reader")
            .finish()
            .expect("read df");
        let mut pq_file = std::fs::File::create(&pq_path).expect("create pq");
        ParquetWriter::new(&mut pq_file)
            .finish(&mut df)
            .expect("write pq");

        let pq_bytes = std::fs::read(&pq_path).expect("read pq");
        let pq_insp = inspect_dataset_file(None, Some(&pq_bytes), "seasonal_passed_sample.parquet")
            .expect("inspect pq");
        assert_eq!(pq_insp.row_count_estimate, 120);
        let pq_ds = import_dataset_with_mapping(
            None,
            Some(&pq_bytes),
            "seasonal_passed_sample.parquet",
            None,
            &pq_insp.suggested_mapping,
        )
        .expect("import pq");
        assert!(pq_ds.stats.rf.unwrap().decomposition.is_some());
        assert!(pq_ds.stats.wt.unwrap().decomposition.is_some());
        assert!(pq_ds.stats.sm.unwrap().decomposition.is_some());
        assert!(pq_ds.stats.temp.unwrap().decomposition.is_some());
    }
    #[test]
    fn test_autocorrelation_acf_and_pacf() {
        // Sine wave of period 12, length 48
        let series: Vec<f64> = (0..48)
            .map(|i| (2.0 * std::f64::consts::PI * i as f64 / 12.0).sin())
            .collect();
        let acf_pacf =
            compute_autocorrelation(&series, Some(24)).expect("autocorrelation must compute");
        assert_eq!(acf_pacf.max_lag, 24);
        assert_eq!(acf_pacf.acf.len(), 25);
        assert_eq!(acf_pacf.pacf.len(), 25);
        assert_eq!(acf_pacf.acf[0], 1.0);
        assert_eq!(acf_pacf.pacf[0], 1.0);
        // Period 12 sine (N=48): lag 12 ACF scales by (N-k)/N = 36/48 = 0.75
        assert!(
            acf_pacf.acf[12] > 0.70,
            "lag 12 ACF should be positive peak"
        );
        assert!(
            acf_pacf.acf[6] < -0.70,
            "lag 6 ACF should be negative valley"
        );
        // 95% confidence band for N=48 is 1.96 / sqrt(48) ~= 0.283
        assert!((acf_pacf.confidence_band - 1.96 / (48.0_f64).sqrt()).abs() < 1e-6);
    }
    #[test]
    fn test_lttb_downsampling_preserves_extrema_and_length() {
        let n = 1000;
        let mut x = Vec::with_capacity(n);
        let mut y = Vec::with_capacity(n);
        for i in 0..n {
            x.push(i as f64);
            let val = if i == 500 {
                100.0
            } else if i == 250 {
                -50.0
            } else {
                (i as f64 * 0.05).sin()
            };
            y.push(Some(val));
        }

        let threshold = 50;
        let (down_x, down_y) = lttb_downsample(&x, &y, threshold);
        assert_eq!(down_x.len(), threshold);
        assert_eq!(down_y.len(), threshold);

        assert_eq!(down_x[0], 0.0);
        assert_eq!(down_x[threshold - 1], (n - 1) as f64);

        let max_val = down_y
            .iter()
            .filter_map(|&v| v)
            .fold(f64::NEG_INFINITY, f64::max);
        let min_val = down_y
            .iter()
            .filter_map(|&v| v)
            .fold(f64::INFINITY, f64::min);
        assert_eq!(max_val, 100.0, "LTTB must preserve sharp peak");
        assert_eq!(min_val, -50.0, "LTTB must preserve sharp trough");

        let (same_x, same_y) = lttb_downsample(&down_x, &down_y, 100);
        assert_eq!(same_x.len(), threshold);
        assert_eq!(same_y.len(), threshold);
    }

    #[test]
    fn test_validation_missing_column() {
        let csv = "WT,SM,Rf\n1,2,3";
        let err = parse_csv(csv, "bad.csv").unwrap_err();
        assert_eq!(err.code(), "VALIDATION_MISSING_COLUMN");
    }

    #[test]
    fn test_column_data_nan_roundtrip() {
        let cols = ColumnData {
            wt: vec![-1.021, -0.972, f64::NAN, -1.204],
            sm: vec![f64::NAN, 35.0],
            rf: vec![0.001, f64::NAN],
            temp: vec![35.0, 36.0],
        };
        let json = serde_json::to_string(&cols).expect("serialize with NaN");
        assert!(json.contains("null"), "f64::NAN must serialize as null");
        let parsed: ColumnData = serde_json::from_str(&json).expect("deserialize null into NaN");
        assert_eq!(parsed.wt[0], -1.021);
        assert!(parsed.wt[2].is_nan());
        assert!(parsed.sm[0].is_nan());
        assert_eq!(parsed.sm[1], 35.0);
    }

    #[test]
    fn test_parse_sabangau_sample() {
        let csv = include_str!("../../../fixtures/sabangau_sample.csv");
        let ds = parse_csv(csv, "Sabangau 192-day")
            .expect("parsing full sabangau sample should succeed");
        assert_eq!(ds.n, 192);
        assert!(ds.preview.verdict.is_valid);
        assert_eq!(ds.preview.head.len(), 25);
        assert_eq!(ds.preview.tail.len(), 25);
        assert!(ds.columns.wt[0] < 0.0); // e.g. -0.4335
        assert!(ds.columns.temp[0] > 20.0); // e.g. 30.9
        assert!(ds.missing.wt.count > 0); // has gaps around days 114-116
    }
    #[test]
    fn test_inspect_sabangau_parquet() {
        let path = std::path::Path::new("../../fixtures/sabangau_sample.parquet");
        if path.exists() {
            let insp = inspect_dataset_file(Some(path), None, "sabangau_sample.parquet")
                .expect("inspect parquet should succeed");
            assert_eq!(insp.format, "parquet");
            assert_eq!(insp.row_count_estimate, 192);
            assert!(insp.detected_columns.contains(&"Temperature".to_string()));
            assert!(insp.detected_columns.contains(&"Water Table".to_string()));
        }
    }

    #[test]
    fn test_inspect_sabangau_excel() {
        let path = std::path::Path::new("../../fixtures/sabangau_sample.xlsx");
        if path.exists() {
            let insp = inspect_dataset_file(Some(path), None, "sabangau_sample.xlsx")
                .expect("inspect excel should succeed");
            assert_eq!(insp.format, "excel");
            assert_eq!(insp.row_count_estimate, 192);
            assert!(insp.detected_columns.contains(&"Temperature".to_string()));
            assert!(insp.detected_columns.contains(&"Water Table".to_string()));
        }
    }
    #[test]
    fn test_validation_too_short() {
        let csv = "WT,SM,Rf,Temp\n1,2,3,4\n5,6,7,8";
        let err = parse_csv(csv, "short.csv").unwrap_err();
        assert_eq!(err.code(), "VALIDATION_TOO_SHORT");
    }

    #[test]
    fn test_trend_direction_rising_falling_flat() {
        let rising: Vec<f64> = (0..30).map(|i| i as f64 * 0.5).collect();
        let t = compute_trend(&rising, rising.iter().sum::<f64>() / rising.len() as f64)
            .expect("trend computable");
        assert_eq!(t.direction, TrendDirection::Rising);
        assert!((t.slope - 0.5).abs() < 1e-9);

        let falling: Vec<f64> = (0..30).map(|i| 10.0 - i as f64 * 0.25).collect();
        let t = compute_trend(&falling, falling.iter().sum::<f64>() / falling.len() as f64)
            .expect("trend computable");
        assert_eq!(t.direction, TrendDirection::Falling);

        // Alternating series has no significant drift -> Flat.
        let flat: Vec<f64> = (0..30)
            .map(|i| if i % 2 == 0 { 1.0 } else { -1.0 })
            .collect();
        let t = compute_trend(&flat, 0.0).expect("trend computable");
        assert_eq!(t.direction, TrendDirection::Flat);

        // Too short -> None.
        assert!(compute_trend(&[1.0, 2.0], 1.5).is_none());
    }

    #[test]
    fn test_seasonality_detects_cycle_and_rejects_noise() {
        // Season-12 sine wave over 4 full cycles -> seasonal with period 12.
        let seasonal: Vec<f64> = (0..48)
            .map(|i| (2.0 * std::f64::consts::PI * i as f64 / 12.0).sin())
            .collect();
        let mean = seasonal.iter().sum::<f64>() / seasonal.len() as f64;
        let s = compute_seasonality(&seasonal, mean).expect("seasonality computable");
        assert!(s.seasonal);
        assert_eq!(s.period, Some(12));
        assert!(s.strength > 0.8);

        // Alternating +-1 has its strongest positive peak at lag 2 -> seasonal.
        let alt: Vec<f64> = (0..48)
            .map(|i| if i % 2 == 0 { 1.0 } else { -1.0 })
            .collect();
        let mean = alt.iter().sum::<f64>() / alt.len() as f64;
        let s = compute_seasonality(&alt, mean).expect("seasonality computable");
        assert!(s.seasonal);
        assert_eq!(s.period, Some(2));

        // Monotone AR(1)-like decay handled without panicking and must not
        // report a cycle: no interior local maximum exists.
        let ar: Vec<f64> = (0..48).map(|i| 0.9_f64.powi(i as i32)).collect();
        let mean = ar.iter().sum::<f64>() / ar.len() as f64;
        let s = compute_seasonality(&ar, mean).expect("seasonality computable");
        assert!(!s.seasonal);
        assert_eq!(s.period, None);
    }

    #[test]
    fn test_stationarity_flags_shifted_and_stable_series() {
        // Stable oscillation -> stationary.
        let stable: Vec<f64> = (0..40).map(|i| (i % 4) as f64 - 1.5).collect();
        let mean = stable.iter().sum::<f64>() / stable.len() as f64;
        let s = compute_stationarity(&stable, mean, true).expect("stationarity computable");
        assert!(s.stationary);

        // Level shift halfway with small within-half noise: the standardized
        // mean shift is huge, so non-stationary.
        let mut shifted: Vec<f64> = Vec::with_capacity(40);
        for i in 0..40 {
            let base = if i < 20 { 0.0 } else { 5.0 };
            let jitter = ((i * 7919) % 97) as f64 / 97.0 * 0.02 - 0.01;
            shifted.push(base + jitter);
        }
        let mean = shifted.iter().sum::<f64>() / shifted.len() as f64;
        let s = compute_stationarity(&shifted, mean, false).expect("stationarity computable");
        assert!(!s.stationary);
        assert!(s.mean_shift > 1.0);

        // Rising trend alone vetoes stationarity even when halves look alike.
        let rising: Vec<f64> = (0..40).map(|i| i as f64).collect();
        let mean = rising.iter().sum::<f64>() / rising.len() as f64;
        let s = compute_stationarity(&rising, mean, false).expect("stationarity computable");
        assert!(!s.stationary);
    }
}
