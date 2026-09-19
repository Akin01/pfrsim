use serde::{Deserialize, Serialize};

use crate::error::PfrsimError;

fn default_r0() -> f64 {
    3000.0
}

fn default_dt() -> f64 {
    1.0
}

fn default_h() -> usize {
    4
}

fn default_fc() -> f64 {
    40.0
}

fn default_sat() -> f64 {
    70.0
}

fn default_max_grid_m() -> usize {
    2
}

fn default_timeout_s() -> f64 {
    30.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PfviConfig {
    #[serde(default = "default_r0")]
    pub r0: f64,
    #[serde(default = "default_dt")]
    pub dt: f64,
    #[serde(default = "default_h")]
    pub h: usize,
    #[serde(default = "default_fc")]
    pub fc: f64,
    #[serde(default = "default_sat")]
    pub sat: f64,
    #[serde(default = "default_max_grid_m")]
    pub max_grid_m: usize,
    #[serde(default = "default_timeout_s")]
    pub timeout_s: f64,
}

impl Default for PfviConfig {
    fn default() -> Self {
        Self {
            r0: 3000.0,
            dt: 1.0,
            h: 4,
            fc: 40.0,
            sat: 70.0,
            max_grid_m: 2,
            timeout_s: 30.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PfviResult {
    pub pfvi: Vec<f64>,
    pub diobs: Vec<f64>,
    pub water_distribution: Vec<f64>,        // DF
    pub rainfall: Vec<f64>,                  // RF
    pub soil_fluctuation: Vec<f64>,          // WTF
    pub water_depth: Vec<f64>,               // h depth
    pub transformation_parameters: [f64; 4], // [aH, bH, n, alpha]
    pub mse: f64,
    pub classes: Vec<String>,
    pub h_classes: Vec<String>,
    pub h_values: Vec<f64>,
    pub grid_evals: usize,
    pub fit_seconds: f64,
    pub grid_truncated: bool,
}

pub fn df(x0: f64, temp: f64, r0: f64, dt: f64) -> f64 {
    let exp_temp = (0.0905 * temp + 1.6096).exp();
    let term1 = (300.0 - x0) * (0.4982 * exp_temp - 4.268) * dt * 1e-3;
    let denom = 1.0 + 10.88 * (-0.00173582677165354 * r0).exp();
    term1 / denom
}

pub fn rf(rf_val: f64, rf_b_val: f64) -> f64 {
    if rf_b_val.is_nan() || rf_b_val <= 5.1 {
        if rf_val < 5.1 {
            0.0
        } else {
            rf_val - 5.1
        }
    } else {
        rf_val
    }
}

pub fn wtf(ah: f64, bh: f64, n: f64, h: f64, alpha: f64) -> f64 {
    let m = 1.0 - 1.0 / n;
    let ratio = if alpha.abs() > 1e-12 { h / alpha } else { 0.0 };
    let theta = (1.0 + ratio.powf(n)).powf(-m);
    ah - bh * ((1.0 - theta) * 300.0)
}

pub fn diobs(sm: f64, fc: f64, sat: f64) -> f64 {
    300.0 * (1.0 - ((sm - fc) / (sat - fc)))
}

pub fn classify_pfvi(val: f64) -> (&'static str, usize) {
    if val <= 75.0 {
        ("Low", 0)
    } else if val <= 150.0 {
        ("Moderate", 1)
    } else if val <= 225.0 {
        ("High", 2)
    } else {
        ("Extreme", 3)
    }
}

pub struct PfviComponents {
    pub pfvi: Vec<f64>,
    pub df: Vec<f64>,
    pub rf: Vec<f64>,
    pub wtf: Vec<f64>,
    pub h_depth: Vec<f64>,
}

pub fn compute_pfvi(
    wt: &[f64],
    sm: &[f64],
    rf_series: &[f64],
    rf_b: &[f64],
    temp: &[f64],
    par: &[f64; 4],
    r0: f64,
    dt: f64,
    fc: f64,
    sat: f64,
) -> PfviComponents {
    let time = wt.len();
    let mut h_depth = Vec::with_capacity(time);
    for &w in wt {
        h_depth.push(if w > 0.0 { 0.0 } else { -w });
    }

    let mut x = vec![0.0; time + 1];
    x[0] = diobs(sm[0], fc, sat);

    let mut df_series = Vec::with_capacity(time);
    let mut rf_series_out = Vec::with_capacity(time);
    let mut wtf_series = Vec::with_capacity(time);

    let ah = par[0];
    let bh = par[1];
    let n = par[2];
    let alpha = par[3];

    for i in 0..time {
        let x0 = x[i].clamp(0.0, 300.0);
        let df_val = df(x0, temp[i], r0, dt);
        let rf_val = rf(rf_series[i], rf_b[i]);
        let wtf_val = wtf(ah, bh, n, h_depth[i], alpha);

        df_series.push(df_val);
        rf_series_out.push(rf_val);
        wtf_series.push(wtf_val);

        x[i + 1] = x0 + df_val - rf_val - wtf_val;
    }

    PfviComponents {
        pfvi: x[1..].to_vec(),
        df: df_series,
        rf: rf_series_out,
        wtf: wtf_series,
        h_depth,
    }
}

pub fn pfvi_objective(
    wt: &[f64],
    sm: &[f64],
    rf_series: &[f64],
    rf_b: &[f64],
    temp: &[f64],
    par: &[f64; 4],
    r0: f64,
    dt: f64,
    fc: f64,
    sat: f64,
) -> f64 {
    // Constraint penalty
    if par[2] < 1e-4 || par[3] <= 1e-4 {
        return 1e12;
    }

    let time = wt.len();
    if time == 0 {
        return 0.0;
    }

    let ah = par[0];
    let bh = par[1];
    let n = par[2];
    let alpha = par[3];

    let mut x0 = diobs(sm[0], fc, sat);
    let mut sse = 0.0;

    for i in 0..time {
        let x_clamp = x0.clamp(0.0, 300.0);
        let df_val = df(x_clamp, temp[i], r0, dt);
        let rf_val = rf(rf_series[i], rf_b[i]);
        let h_depth_val = if wt[i] > 0.0 { 0.0 } else { -wt[i] };
        let wtf_val = wtf(ah, bh, n, h_depth_val, alpha);

        let next_x = x_clamp + df_val - rf_val - wtf_val;
        let target = diobs(sm[i], fc, sat);
        let diff = next_x - target;
        if diff.is_nan() {
            return 1e12;
        }
        sse += diff * diff;
        x0 = next_x;
    }

    sse / time as f64
}

/// Nelder-Mead Simplex optimization in 4D
pub fn nelder_mead<F>(
    mut f: F,
    start: [f64; 4],
    step: f64,
    max_iter: usize,
) -> ([f64; 4], f64, usize)
where
    F: FnMut(&[f64; 4]) -> f64,
{
    let n = 4;
    let alpha = 1.0; // reflection
    let gamma = 2.0; // expansion
    let rho = 0.5; // contraction
    let sigma = 0.5; // shrink

    // Create simplex
    let mut simplex: Vec<([f64; 4], f64)> = Vec::with_capacity(n + 1);
    let f0 = f(&start);
    simplex.push((start, f0));

    for i in 0..n {
        let mut p = start;
        p[i] += step;
        let fp = f(&p);
        simplex.push((p, fp));
    }

    let mut evals = n + 1;

    for _ in 0..max_iter {
        simplex.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        // Check convergence: range of values
        let diff = simplex[n].1 - simplex[0].1;
        if diff.abs() < 1e-6 {
            break;
        }

        // Centroid of best n vertices (excluding worst vertex n)
        let mut centroid = [0.0; 4];
        for i in 0..n {
            for d in 0..4 {
                centroid[d] += simplex[i].0[d];
            }
        }
        for d in 0..4 {
            centroid[d] /= n as f64;
        }

        // Reflection
        let worst = &simplex[n];
        let mut xr = [0.0; 4];
        for d in 0..4 {
            xr[d] = centroid[d] + alpha * (centroid[d] - worst.0[d]);
        }
        let fr = f(&xr);
        evals += 1;

        if fr < simplex[n - 1].1 && fr >= simplex[0].1 {
            simplex[n] = (xr, fr);
            continue;
        }

        // Expansion
        if fr < simplex[0].1 {
            let mut xe = [0.0; 4];
            for d in 0..4 {
                xe[d] = centroid[d] + gamma * (xr[d] - centroid[d]);
            }
            let fe = f(&xe);
            evals += 1;
            if fe < fr {
                simplex[n] = (xe, fe);
            } else {
                simplex[n] = (xr, fr);
            }
            continue;
        }

        // Contraction
        if fr < worst.1 {
            // Outside contraction
            let mut xc = [0.0; 4];
            for d in 0..4 {
                xc[d] = centroid[d] + rho * (xr[d] - centroid[d]);
            }
            let fc = f(&xc);
            evals += 1;
            if fc <= fr {
                simplex[n] = (xc, fc);
                continue;
            }
        } else {
            // Inside contraction
            let mut xc = [0.0; 4];
            for d in 0..4 {
                xc[d] = centroid[d] - rho * (centroid[d] - worst.0[d]);
            }
            let fc = f(&xc);
            evals += 1;
            if fc < worst.1 {
                simplex[n] = (xc, fc);
                continue;
            }
        }

        // Shrink toward best
        let best_pt = simplex[0].0;
        for i in 1..=n {
            for d in 0..4 {
                simplex[i].0[d] = best_pt[d] + sigma * (simplex[i].0[d] - best_pt[d]);
            }
            simplex[i].1 = f(&simplex[i].0);
            evals += 1;
        }
    }

    simplex.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    (simplex[0].0, simplex[0].1, evals)
}

pub fn fit_pfvi(
    wt: &[f64],
    sm: &[f64],
    rf_series: &[f64],
    temp: &[f64],
    config: &PfviConfig,
) -> Result<PfviResult, PfrsimError> {
    let start_time = std::time::Instant::now();
    let time = wt.len();
    if time < 4 {
        return Err(PfrsimError::validation(
            "VALIDATION_TOO_SHORT",
            "PFVI requires at least 4 observations",
            None,
        ));
    }

    // Build Rf_b: Rf_b = lag-1 with trailing NA
    let mut rf_b = Vec::with_capacity(time);
    for i in 0..time - 1 {
        rf_b.push(rf_series[i]);
    }
    rf_b.push(f64::NAN); // trailing NA per parity spec

    let r0 = config.r0;
    let dt = config.dt;
    let fc = config.fc;
    let sat = config.sat;

    let mut total_evals = 0;
    let mut h_depth = Vec::with_capacity(time);
    for &w in wt {
        h_depth.push(if w > 0.0 { 0.0 } else { -w });
    }
    let mut targets = Vec::with_capacity(time);
    for &s in sm {
        targets.push(diobs(s, fc, sat));
    }
    let mut rf_vals = Vec::with_capacity(time);
    for i in 0..time {
        rf_vals.push(rf(rf_series[i], rf_b[i]));
    }

    // For large datasets, calibrate Van Genuchten physical parameters [aH, bH, n, alpha]
    // on the most recent 2,500 observations (encompassing the active hydrological regime + forecast horizon)
    // to prevent Nelder-Mead from evaluating tens of billions of transcendental operations.
    let calib_window = 2500;
    let (calib_start, calib_len) = if time > calib_window {
        (time - calib_window, calib_window)
    } else {
        (0, time)
    };

    let calib_temp = &temp[calib_start..];
    let calib_h_depth = &h_depth[calib_start..];
    let calib_targets = &targets[calib_start..];
    let calib_rf_vals = &rf_vals[calib_start..];
    let denom = 1.0 + 10.88 * (-0.00173582677165354 * r0).exp();
    let mut calib_df_factor = Vec::with_capacity(calib_len);
    for &t_val in calib_temp {
        let exp_temp = (0.0905 * t_val + 1.6096).exp();
        let factor = (0.4982 * exp_temp - 4.268) * dt * 1e-3 / denom;
        calib_df_factor.push(factor);
    }

    let cost = |par: &[f64; 4]| -> f64 {
        if par[2] < 1e-4 || par[3] <= 1e-4 {
            return 1e12;
        }
        let ah = par[0];
        let bh = par[1];
        let n = par[2];
        let alpha = par[3];
        let m = 1.0 - 1.0 / n;
        let inv_alpha = 1.0 / alpha;

        let mut x0 = calib_targets[0];
        let mut sse = 0.0;

        for i in 0..calib_len {
            let x_clamp = x0.clamp(0.0, 300.0);
            let df_val = (300.0 - x_clamp) * calib_df_factor[i];
            let ratio = calib_h_depth[i] * inv_alpha;
            let theta = (1.0 + ratio.powf(n)).powf(-m);
            let wtf_val = ah - bh * ((1.0 - theta) * 300.0);

            let next_x = x_clamp + df_val - calib_rf_vals[i] - wtf_val;
            let diff = next_x - calib_targets[i];
            if diff.is_nan() {
                return 1e12;
            }
            sse += diff * diff;
            x0 = next_x;
        }

        sse / calib_len as f64
    };

    // Initial Nelder-Mead from [0.1, 0.1, 0.1, 0.1]
    let initial_par = [0.1, 0.1, 0.1, 0.1];
    let (mut best_par, mut min_val, evals) = nelder_mead(cost, initial_par, 0.05, 300);
    total_evals += evals;

    let par3 = best_par[2];
    let max_grid_m = config.max_grid_m.clamp(1, 3);
    let mut grid_truncated = false;

    let m = if par3 > 0.0 {
        let raw_m = (1.0 / par3).floor() as usize;
        if raw_m > max_grid_m {
            grid_truncated = true;
        }
        raw_m.clamp(1, max_grid_m)
    } else {
        1
    };

    // Bounded grid polish
    'grid_loop: for i in 1..=m {
        for j in 1..=m {
            for k in 1..=m {
                for l in 1..=m {
                    if start_time.elapsed().as_secs_f64() > config.timeout_s {
                        grid_truncated = true;
                        break 'grid_loop;
                    }

                    let grid_point = [
                        0.2 * i as f64,
                        0.2 * j as f64,
                        0.2 * k as f64,
                        0.2 * l as f64,
                    ];
                    // Refine twice per R spec
                    let (opt1, _, e1) = nelder_mead(cost, grid_point, 0.05, 50);
                    let (opt2, val2, e2) = nelder_mead(cost, opt1, 0.05, 50);
                    total_evals += e1 + e2;

                    if opt2[2] >= 0.0 && opt2[3] > 0.0 && val2 < min_val {
                        min_val = val2;
                        best_par = opt2;
                    }
                }
            }
        }
    }

    // Final polish
    let (final_params, final_mse, final_evals) = nelder_mead(cost, best_par, 0.02, 200);
    total_evals += final_evals;

    // Compute final components
    let components = compute_pfvi(
        wt,
        sm,
        rf_series,
        &rf_b,
        temp,
        &final_params,
        r0,
        dt,
        fc,
        sat,
    );

    let mut pfvi_clipped = Vec::with_capacity(time);
    let mut diobs_clipped = Vec::with_capacity(time);
    let mut classes = if time <= 2500 {
        Vec::with_capacity(time)
    } else {
        Vec::new()
    };

    let h = config.h.min(time);
    let h_start = time - h;
    let mut h_classes = Vec::with_capacity(h);
    let mut h_values = Vec::with_capacity(h);

    for i in 0..time {
        let p_clip = components.pfvi[i].clamp(0.0, 300.0);
        let d_clip = diobs(sm[i], fc, sat).clamp(0.0, 300.0);
        let (cls, _) = classify_pfvi(p_clip);

        pfvi_clipped.push(p_clip);
        diobs_clipped.push(d_clip);
        if time <= 2500 {
            classes.push(cls.to_string());
        }
        if i >= h_start {
            h_classes.push(cls.to_string());
            h_values.push(p_clip);
        }
    }
    let fit_seconds = start_time.elapsed().as_secs_f64();

    Ok(PfviResult {
        pfvi: pfvi_clipped,
        diobs: diobs_clipped,
        water_distribution: components.df,
        rainfall: components.rf,
        soil_fluctuation: components.wtf,
        water_depth: components.h_depth,
        transformation_parameters: final_params,
        mse: final_mse,
        classes,
        h_classes,
        h_values,
        grid_evals: total_evals,
        fit_seconds,
        grid_truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_formulas() {
        // DF check
        let d = df(150.0, 35.0, 2700.0, 1.0);
        assert!(d > 0.0);

        // RF check
        assert_eq!(rf(2.0, 1.0), 0.0);
        assert_eq!(rf(10.0, 1.0), 4.9);
        assert_eq!(rf(10.0, 6.0), 10.0);

        // DIobs check
        assert_eq!(diobs(40.0, 40.0, 70.0), 300.0);
        assert_eq!(diobs(70.0, 40.0, 70.0), 0.0);
        assert_eq!(diobs(55.0, 40.0, 70.0), 150.0);

        // Classify check
        assert_eq!(classify_pfvi(50.0).0, "Low");
        assert_eq!(classify_pfvi(120.0).0, "Moderate");
        assert_eq!(classify_pfvi(180.0).0, "High");
        assert_eq!(classify_pfvi(250.0).0, "Extreme");
    }

    #[test]
    fn test_fit_pfvi_smoke() {
        let wt = vec![-1.0, -0.9, -1.1, -1.2, -1.0, -1.1, -1.3, -2.0];
        let sm = vec![35.4, 36.0, 37.2, 38.4, 31.4, 33.2, 30.1, 30.2];
        let rf = vec![
            0.0001, 0.0002, 0.0001, 0.0003, 0.0002, 0.0004, 0.0005, 0.0004,
        ];
        let temp = vec![35.4, 35.8, 36.0, 36.5, 36.3, 37.2, 37.0, 38.1];

        let config = PfviConfig {
            r0: 2700.0,
            dt: 1.0,
            h: 4,
            fc: 40.0,
            sat: 70.0,
            max_grid_m: 1,
            timeout_s: 5.0,
        };

        let res = fit_pfvi(&wt, &sm, &rf, &temp, &config).expect("fit_pfvi should succeed");
        assert_eq!(res.pfvi.len(), 8);
        assert_eq!(res.diobs.len(), 8);
        assert_eq!(res.h_classes.len(), 4);
        assert_eq!(res.h_values.len(), 4);
        assert!(res.mse >= 0.0);
    }
}
