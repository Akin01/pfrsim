use burn::backend::ndarray::NdArrayDevice;
use burn::backend::wgpu::WgpuDevice;
use burn::backend::{Autodiff, NdArray, Wgpu};
use burn::module::{AutodiffModule, Module};
use burn::nn::{Linear, LinearConfig, Lstm, LstmConfig};
use burn::optim::{AdamConfig, GradientsParams, Optimizer};
use burn::tensor::{Tensor, TensorData};

use crate::error::PfrsimError;
use crate::forecaster::{
    ArimaVariableInfo, EpochCallback, ForecastMetrics, ForecastResult, Forecaster,
    ForecasterConfig, HoldoutMetrics,
};
use crate::ingest::ColumnData;

pub struct LstmForecaster;

#[derive(Module, Debug)]
struct LstmNet<B: burn::tensor::backend::Backend> {
    lstm: Lstm<B>,
    linear: Linear<B>,
    hidden_dim: usize,
}

impl<B: burn::tensor::backend::Backend> LstmNet<B> {
    fn new(input_dim: usize, hidden_dim: usize, device: &B::Device) -> Self {
        let lstm = LstmConfig::new(input_dim, hidden_dim, true).init::<B>(device);
        let linear = LinearConfig::new(hidden_dim, 1).init::<B>(device);
        Self {
            lstm,
            linear,
            hidden_dim,
        }
    }

    fn forward(&self, x: Tensor<B, 3>) -> Tensor<B, 2> {
        let seq_len = x.dims()[1];
        let (out, _) = self.lstm.forward(x.clone(), None);
        let last = out
            .slice([0..x.dims()[0], (seq_len - 1)..seq_len, 0..self.hidden_dim])
            .reshape([x.dims()[0], self.hidden_dim]);
        self.linear.forward(last)
    }
}

macro_rules! define_fit_and_forecast_lstm {
    ($fn_name:ident, $backend:ty, $device_type:ty) => {
        fn $fn_name(
            full_series: &[f64],
            h: usize,
            look_back_param: usize,
            epochs_param: usize,
            hidden_dim_param: usize,
            batch_size_param: usize,
            learning_rate_param: f64,
            var_name: &str,
            device: &$device_type,
            on_epoch: Option<&EpochCallback<'_>>,
        ) -> (Vec<f64>, ArimaVariableInfo, Option<String>) {
            let max_samples = 2500;
            let series = if full_series.len() > max_samples {
                &full_series[(full_series.len() - max_samples)..]
            } else {
                full_series
            };
            let n = series.len();
            let mut warning = None;
            let min_val = series.iter().cloned().fold(f64::INFINITY, f64::min);
            let max_val = series.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let range = if (max_val - min_val).abs() < 1e-8 {
                1.0
            } else {
                max_val - min_val
            };

            let scaled: Vec<f64> = series.iter().map(|&v| (v - min_val) / range).collect();

            let look_back = if n <= look_back_param + 2 {
                (n / 3).max(1).min(look_back_param)
            } else {
                look_back_param
            };

            let n_samples = n.saturating_sub(look_back);
            let split_idx = ((n_samples as f64 * 0.8).floor() as usize).max(1);
            let n_train = split_idx.min(n_samples);
            let n_test = n_samples.saturating_sub(n_train);

            let hidden_dim = hidden_dim_param.clamp(4, 64);
            let mut model = LstmNet::<$backend>::new(1, hidden_dim, device);
            let mut optim = AdamConfig::new().init::<$backend, LstmNet<$backend>>();

            let epochs = epochs_param.clamp(10, 500);

            if let Some(cb) = on_epoch {
                cb(var_name, 0, epochs);
            }
            if n_train > 0 {
                let mut flat_x = Vec::with_capacity(n_train * look_back);
                let mut flat_y = Vec::with_capacity(n_train);
                for i in 0..n_train {
                    for &v in &scaled[i..(i + look_back)] {
                        flat_x.push(v as f32);
                    }
                    flat_y.push(scaled[i + look_back] as f32);
                }

                let input = Tensor::<$backend, 3>::from_data(
                    TensorData::new(flat_x, [n_train, look_back, 1]),
                    device,
                );
                let target =
                    Tensor::<$backend, 2>::from_data(TensorData::new(flat_y, [n_train, 1]), device);
                let effective_batch_size = if batch_size_param == 0 || batch_size_param >= n_train {
                    n_train
                } else {
                    batch_size_param.max(1)
                };
                let num_batches = (n_train + effective_batch_size - 1) / effective_batch_size;
                let lr = learning_rate_param.clamp(1e-5, 1.0);
                for epoch in 1..=epochs {
                    if num_batches <= 1 {
                        let pred = model.forward(input.clone());
                        let loss = (pred - target.clone()).powf_scalar(2.0).mean();
                        let grads = loss.backward();
                        let grads = GradientsParams::from_grads::<$backend, _>(grads, &model);
                        model = optim.step(lr, model, grads);
                    } else {
                        for b in 0..num_batches {
                            let start = b * effective_batch_size;
                            let end = (start + effective_batch_size).min(n_train);
                            let batch_in = input.clone().slice([start..end, 0..look_back, 0..1]);
                            let batch_target = target.clone().slice([start..end, 0..1]);

                            let pred = model.forward(batch_in);
                            let loss = (pred - batch_target).powf_scalar(2.0).mean();
                            let grads = loss.backward();
                            let grads = GradientsParams::from_grads::<$backend, _>(grads, &model);
                            model = optim.step(lr, model, grads);
                        }
                    }
                    if let Some(cb) = on_epoch {
                        if epochs <= 30 || epoch == 1 || epoch % 2 == 0 || epoch == epochs {
                            cb(var_name, epoch, epochs);
                        }
                    }
                }
            }

            // 4. Holdout Evaluation
            let valid_model = model.valid();
            type Inner = <$backend as burn::tensor::backend::AutodiffBackend>::InnerBackend;
            let holdout = if n_test > 0 {
                let mut test_flat_x = Vec::with_capacity(n_test * look_back);
                let mut actuals = Vec::with_capacity(n_test);
                for j in 0..n_test {
                    let sample_idx = split_idx + j;
                    for &v in &scaled[sample_idx..(sample_idx + look_back)] {
                        test_flat_x.push(v as f32);
                    }
                    actuals.push(scaled[sample_idx + look_back] * range + min_val);
                }
                let test_input = Tensor::<Inner, 3>::from_data(
                    TensorData::new(test_flat_x, [n_test, look_back, 1]),
                    device,
                );
                let pred_tensor = valid_model.forward(test_input);
                let pred_vec: Vec<f32> = pred_tensor.into_data().to_vec().unwrap();
                let preds: Vec<f64> = pred_vec
                    .into_iter()
                    .map(|v| v as f64 * range + min_val)
                    .collect();

                let mse = smartcore::metrics::mean_squared_error(&actuals, &preds);
                let mae = smartcore::metrics::mean_absolute_error(&actuals, &preds);
                let rmse = mse.sqrt();
                Some(HoldoutMetrics { mse, rmse, mae })
            } else {
                None
            };

            // 5. Iterative Forecasting
            let mut current_seq = scaled[(n - look_back)..].to_vec();
            let mut forecast = Vec::with_capacity(h);

            for _ in 0..h {
                let x_floats: Vec<f32> = current_seq.iter().map(|&v| v as f32).collect();
                let input = Tensor::<Inner, 3>::from_data(
                    TensorData::new(x_floats, [1, look_back, 1]),
                    device,
                );
                let pred_tensor = valid_model.forward(input);
                let next_scaled = (pred_tensor.into_scalar() as f64).clamp(0.0, 1.5);
                let mut next_val = next_scaled * range + min_val;

                if var_name == "Rf" && next_val < 0.0 {
                    next_val = 0.0;
                }
                if var_name == "SM" {
                    if next_val > 100.0 {
                        next_val = 100.0;
                    }
                    if next_val < 0.0 {
                        warning = Some("FORECAST_SM_UNBOUNDED_BELOW".to_string());
                    }
                }

                forecast.push(next_val);
                current_seq.remove(0);
                current_seq.push(next_scaled);
            }

            let info = ArimaVariableInfo {
                order: (look_back, 1, hidden_dim),
                aic: 0.0,
                bic: 0.0,
                ljungbox_p: 0.5,
                lambda: 1.0,
                k: 0.0,
                holdout,
            };

            (forecast, info, warning)
        }
    };
}

define_fit_and_forecast_lstm!(
    fit_and_forecast_lstm_cpu,
    Autodiff<NdArray<f32>>,
    NdArrayDevice
);
define_fit_and_forecast_lstm!(fit_and_forecast_lstm_gpu, Autodiff<Wgpu>, WgpuDevice);
impl Forecaster for LstmForecaster {
    fn id(&self) -> &'static str {
        "lstm"
    }

    fn forecast(
        &self,
        data: &ColumnData,
        config: &ForecasterConfig,
        h: usize,
        _seed: u64,
        on_epoch: Option<&EpochCallback<'_>>,
    ) -> Result<ForecastResult, PfrsimError> {
        let look_back = config.lstm.as_ref().map(|c| c.look_back).unwrap_or(12);
        let epochs = config.lstm.as_ref().map(|c| c.epochs).unwrap_or(100);
        let hidden_dim = config
            .lstm
            .as_ref()
            .and_then(|c| c.layer_units.first().copied())
            .unwrap_or(16);
        let batch_size = config.lstm.as_ref().map(|c| c.batch_size).unwrap_or(32);
        let learning_rate = config
            .lstm
            .as_ref()
            .map(|c| c.learning_rate)
            .unwrap_or(0.02);
        let device_str = config
            .lstm
            .as_ref()
            .map(|c| c.device.as_str())
            .unwrap_or("cpu");
        let use_gpu = device_str.eq_ignore_ascii_case("gpu");
        let gpu_device = if use_gpu {
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(WgpuDevice::default)).ok()
        } else {
            None
        };
        let cpu_device = Default::default();

        let fit_var = |series: &[f64], name: &str| {
            if let Some(dev) = &gpu_device {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    fit_and_forecast_lstm_gpu(
                        series,
                        h,
                        look_back,
                        epochs,
                        hidden_dim,
                        batch_size,
                        learning_rate,
                        name,
                        dev,
                        on_epoch,
                    )
                })) {
                    Ok(res) => res,
                    Err(_) => fit_and_forecast_lstm_cpu(
                        series,
                        h,
                        look_back,
                        epochs,
                        hidden_dim,
                        batch_size,
                        learning_rate,
                        name,
                        &cpu_device,
                        on_epoch,
                    ),
                }
            } else {
                fit_and_forecast_lstm_cpu(
                    series,
                    h,
                    look_back,
                    epochs,
                    hidden_dim,
                    batch_size,
                    learning_rate,
                    name,
                    &cpu_device,
                    on_epoch,
                )
            }
        };

        let (wt_res, sm_res, rf_res, temp_res) = std::thread::scope(|s| {
            let h_wt = s.spawn(|| fit_var(&data.wt, "WT"));
            let h_sm = s.spawn(|| fit_var(&data.sm, "SM"));
            let h_rf = s.spawn(|| fit_var(&data.rf, "Rf"));
            let h_temp = s.spawn(|| fit_var(&data.temp, "Temp"));

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
            forecaster_id: "lstm".to_string(),
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
    fn test_lstm_forecast() {
        let series = vec![10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0];
        let cpu_dev = Default::default();
        let (fc, info, _) =
            fit_and_forecast_lstm_cpu(&series, 4, 3, 15, 16, 32, 0.02, "SM", &cpu_dev, None);
        for &v in &fc {
            assert!(!v.is_nan());
            assert!(v > 0.0);
        }
        assert!(info.holdout.is_some());
    }

    #[test]
    fn test_lstm_full_batch_forecast() {
        let series = vec![10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0];
        let cpu_dev = Default::default();
        // batch_size_param = 0 (Full batch)
        let (fc, info, _) =
            fit_and_forecast_lstm_cpu(&series, 4, 3, 10, 16, 0, 0.02, "SM", &cpu_dev, None);
        assert_eq!(fc.len(), 4);
        for &v in &fc {
            assert!(!v.is_nan());
        }
        assert!(info.holdout.is_some());
    }
}
