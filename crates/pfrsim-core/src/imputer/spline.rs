use crate::error::PfrsimError;
use crate::imputer::{ImputeFlags, ImputeMask, ImputeResult, Imputer, ImputerConfig};
use crate::ingest::ColumnData;

pub struct SplineImputer;

/// Natural cubic spline fit
struct NaturalSpline {
    x: Vec<f64>,
    a: Vec<f64>,
    b: Vec<f64>,
    c: Vec<f64>,
    d: Vec<f64>,
}

impl NaturalSpline {
    fn fit(x: &[f64], y: &[f64]) -> Option<Self> {
        let n = x.len();
        if n < 2 {
            return None;
        }

        if n == 2 {
            // Linear fit between 2 points
            let slope = (y[1] - y[0]) / (x[1] - x[0]);
            return Some(Self {
                x: x.to_vec(),
                a: vec![y[0], y[1]],
                b: vec![slope, slope],
                c: vec![0.0, 0.0],
                d: vec![0.0, 0.0],
            });
        }

        let mut h = vec![0.0; n - 1];
        for i in 0..n - 1 {
            h[i] = x[i + 1] - x[i];
            if h[i] <= 0.0 {
                return None; // Must be strictly increasing
            }
        }

        let mut alpha = vec![0.0; n - 1];
        for i in 1..n - 1 {
            alpha[i] = (3.0 / h[i]) * (y[i + 1] - y[i]) - (3.0 / h[i - 1]) * (y[i] - y[i - 1]);
        }

        let mut l = vec![0.0; n];
        let mut mu = vec![0.0; n];
        let mut z = vec![0.0; n];
        l[0] = 1.0;

        for i in 1..n - 1 {
            l[i] = 2.0 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
            mu[i] = h[i] / l[i];
            z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
        }

        l[n - 1] = 1.0;
        let mut c = vec![0.0; n];
        let mut b = vec![0.0; n];
        let mut d = vec![0.0; n];

        for j in (0..n - 1).rev() {
            c[j] = z[j] - mu[j] * c[j + 1];
            b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2.0 * c[j]) / 3.0;
            d[j] = (c[j + 1] - c[j]) / (3.0 * h[j]);
        }

        Some(Self {
            x: x.to_vec(),
            a: y.to_vec(),
            b,
            c,
            d,
        })
    }

    fn eval(&self, q: f64) -> f64 {
        let n = self.x.len();
        if q <= self.x[0] {
            // Extrapolate linearly from first segment
            return self.a[0] + self.b[0] * (q - self.x[0]);
        }
        if q >= self.x[n - 1] {
            // Extrapolate linearly from last segment
            let last_idx = n - 2;
            let dx = self.x[n - 1] - self.x[last_idx];
            let slope =
                self.b[last_idx] + 2.0 * self.c[last_idx] * dx + 3.0 * self.d[last_idx] * dx * dx;
            return self.a[n - 1] + slope * (q - self.x[n - 1]);
        }

        // Find interval via binary search in O(log N)
        let i = match self
            .x
            .binary_search_by(|val| val.partial_cmp(&q).unwrap_or(std::cmp::Ordering::Equal))
        {
            Ok(idx) => idx.min(n - 2),
            Err(idx) => idx.saturating_sub(1).min(n - 2),
        };

        let dx = q - self.x[i];
        self.a[i] + self.b[i] * dx + self.c[i] * dx * dx + self.d[i] * dx * dx * dx
    }
}

fn interpolate_spline(series: &[f64]) -> (Vec<f64>, Vec<bool>) {
    let n = series.len();
    let mut out = series.to_vec();
    let mut mask = vec![false; n];

    let mut obs_x = Vec::new();
    let mut obs_y = Vec::new();

    for (i, &v) in series.iter().enumerate() {
        if !v.is_nan() {
            obs_x.push(i as f64);
            obs_y.push(v);
        }
    }

    if obs_x.len() < 2 {
        return (out, mask);
    }
    if obs_x.len() <= 2500 {
        if let Some(spline) = NaturalSpline::fit(&obs_x, &obs_y) {
            for i in 0..n {
                if series[i].is_nan() {
                    out[i] = spline.eval(i as f64);
                    mask[i] = true;
                }
            }
        }
    } else {
        // For large datasets, evaluate cubic spline locally on bounding knots around each gap
        // to avoid solving a multi-million-row tridiagonal system in memory.
        for i in 0..n {
            if series[i].is_nan() {
                let q = i as f64;
                let center = match obs_x.binary_search_by(|val| {
                    val.partial_cmp(&q).unwrap_or(std::cmp::Ordering::Equal)
                }) {
                    Ok(idx) => idx,
                    Err(idx) => idx,
                };
                let w = 15;
                let start = center.saturating_sub(w);
                let end = (center + w).min(obs_x.len());
                if end - start >= 2 {
                    if let Some(local_spline) =
                        NaturalSpline::fit(&obs_x[start..end], &obs_y[start..end])
                    {
                        out[i] = local_spline.eval(q);
                        mask[i] = true;
                    }
                }
            }
        }
    }
    (out, mask)
}

impl Imputer for SplineImputer {
    fn id(&self) -> &'static str {
        "spline"
    }

    fn impute(
        &self,
        columns: &ColumnData,
        _config: &ImputerConfig,
        _seed: u64,
    ) -> Result<ImputeResult, PfrsimError> {
        let (wt_imp, wt_mask) = interpolate_spline(&columns.wt);
        let (sm_imp, sm_mask) = interpolate_spline(&columns.sm);
        let (rf_imp, rf_mask) = interpolate_spline(&columns.rf);
        let (temp_imp, temp_mask) = interpolate_spline(&columns.temp);

        let mut overshoot = false;
        let mut warnings = Vec::new();

        for (i, &v) in rf_imp.iter().enumerate() {
            if rf_mask[i] && v < 0.0 {
                overshoot = true;
                warnings.push(format!(
                    "Spline produced negative rainfall ({v:.4} mm) at t={}",
                    i + 1
                ));
            }
        }
        for (i, &v) in sm_imp.iter().enumerate() {
            if sm_mask[i] && (v > 100.0 || v < 0.0) {
                overshoot = true;
                warnings.push(format!(
                    "Spline produced out-of-bound soil moisture ({v:.2}%) at t={}",
                    i + 1
                ));
            }
        }

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
            imputer_id: "spline".to_string(),
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
                overshoot,
                sparse_abort: false,
                warnings,
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
    fn test_spline_interpolation() {
        let s = vec![0.0, f64::NAN, 4.0, f64::NAN, 16.0]; // y = x^2 approx
        let (out, mask) = interpolate_spline(&s);
        assert!(mask[1]);
        assert!(mask[3]);
        assert!((out[1] - 1.0).abs() < 1.0);
        assert!((out[3] - 9.0).abs() < 2.0);
    }
}
