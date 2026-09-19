use crate::error::PfrsimError;
use crate::forecaster::{
    ArimaVariableInfo, EpochCallback, ForecastMetrics, ForecastResult, Forecaster,
    ForecasterConfig, HoldoutMetrics,
};
use crate::ingest::ColumnData;

pub struct ArimaForecaster;

/// Find optimal Box-Cox lambda in [-2.0, 2.0] via profile log-likelihood
pub fn optimal_box_cox_lambda(y: &[f64]) -> f64 {
    let n = y.len() as f64;
    let mut best_lambda = 0.0;
    let mut best_loglik = f64::NEG_INFINITY;

    let sum_log_y: f64 = y.iter().map(|&v| v.max(1e-12).ln()).sum();

    let mut transformed = vec![0.0; y.len()];
    let mut lambda: f64 = -1.0;
    while lambda <= 2.0001 {
        for (i, &v) in y.iter().enumerate() {
            let v = v.max(1e-12);
            transformed[i] = if lambda.abs() < 1e-5 {
                v.ln()
            } else {
                (v.powf(lambda) - 1.0) / lambda
            };
        }

        let mean = transformed.iter().sum::<f64>() / n;
        let mut var = transformed.iter().map(|&v| (v - mean).powi(2)).sum::<f64>() / n;
        if var <= 1e-15 {
            var = 1e-15;
        }

        let loglik = -0.5 * n * var.ln() + (lambda - 1.0) * sum_log_y;
        if loglik > best_loglik {
            best_loglik = loglik;
            best_lambda = lambda;
        }

        lambda += 0.05;
    }

    if (best_lambda - 1.0).abs() < 0.06 {
        1.0
    } else {
        best_lambda
    }
}

/// Apply Box-Cox transform
pub fn box_cox_transform(y: &[f64], lambda: f64) -> Vec<f64> {
    y.iter()
        .map(|&v| {
            let v = v.max(1e-12);
            if lambda.abs() < 1e-5 {
                v.ln()
            } else {
                (v.powf(lambda) - 1.0) / lambda
            }
        })
        .collect()
}

/// Invert Box-Cox transform with Taylor-series bias adjustment
pub fn box_cox_invert(w: &[f64], lambda: f64, sigma2: f64) -> Vec<f64> {
    w.iter()
        .map(|&w_val| {
            if lambda.abs() < 1e-5 {
                let clamped_w = w_val.clamp(-25.0, 25.0);
                let bias = (0.5 * sigma2.max(0.0)).min(0.5);
                clamped_w.exp() * (1.0 + bias)
            } else if (lambda - 1.0).abs() < 1e-5 {
                // Linear identity: y = w + 1
                w_val + 1.0
            } else {
                // Guard against crossing the Box-Cox asymptote (lambda * w + 1 <= 0)
                let base = (lambda * w_val + 1.0).max(1e-3);
                let y_raw = base.powf(1.0 / lambda);

                // Guard the Taylor-series bias adjustment against divergence
                let adj = 0.5 * sigma2 * (1.0 - lambda) / (base * base);
                let safe_adj = if adj.is_nan() || !adj.is_finite() || adj.abs() > 0.5 {
                    0.0
                } else {
                    adj
                };

                y_raw * (1.0 + safe_adj)
            }
        })
        .collect()
}

#[derive(Debug, Clone)]
struct FittedModel {
    p: usize,
    d: usize,
    q: usize,
    c: f64,
    phi: Vec<f64>,
    theta: Vec<f64>,
    sigma2: f64,
    residuals: Vec<f64>,
    aic: f64,
    bic: f64,
    last_val: f64,
    past_w: Vec<f64>,
}

fn fit_arma_candidate(
    w: &[f64],
    p: usize,
    q: usize,
    lr: f64,
) -> Option<(f64, Vec<f64>, Vec<f64>, f64, Vec<f64>, f64, f64)> {
    let n = w.len();
    let k_params = p + q + 1; // intercept + phi + theta
    if n <= k_params + 2 {
        return None;
    }

    let mean_w = w.iter().sum::<f64>() / n as f64;

    // Initialize parameters
    let mut c = mean_w;
    let mut phi = vec![0.0; p];
    let mut theta = vec![0.0; q];

    // Initial AR estimate via Yule-Walker if p > 0
    if p > 0 {
        let mut r = vec![0.0; p + 1];
        let mut var = 0.0;
        for i in 0..n {
            var += (w[i] - mean_w).powi(2);
        }
        r[0] = 1.0;
        for k in 1..=p {
            let mut cov = 0.0;
            for i in k..n {
                cov += (w[i] - mean_w) * (w[i - k] - mean_w);
            }
            r[k] = if var > 0.0 { cov / var } else { 0.0 };
        }
        if p == 1 {
            phi[0] = r[1].clamp(-0.95, 0.95);
        } else if p == 2 {
            let denom = 1.0 - r[1] * r[1];
            if denom.abs() > 1e-6 {
                phi[0] = ((r[1] - r[1] * r[2]) / denom).clamp(-0.95, 0.95);
                phi[1] = ((r[2] - r[1] * r[1]) / denom).clamp(-0.95, 0.95);
            }
        }
    }

    // Compute residuals in-place using pre-allocated buffer
    let mut res = vec![0.0; n];
    let compute_residuals =
        |c_val: f64, phi_vals: &[f64], theta_vals: &[f64], res_buf: &mut [f64]| -> f64 {
            let mut sse = 0.0;
            for t in 0..n {
                let mut pred = c_val;
                for i in 0..p {
                    if t > i {
                        pred += phi_vals[i] * (w[t - 1 - i] - mean_w);
                    }
                }
                for j in 0..q {
                    if t > j {
                        pred += theta_vals[j] * res_buf[t - 1 - j];
                    }
                }
                let err = w[t] - pred;
                res_buf[t] = err;
                if t >= p {
                    sse += err * err;
                }
            }
            sse
        };

    let mut sse = compute_residuals(c, &phi, &theta, &mut res);
    let n_eff = (n - p) as f64;

    // Simple gradient descent / refinement (50 iterations)
    let lr = lr.clamp(1e-5, 1.0);
    for _ in 0..50 {
        let mut grad_c = 0.0;
        for t in p..n {
            grad_c += -2.0 * res[t];
        }
        c -= (lr * grad_c / n_eff).clamp(-0.5, 0.5);

        for idx in 0..p {
            let mut grad_phi = 0.0;
            for t in p..n {
                if t > idx {
                    grad_phi += -2.0 * res[t] * (w[t - 1 - idx] - mean_w);
                }
            }
            phi[idx] = (phi[idx] - (lr * grad_phi / n_eff)).clamp(-0.95, 0.95);
        }

        for idx in 0..q {
            let mut grad_theta = 0.0;
            for t in p..n {
                if t > idx {
                    grad_theta += -2.0 * res[t] * res[t - 1 - idx];
                }
            }
            theta[idx] = (theta[idx] - (lr * grad_theta / n_eff)).clamp(-0.95, 0.95);
        }

        sse = compute_residuals(c, &phi, &theta, &mut res);
    }

    let sigma2 = (sse / (n_eff - k_params as f64).max(1.0)).max(1e-8);
    let ll = -0.5 * n_eff * (2.0 * std::f64::consts::PI * sigma2).ln() - 0.5 * sse / sigma2;
    let total_params = (k_params + 1) as f64; // +1 for sigma2
    let aic = 2.0 * total_params - 2.0 * ll;
    let bic = total_params * n_eff.ln() - 2.0 * ll;

    Some((c, phi, theta, sigma2, res, aic, bic))
}

fn fit_auto_arima(series: &[f64], lr: f64) -> FittedModel {
    let n = series.len();
    if n < 4 {
        // Fallback constant
        let mean = series.iter().sum::<f64>() / n as f64;
        return FittedModel {
            p: 0,
            d: 0,
            q: 0,
            c: mean,
            phi: Vec::new(),
            theta: Vec::new(),
            sigma2: 1e-4,
            residuals: vec![0.0; n],
            aic: 0.0,
            bic: 0.0,
            last_val: *series.last().unwrap_or(&0.0),
            past_w: series.to_vec(),
        };
    }

    // Determine differencing d in {0, 1}
    let mean_s = series.iter().sum::<f64>() / n as f64;
    let var_s = series.iter().map(|&v| (v - mean_s).powi(2)).sum::<f64>() / n as f64;

    let diff: Vec<f64> = (1..n).map(|i| series[i] - series[i - 1]).collect();
    let mean_d = diff.iter().sum::<f64>() / diff.len() as f64;
    let var_d = diff.iter().map(|&v| (v - mean_d).powi(2)).sum::<f64>() / diff.len() as f64;

    let d = if var_d < 0.8 * var_s && n >= 6 { 1 } else { 0 };
    let work_series: &[f64] = if d == 1 { &diff } else { series };

    let mut best_aic = f64::INFINITY;
    let mut best_model = FittedModel {
        p: 0,
        d,
        q: 0,
        c: work_series.iter().sum::<f64>() / work_series.len() as f64,
        phi: Vec::new(),
        theta: Vec::new(),
        sigma2: 1.0,
        residuals: vec![0.0; work_series.len()],
        aic: 999.0,
        bic: 999.0,
        last_val: *series.last().unwrap_or(&0.0),
        past_w: work_series.to_vec(),
    };

    // Candidate search p in 0..=2, q in 0..=2
    for p in 0..=2 {
        for q in 0..=2 {
            if let Some((c, phi, theta, sigma2, res, aic, bic)) =
                fit_arma_candidate(work_series, p, q, lr)
            {
                if aic < best_aic {
                    best_aic = aic;
                    best_model = FittedModel {
                        p,
                        d,
                        q,
                        c,
                        phi,
                        theta,
                        sigma2,
                        residuals: res,
                        aic,
                        bic,
                        last_val: *series.last().unwrap_or(&0.0),
                        past_w: work_series.to_vec(),
                    };
                }
            }
        }
    }

    best_model
}

fn forecast_model(model: &FittedModel, h: usize) -> Vec<f64> {
    let mut w_forecast = Vec::with_capacity(h);
    let past_w = &model.past_w;
    let mut past_res = model.residuals.clone();

    for step in 0..h {
        let mut pred = model.c;
        for i in 0..model.p {
            if step > i {
                pred += model.phi[i] * w_forecast[step - 1 - i];
            } else if past_w.len() > i - step {
                pred += model.phi[i] * past_w[past_w.len() - 1 - (i - step)];
            }
        }
        for j in 0..model.q {
            if step <= j && past_res.len() > j - step {
                pred += model.theta[j] * past_res[past_res.len() - 1 - (j - step)];
            }
        }
        w_forecast.push(pred);
        past_res.push(0.0); // future error expectation is 0
    }

    if model.d == 1 {
        // Integrate / cumulative sum from last_val
        let mut integrated = Vec::with_capacity(h);
        let mut curr = model.last_val;
        for &diff in &w_forecast {
            curr += diff;
            integrated.push(curr);
        }
        integrated
    } else {
        w_forecast
    }
}

/// Ljung-Box test at lag using statrs ChiSquared distribution
pub fn ljung_box_test(residuals: &[f64], p: usize, q: usize) -> f64 {
    use statrs::distribution::{ChiSquared, ContinuousCDF};
    use statrs::statistics::Statistics;

    let m = residuals.len();
    let lag = 10.min(m.saturating_sub(2)).max(1);
    if m <= lag + 1 {
        return 1.0;
    }

    let mean = residuals.mean();
    let var: f64 = residuals.iter().map(|&v| (v - mean).powi(2)).sum();
    if var <= 1e-12 {
        return 1.0;
    }

    let mut q_stat = 0.0;
    for k in 1..=lag {
        let mut cov = 0.0;
        for t in k..m {
            cov += (residuals[t] - mean) * (residuals[t - k] - mean);
        }
        let r_k = cov / var;
        q_stat += (r_k * r_k) / ((m - k) as f64);
    }
    q_stat *= (m * (m + 2)) as f64;

    let df = if lag > (p + q) {
        (lag - (p + q)) as f64
    } else {
        1.0
    };
    if let Ok(chi2) = ChiSquared::new(df) {
        (1.0 - chi2.cdf(q_stat)).clamp(0.0, 1.0)
    } else {
        1.0
    }
}

fn fit_and_forecast_single(
    full_series: &[f64],
    h: usize,
    split_ratio: f64,
    lr: f64,
    var_name: &str,
) -> (Vec<f64>, ArimaVariableInfo, Option<String>) {
    // For large datasets, fit ARIMA on the most recent 1,000 observations to capture the active hydrological regime
    // and avoid tens of billions of unvectorized gradient descent iterations on CPU.
    let series = if full_series.len() > 1000 {
        &full_series[(full_series.len() - 1000)..]
    } else {
        full_series
    };
    let n = series.len();
    let mut warning = None;

    // Holdout evaluation
    let holdout = if split_ratio > 0.0 && split_ratio < 1.0 && n >= 8 {
        let n_test = ((n as f64 * split_ratio).floor() as usize).max(1);
        let n_train = n - n_test;
        let train_data = &series[..n_train];
        let test_data = &series[n_train..];

        let min_train = train_data.iter().cloned().fold(f64::INFINITY, f64::min);
        let k_train = min_train.abs() + 1.0;
        let train_shifted: Vec<f64> = train_data.iter().map(|&v| v + k_train).collect();
        let lambda_train = if var_name == "Temp" {
            1.0
        } else {
            optimal_box_cox_lambda(&train_shifted)
        };
        let train_transformed = box_cox_transform(&train_shifted, lambda_train);

        let fit_train = fit_auto_arima(&train_transformed, lr);
        let forecast_train_trans = forecast_model(&fit_train, n_test);
        let mut forecast_eval =
            box_cox_invert(&forecast_train_trans, lambda_train, fit_train.sigma2);
        for v in &mut forecast_eval {
            *v -= k_train;
            if var_name == "Rf" && *v < 0.0 {
                *v = 0.0;
            }
            if var_name == "SM" {
                if *v > 100.0 {
                    *v = 100.0;
                }
                if *v < 0.0 {
                    *v = 0.0;
                }
            }
            if var_name == "Temp" {
                let t_min =
                    (train_data.iter().copied().fold(f64::INFINITY, f64::min) - 10.0).max(5.0);
                let t_max =
                    (train_data.iter().copied().fold(f64::NEG_INFINITY, f64::max) + 10.0).min(65.0);
                *v = v.clamp(t_min, t_max);
            }
            if var_name == "WT" {
                *v = v.clamp(-5.0, 2.0);
            }
        }

        let test_vec = test_data.to_vec();
        let mse = smartcore::metrics::mean_squared_error(&test_vec, &forecast_eval);
        let mae = smartcore::metrics::mean_absolute_error(&test_vec, &forecast_eval);
        let rmse = mse.sqrt();

        Some(HoldoutMetrics { mse, rmse, mae })
    } else {
        None
    };

    // Full fit
    let min_val = series.iter().cloned().fold(f64::INFINITY, f64::min);
    let k = min_val.abs() + 1.0;
    let full_shifted: Vec<f64> = series.iter().map(|&v| v + k).collect();
    let lambda = if var_name == "Temp" {
        1.0
    } else {
        optimal_box_cox_lambda(&full_shifted)
    };
    let full_transformed = box_cox_transform(&full_shifted, lambda);

    let fit = fit_auto_arima(&full_transformed, lr);
    let ljungbox_p = ljung_box_test(&fit.residuals, fit.p, fit.q);

    let forecast_trans = forecast_model(&fit, h);
    let mut forecast = box_cox_invert(&forecast_trans, lambda, fit.sigma2);
    for v in &mut forecast {
        *v -= k;
        if var_name == "Rf" && *v < 0.0 {
            *v = 0.0;
        }
        if var_name == "SM" {
            if *v > 100.0 {
                *v = 100.0;
            }
            if *v < 0.0 {
                *v = 0.0;
                warning = Some("FORECAST_SM_UNBOUNDED_BELOW".to_string());
            }
        }
        if var_name == "Temp" {
            let t_min = (series.iter().copied().fold(f64::INFINITY, f64::min) - 10.0).max(5.0);
            let t_max = (series.iter().copied().fold(f64::NEG_INFINITY, f64::max) + 10.0).min(65.0);
            *v = v.clamp(t_min, t_max);
        }
        if var_name == "WT" {
            *v = v.clamp(-5.0, 2.0);
        }
    }

    let info = ArimaVariableInfo {
        order: (fit.p, fit.d, fit.q),
        aic: fit.aic,
        bic: fit.bic,
        ljungbox_p,
        lambda,
        k,
        holdout,
    };

    (forecast, info, warning)
}

impl Forecaster for ArimaForecaster {
    fn id(&self) -> &'static str {
        "arima"
    }

    fn forecast(
        &self,
        data: &ColumnData,
        config: &ForecasterConfig,
        h: usize,
        _seed: u64,
        on_epoch: Option<&EpochCallback<'_>>,
    ) -> Result<ForecastResult, PfrsimError> {
        let split_ratio = config.arima.test_split_ratio;
        let lr = config.arima.learning_rate;

        let (wt_res, sm_res, rf_res, temp_res) = std::thread::scope(|s| {
            let h_wt = s.spawn(|| {
                if let Some(cb) = on_epoch {
                    cb("WT", 0, 1);
                }
                let res = fit_and_forecast_single(&data.wt, h, split_ratio, lr, "WT");
                if let Some(cb) = on_epoch {
                    cb("WT", 1, 1);
                }
                res
            });
            let h_sm = s.spawn(|| {
                if let Some(cb) = on_epoch {
                    cb("SM", 0, 1);
                }
                let res = fit_and_forecast_single(&data.sm, h, split_ratio, lr, "SM");
                if let Some(cb) = on_epoch {
                    cb("SM", 1, 1);
                }
                res
            });
            let h_rf = s.spawn(|| {
                if let Some(cb) = on_epoch {
                    cb("Rf", 0, 1);
                }
                let res = fit_and_forecast_single(&data.rf, h, split_ratio, lr, "Rf");
                if let Some(cb) = on_epoch {
                    cb("Rf", 1, 1);
                }
                res
            });
            let h_temp = s.spawn(|| {
                if let Some(cb) = on_epoch {
                    cb("Temp", 0, 1);
                }
                let res = fit_and_forecast_single(&data.temp, h, split_ratio, lr, "Temp");
                if let Some(cb) = on_epoch {
                    cb("Temp", 1, 1);
                }
                res
            });

            (
                h_wt.join().unwrap(),
                h_sm.join().unwrap(),
                h_rf.join().unwrap(),
                h_temp.join().unwrap(),
            )
        });
        let (wt_pred, wt_info, wt_warn) = wt_res;
        let (sm_pred, sm_info, sm_warn) = sm_res;
        let (rf_pred, rf_info, rf_warn) = rf_res;
        let (temp_pred, temp_info, temp_warn) = temp_res;
        let mut flags = Vec::new();
        if let Some(w) = wt_warn {
            flags.push(w);
        }
        if let Some(w) = sm_warn {
            flags.push(w);
        }
        if let Some(w) = rf_warn {
            flags.push(w);
        }
        if let Some(w) = temp_warn {
            flags.push(w);
        }

        Ok(ForecastResult {
            forecaster_id: "arima".to_string(),
            h,
            forecast: ColumnData {
                wt: wt_pred,
                sm: sm_pred,
                rf: rf_pred,
                temp: temp_pred,
            },
            metrics: ForecastMetrics {
                wt: wt_info,
                sm: sm_info,
                rf: rf_info,
                temp: temp_info,
            },
            flags,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_box_cox_roundtrip() {
        let y = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let lambda = optimal_box_cox_lambda(&y);
        let trans = box_cox_transform(&y, lambda);
        let inv = box_cox_invert(&trans, lambda, 0.0);
        for i in 0..y.len() {
            assert!((inv[i] - y[i]).abs() < 1e-4);
        }
    }

    #[test]
    fn test_arima_forecast_length() {
        let data = ColumnData {
            wt: vec![-1.0, -1.1, -1.2, -1.15, -1.1, -1.05, -1.0, -1.2],
            sm: vec![35.0, 34.0, 33.0, 32.5, 33.0, 34.0, 35.0, 36.0],
            rf: vec![0.001, 0.002, 0.0, 0.0, 0.003, 0.001, 0.0, 0.0],
            temp: vec![35.0, 35.5, 36.0, 36.2, 36.0, 35.8, 35.5, 36.0],
        };
        let forecaster = ArimaForecaster;
        let config = ForecasterConfig::default();
        let res = forecaster
            .forecast(&data, &config, 4, 42, None)
            .expect("arima should succeed");
        assert_eq!(res.h, 4);
        assert_eq!(res.forecast.wt.len(), 4);
        assert_eq!(res.forecast.sm.len(), 4);
        assert_eq!(res.forecast.rf.len(), 4);
        assert_eq!(res.forecast.temp.len(), 4);
        assert!(res.metrics.wt.holdout.is_some());
    }
}
