use crate::error::PfrsimError;
use crate::imputer::{ImputeFlags, ImputeMask, ImputeResult, Imputer, ImputerConfig};
use crate::ingest::ColumnData;

pub struct LoessImputer;

fn interpolate_loess(series: &[f64], span: f64) -> (Vec<f64>, Vec<bool>) {
    let n = series.len();
    let mut out = series.to_vec();
    let mut mask = vec![false; n];

    let mut obs: Vec<(f64, f64)> = Vec::new();
    for (i, &v) in series.iter().enumerate() {
        if !v.is_nan() {
            obs.push((i as f64, v));
        }
    }

    let n_obs = obs.len();
    if n_obs < 2 {
        return (out, mask);
    }

    let q = ((span * n_obs as f64).round() as usize).clamp(2, n_obs);
    let effective_q = q.min(1000);
    for i in 0..n {
        if series[i].is_nan() {
            let x_q = i as f64;

            // Since obs is sorted by x, binary search finds the closest index in O(log N)
            let center = match obs.binary_search_by(|&(x, _)| {
                x.partial_cmp(&x_q).unwrap_or(std::cmp::Ordering::Equal)
            }) {
                Ok(idx) => idx,
                Err(idx) => idx,
            };
            let half = effective_q / 2;
            let start = center
                .saturating_sub(half)
                .min(n_obs.saturating_sub(effective_q));
            let end = (start + effective_q).min(n_obs);
            let k_neighbors = &obs[start..end];

            let raw_d_max = k_neighbors
                .iter()
                .map(|&(x, _)| (x - x_q).abs())
                .fold(0.0f64, f64::max);
            let d_max = if raw_d_max == 0.0 {
                1.0
            } else {
                raw_d_max * 1.000001
            };

            let mut sum_w = 0.0;
            let mut sum_wx = 0.0;
            let mut sum_wx2 = 0.0;
            let mut sum_wy = 0.0;
            let mut sum_wxy = 0.0;

            for &(x, y) in k_neighbors {
                let dist = (x - x_q).abs();
                let u = dist / d_max;
                let w = if u < 1.0 {
                    let tmp = 1.0 - u * u * u;
                    tmp * tmp * tmp
                } else {
                    0.0
                };

                let dx = x - x_q;

                sum_w += w;
                sum_wx += w * dx;
                sum_wx2 += w * dx * dx;
                sum_wy += w * y;
                sum_wxy += w * dx * y;
            }

            let det = sum_w * sum_wx2 - sum_wx * sum_wx;
            let pred = if det.abs() > 1e-12 {
                // beta0 is the value at dx = 0 (i.e. x = x_q)
                (sum_wy * sum_wx2 - sum_wx * sum_wxy) / det
            } else if sum_w > 0.0 {
                sum_wy / sum_w
            } else {
                obs[0].1
            };

            out[i] = pred;
            mask[i] = true;
        }
    }

    (out, mask)
}

impl Imputer for LoessImputer {
    fn id(&self) -> &'static str {
        "loess"
    }

    fn impute(
        &self,
        columns: &ColumnData,
        config: &ImputerConfig,
        _seed: u64,
    ) -> Result<ImputeResult, PfrsimError> {
        let span = config.span.clamp(0.05, 1.0);

        let (wt_imp, wt_mask) = interpolate_loess(&columns.wt, span);
        let (sm_imp, sm_mask) = interpolate_loess(&columns.sm, span);
        let (rf_imp, rf_mask) = interpolate_loess(&columns.rf, span);
        let (temp_imp, temp_mask) = interpolate_loess(&columns.temp, span);

        let n_imputed = wt_mask.iter().filter(|&&m| m).count()
            + sm_mask.iter().filter(|&&m| m).count()
            + rf_mask.iter().filter(|&&m| m).count()
            + temp_mask.iter().filter(|&&m| m).count();

        let total_cells = columns.wt.len() * 4;
        let frac_imputed = if total_cells > 0 {
            n_imputed as f64 / total_cells as f64
        } else {
            0.0
        };

        Ok(ImputeResult {
            imputer_id: "loess".to_string(),
            imputed: ColumnData {
                wt: wt_imp,
                sm: sm_imp,
                rf: rf_imp,
                temp: temp_imp,
            },
            mask: ImputeMask {
                wt: wt_mask,
                sm: sm_mask,
                rf: rf_mask,
                temp: temp_mask,
            },
            flags: ImputeFlags {
                edge_na: false,
                overshoot: false,
                sparse_abort: false,
                warnings: Vec::new(),
            },
            n_imputed,
            frac_imputed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_loess_interpolation() {
        let s = vec![1.0, f64::NAN, 3.0, 4.0, f64::NAN, 6.0];
        let (out, mask) = interpolate_loess(&s, 0.5);
        assert!(mask[1]);
        assert!(mask[4]);
        assert!((out[1] - 2.0).abs() < 0.5);
        assert!((out[4] - 5.0).abs() < 0.5);
    }
}
