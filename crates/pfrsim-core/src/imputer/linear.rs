use crate::error::PfrsimError;
use crate::imputer::{ImputeFlags, ImputeMask, ImputeResult, Imputer, ImputerConfig};
use crate::ingest::ColumnData;

pub struct LinearImputer;

fn interpolate_linear(series: &[f64]) -> (Vec<f64>, Vec<bool>, bool) {
    let n = series.len();
    let mut out = series.to_vec();
    let mut mask = vec![false; n];
    let mut edge_na = false;

    let valid_indices: Vec<usize> = series
        .iter()
        .enumerate()
        .filter(|(_, &v)| !v.is_nan())
        .map(|(i, _)| i)
        .collect();

    if valid_indices.is_empty() {
        return (out, mask, true);
    }

    let first_valid = valid_indices[0];
    let last_valid = valid_indices[valid_indices.len() - 1];

    for i in 0..n {
        if series[i].is_nan() {
            if i < first_valid || i > last_valid {
                edge_na = true;
                // Leading/trailing NaN remains NaN per spec
            } else {
                // Interior NaN: binary search in O(log N)
                let pos = match valid_indices.binary_search(&i) {
                    Ok(p) => p,
                    Err(p) => p,
                };
                let prev = valid_indices[pos - 1];
                let next = valid_indices[pos];
                let frac = (i - prev) as f64 / (next - prev) as f64;
                out[i] = series[prev] + (series[next] - series[prev]) * frac;
                mask[i] = true;
            }
        }
    }

    (out, mask, edge_na)
}

impl Imputer for LinearImputer {
    fn id(&self) -> &'static str {
        "linear"
    }

    fn impute(
        &self,
        columns: &ColumnData,
        _config: &ImputerConfig,
        _seed: u64,
    ) -> Result<ImputeResult, PfrsimError> {
        let (wt_imp, wt_mask, wt_edge) = interpolate_linear(&columns.wt);
        let (sm_imp, sm_mask, sm_edge) = interpolate_linear(&columns.sm);
        let (rf_imp, rf_mask, rf_edge) = interpolate_linear(&columns.rf);
        let (temp_imp, temp_mask, temp_edge) = interpolate_linear(&columns.temp);

        let edge_na = wt_edge || sm_edge || rf_edge || temp_edge;
        let mut warnings = Vec::new();
        let mut culprit_cells = Vec::new();

        if edge_na {
            warnings.push(
                "Leading or trailing missing values remain NaN after linear interpolation"
                    .to_string(),
            );
            for (idx, &v) in wt_imp.iter().enumerate() {
                if v.is_nan() {
                    culprit_cells.push(format!("WT[t={}]", idx + 1));
                }
            }
            for (idx, &v) in sm_imp.iter().enumerate() {
                if v.is_nan() {
                    culprit_cells.push(format!("SM[t={}]", idx + 1));
                }
            }
            for (idx, &v) in rf_imp.iter().enumerate() {
                if v.is_nan() {
                    culprit_cells.push(format!("Rf[t={}]", idx + 1));
                }
            }
            for (idx, &v) in temp_imp.iter().enumerate() {
                if v.is_nan() {
                    culprit_cells.push(format!("Temp[t={}]", idx + 1));
                }
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
            imputer_id: "linear".to_string(),
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
                edge_na,
                overshoot: false,
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
    fn test_linear_interior() {
        let s = vec![1.0, f64::NAN, 3.0, f64::NAN, 5.0];
        let (out, mask, edge) = interpolate_linear(&s);
        assert!(!edge);
        assert_eq!(out, vec![1.0, 2.0, 3.0, 4.0, 5.0]);
        assert_eq!(mask, vec![false, true, false, true, false]);
    }

    #[test]
    fn test_linear_edge_na() {
        let s = vec![f64::NAN, 2.0, 3.0, f64::NAN];
        let (out, mask, edge) = interpolate_linear(&s);
        assert!(edge);
        assert!(out[0].is_nan());
        assert!(out[3].is_nan());
        assert_eq!(mask, vec![false, false, false, false]);
    }
}
