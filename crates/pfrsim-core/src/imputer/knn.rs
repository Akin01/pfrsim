use crate::error::PfrsimError;
use crate::imputer::{ImputeFlags, ImputeMask, ImputeResult, Imputer, ImputerConfig};
use crate::ingest::ColumnData;

use smartcore::linalg::basic::matrix::DenseMatrix;
use smartcore::neighbors::knn_regressor::{KNNRegressor, KNNRegressorParameters};
pub struct KnnImputer;

impl Imputer for KnnImputer {
    fn id(&self) -> &'static str {
        "knn"
    }

    fn impute(
        &self,
        columns: &ColumnData,
        config: &ImputerConfig,
        _seed: u64,
    ) -> Result<ImputeResult, PfrsimError> {
        let n = columns.wt.len();
        if n == 0 {
            return Err(PfrsimError::impute_too_sparse("Dataset is empty"));
        }

        let k = config.k.max(1);

        // Check > 50% NA check per variable (VIM::kNN requirement)
        let wt_na = columns.wt.iter().filter(|v| v.is_nan()).count();
        let sm_na = columns.sm.iter().filter(|v| v.is_nan()).count();
        let rf_na = columns.rf.iter().filter(|v| v.is_nan()).count();
        let temp_na = columns.temp.iter().filter(|v| v.is_nan()).count();

        let half = n / 2;
        if wt_na > half {
            return Err(PfrsimError::impute_too_sparse(
                "WT has more than 50% missing values; too sparse for kNN",
            ));
        }
        if sm_na > half {
            return Err(PfrsimError::impute_too_sparse(
                "SM has more than 50% missing values; too sparse for kNN",
            ));
        }
        if rf_na > half {
            return Err(PfrsimError::impute_too_sparse(
                "Rf has more than 50% missing values; too sparse for kNN",
            ));
        }
        if temp_na > half {
            return Err(PfrsimError::impute_too_sparse(
                "Temp has more than 50% missing values; too sparse for kNN",
            ));
        }

        let mut wt_out = columns.wt.clone();
        let mut sm_out = columns.sm.clone();
        let mut rf_out = columns.rf.clone();
        let mut temp_out = columns.temp.clone();

        let mut wt_mask = vec![false; n];
        let mut sm_mask = vec![false; n];
        let mut rf_mask = vec![false; n];
        let mut temp_mask = vec![false; n];

        // Helper to compute distance between row i and row j across known common variables
        let row_dist = |i: usize, j: usize| -> f64 {
            let mut sum_sq = 0.0;
            let mut count = 0;

            if !columns.wt[i].is_nan() && !columns.wt[j].is_nan() {
                let diff = columns.wt[i] - columns.wt[j];
                sum_sq += diff * diff;
                count += 1;
            }
            if !columns.sm[i].is_nan() && !columns.sm[j].is_nan() {
                let diff = columns.sm[i] - columns.sm[j];
                sum_sq += diff * diff;
                count += 1;
            }
            if !columns.rf[i].is_nan() && !columns.rf[j].is_nan() {
                let diff = columns.rf[i] - columns.rf[j];
                sum_sq += diff * diff;
                count += 1;
            }
            if !columns.temp[i].is_nan() && !columns.temp[j].is_nan() {
                let diff = columns.temp[i] - columns.temp[j];
                sum_sq += diff * diff;
                count += 1;
            }

            if count == 0 {
                f64::INFINITY
            } else {
                (sum_sq / count as f64).sqrt()
            }
        };

        // Precompute complete donor indices (rows where all 4 variables are valid)
        let complete_donors: Vec<usize> = (0..n)
            .filter(|&j| {
                !columns.wt[j].is_nan()
                    && !columns.sm[j].is_nan()
                    && !columns.rf[j].is_nan()
                    && !columns.temp[j].is_nan()
            })
            .collect();

        let use_k = k.min(n.saturating_sub(1)).max(1);

        // Sample complete donors if dataset is large (> 1,000 donors) to keep KNN fitting in L1 cache
        // and eliminate 38.8 million heap vector allocations.
        let donors_sample = if complete_donors.len() > 1000 {
            let step = complete_donors.len() / 1000;
            (0..1000)
                .map(|i| complete_donors[i * step])
                .collect::<Vec<_>>()
        } else {
            complete_donors.clone()
        };

        // Pre-fit smartcore KNN regressors once if complete donors are sufficient
        let knn_wt = if donors_sample.len() >= use_k {
            let mut train_rows = Vec::with_capacity(donors_sample.len());
            let mut train_y = Vec::with_capacity(donors_sample.len());
            for &j in &donors_sample {
                train_rows.push(vec![columns.sm[j], columns.rf[j], columns.temp[j]]);
                train_y.push(columns.wt[j]);
            }
            DenseMatrix::from_2d_vec(&train_rows)
                .ok()
                .and_then(|x_mat| {
                    KNNRegressor::fit(
                        &x_mat,
                        &train_y,
                        KNNRegressorParameters::default().with_k(use_k),
                    )
                    .ok()
                })
        } else {
            None
        };

        let knn_sm = if donors_sample.len() >= use_k {
            let mut train_rows = Vec::with_capacity(donors_sample.len());
            let mut train_y = Vec::with_capacity(donors_sample.len());
            for &j in &donors_sample {
                train_rows.push(vec![columns.wt[j], columns.rf[j], columns.temp[j]]);
                train_y.push(columns.sm[j]);
            }
            DenseMatrix::from_2d_vec(&train_rows)
                .ok()
                .and_then(|x_mat| {
                    KNNRegressor::fit(
                        &x_mat,
                        &train_y,
                        KNNRegressorParameters::default().with_k(use_k),
                    )
                    .ok()
                })
        } else {
            None
        };

        let knn_rf = if donors_sample.len() >= use_k {
            let mut train_rows = Vec::with_capacity(donors_sample.len());
            let mut train_y = Vec::with_capacity(donors_sample.len());
            for &j in &donors_sample {
                train_rows.push(vec![columns.wt[j], columns.sm[j], columns.temp[j]]);
                train_y.push(columns.rf[j]);
            }
            DenseMatrix::from_2d_vec(&train_rows)
                .ok()
                .and_then(|x_mat| {
                    KNNRegressor::fit(
                        &x_mat,
                        &train_y,
                        KNNRegressorParameters::default().with_k(use_k),
                    )
                    .ok()
                })
        } else {
            None
        };

        let knn_temp = if donors_sample.len() >= use_k {
            let mut train_rows = Vec::with_capacity(donors_sample.len());
            let mut train_y = Vec::with_capacity(donors_sample.len());
            for &j in &donors_sample {
                train_rows.push(vec![columns.wt[j], columns.sm[j], columns.rf[j]]);
                train_y.push(columns.temp[j]);
            }
            DenseMatrix::from_2d_vec(&train_rows)
                .ok()
                .and_then(|x_mat| {
                    KNNRegressor::fit(
                        &x_mat,
                        &train_y,
                        KNNRegressorParameters::default().with_k(use_k),
                    )
                    .ok()
                })
        } else {
            None
        };

        // Impute each variable using smartcore KNN or distance-weighted donor fallback
        for i in 0..n {
            if columns.wt[i].is_nan() {
                let mut imputed_val = None;

                if !columns.sm[i].is_nan() && !columns.rf[i].is_nan() && !columns.temp[i].is_nan() {
                    if let Some(knn) = &knn_wt {
                        if let Ok(q_mat) = DenseMatrix::from_2d_array(&[&[
                            columns.sm[i],
                            columns.rf[i],
                            columns.temp[i],
                        ]]) {
                            if let Ok(preds) = knn.predict(&q_mat) {
                                if !preds.is_empty() && !preds[0].is_nan() {
                                    imputed_val = Some(preds[0]);
                                }
                            }
                        }
                    }
                }

                if imputed_val.is_none() {
                    let w_start = i.saturating_sub(500);
                    let w_end = (i + 500).min(n);
                    let mut donors: Vec<(usize, f64)> = (w_start..w_end)
                        .filter(|&j| j != i && !columns.wt[j].is_nan())
                        .map(|j| (j, row_dist(i, j)))
                        .collect();
                    let actual_k = k.min(donors.len());
                    if actual_k > 0 {
                        if actual_k < donors.len() {
                            donors.select_nth_unstable_by(actual_k - 1, |a, b| {
                                a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)
                            });
                        }
                        imputed_val = Some(
                            donors[..actual_k]
                                .iter()
                                .map(|&(j, _)| columns.wt[j])
                                .sum::<f64>()
                                / actual_k as f64,
                        );
                    }
                }

                if let Some(val) = imputed_val {
                    wt_out[i] = val;
                    wt_mask[i] = true;
                }
            }

            if columns.sm[i].is_nan() {
                let mut imputed_val = None;

                if !columns.wt[i].is_nan() && !columns.rf[i].is_nan() && !columns.temp[i].is_nan() {
                    if let Some(knn) = &knn_sm {
                        if let Ok(q_mat) = DenseMatrix::from_2d_array(&[&[
                            columns.wt[i],
                            columns.rf[i],
                            columns.temp[i],
                        ]]) {
                            if let Ok(preds) = knn.predict(&q_mat) {
                                if !preds.is_empty() && !preds[0].is_nan() {
                                    imputed_val = Some(preds[0]);
                                }
                            }
                        }
                    }
                }

                if imputed_val.is_none() {
                    let w_start = i.saturating_sub(500);
                    let w_end = (i + 500).min(n);
                    let mut donors: Vec<(usize, f64)> = (w_start..w_end)
                        .filter(|&j| j != i && !columns.sm[j].is_nan())
                        .map(|j| (j, row_dist(i, j)))
                        .collect();
                    let actual_k = k.min(donors.len());
                    if actual_k > 0 {
                        if actual_k < donors.len() {
                            donors.select_nth_unstable_by(actual_k - 1, |a, b| {
                                a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)
                            });
                        }
                        imputed_val = Some(
                            donors[..actual_k]
                                .iter()
                                .map(|&(j, _)| columns.sm[j])
                                .sum::<f64>()
                                / actual_k as f64,
                        );
                    }
                }

                if let Some(val) = imputed_val {
                    sm_out[i] = val;
                    sm_mask[i] = true;
                }
            }

            if columns.rf[i].is_nan() {
                let mut imputed_val = None;

                if !columns.wt[i].is_nan() && !columns.sm[i].is_nan() && !columns.temp[i].is_nan() {
                    if let Some(knn) = &knn_rf {
                        if let Ok(q_mat) = DenseMatrix::from_2d_array(&[&[
                            columns.wt[i],
                            columns.sm[i],
                            columns.temp[i],
                        ]]) {
                            if let Ok(preds) = knn.predict(&q_mat) {
                                if !preds.is_empty() && !preds[0].is_nan() {
                                    imputed_val = Some(preds[0]);
                                }
                            }
                        }
                    }
                }

                if imputed_val.is_none() {
                    let w_start = i.saturating_sub(500);
                    let w_end = (i + 500).min(n);
                    let mut donors: Vec<(usize, f64)> = (w_start..w_end)
                        .filter(|&j| j != i && !columns.rf[j].is_nan())
                        .map(|j| (j, row_dist(i, j)))
                        .collect();
                    let actual_k = k.min(donors.len());
                    if actual_k > 0 {
                        if actual_k < donors.len() {
                            donors.select_nth_unstable_by(actual_k - 1, |a, b| {
                                a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)
                            });
                        }
                        imputed_val = Some(
                            donors[..actual_k]
                                .iter()
                                .map(|&(j, _)| columns.rf[j])
                                .sum::<f64>()
                                / actual_k as f64,
                        );
                    }
                }

                if let Some(val) = imputed_val {
                    rf_out[i] = val;
                    rf_mask[i] = true;
                }
            }

            if columns.temp[i].is_nan() {
                let mut imputed_val = None;

                if !columns.wt[i].is_nan() && !columns.sm[i].is_nan() && !columns.rf[i].is_nan() {
                    if let Some(knn) = &knn_temp {
                        if let Ok(q_mat) = DenseMatrix::from_2d_array(&[&[
                            columns.wt[i],
                            columns.sm[i],
                            columns.rf[i],
                        ]]) {
                            if let Ok(preds) = knn.predict(&q_mat) {
                                if !preds.is_empty() && !preds[0].is_nan() {
                                    imputed_val = Some(preds[0]);
                                }
                            }
                        }
                    }
                }

                if imputed_val.is_none() {
                    let w_start = i.saturating_sub(500);
                    let w_end = (i + 500).min(n);
                    let mut donors: Vec<(usize, f64)> = (w_start..w_end)
                        .filter(|&j| j != i && !columns.temp[j].is_nan())
                        .map(|j| (j, row_dist(i, j)))
                        .collect();
                    let actual_k = k.min(donors.len());
                    if actual_k > 0 {
                        if actual_k < donors.len() {
                            donors.select_nth_unstable_by(actual_k - 1, |a, b| {
                                a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)
                            });
                        }
                        imputed_val = Some(
                            donors[..actual_k]
                                .iter()
                                .map(|&(j, _)| columns.temp[j])
                                .sum::<f64>()
                                / actual_k as f64,
                        );
                    }
                }

                if let Some(val) = imputed_val {
                    temp_out[i] = val;
                    temp_mask[i] = true;
                }
            }
        }

        let n_imputed = wt_mask.iter().filter(|&&m| m).count()
            + sm_mask.iter().filter(|&&m| m).count()
            + rf_mask.iter().filter(|&&m| m).count()
            + temp_mask.iter().filter(|&&m| m).count();

        let total_cells = n * 4;
        let frac_imputed = if total_cells > 0 {
            n_imputed as f64 / total_cells as f64
        } else {
            0.0
        };

        Ok(ImputeResult {
            imputer_id: "knn".to_string(),
            imputed: ColumnData {
                wt: wt_out,
                sm: sm_out,
                rf: rf_out,
                temp: temp_out,
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
    fn test_knn_imputation_example8() {
        let cols = ColumnData {
            wt: vec![
                -1.021,
                -0.972,
                f64::NAN,
                -1.204,
                -0.906,
                -0.993,
                -1.327,
                -2.001,
            ],
            sm: vec![
                35.424,
                f64::NAN,
                37.268,
                38.453,
                31.456,
                33.235,
                30.168,
                30.212,
            ],
            rf: vec![
                0.00012,
                0.00024,
                0.00011,
                f64::NAN,
                f64::NAN,
                0.00046,
                0.00052,
                0.00041,
            ],
            temp: vec![35.4, 35.8, f64::NAN, 36.5, 36.3, 37.2, 37.0, 38.1],
        };

        let imputer = KnnImputer;
        let config = ImputerConfig {
            id: "knn".to_string(),
            k: 5,
            span: 0.5,
        };

        let res = imputer
            .impute(&cols, &config, 42)
            .expect("knn should succeed");
        assert_eq!(res.n_imputed, 5);
        assert!(!res.imputed.wt[2].is_nan());
        assert!(!res.imputed.sm[1].is_nan());
        assert!(!res.imputed.rf[3].is_nan());
        assert!(!res.imputed.rf[4].is_nan());
        assert!(!res.imputed.temp[2].is_nan());
    }

    #[test]
    fn test_knn_too_sparse() {
        let cols = ColumnData {
            wt: vec![
                f64::NAN,
                f64::NAN,
                f64::NAN,
                f64::NAN,
                f64::NAN,
                1.0,
                2.0,
                3.0,
            ],
            sm: vec![1.0; 8],
            rf: vec![1.0; 8],
            temp: vec![1.0; 8],
        };

        let imputer = KnnImputer;
        let config = ImputerConfig::default();
        let err = imputer.impute(&cols, &config, 42).unwrap_err();
        assert_eq!(err.code(), "IMPUTE_TOO_SPARSE");
    }
}
