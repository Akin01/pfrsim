pub mod arima;
pub mod gru;
pub mod lstm;

use serde::{Deserialize, Serialize};

use crate::error::PfrsimError;
use crate::ingest::ColumnData;

fn default_split_ratio() -> f64 {
    0.2
}

fn default_arima_learning_rate() -> f64 {
    0.01
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArimaConfig {
    #[serde(default = "default_split_ratio")]
    pub test_split_ratio: f64,
    #[serde(default = "default_arima_learning_rate")]
    pub learning_rate: f64,
}

impl Default for ArimaConfig {
    fn default() -> Self {
        Self {
            test_split_ratio: 0.2,
            learning_rate: 0.01,
        }
    }
}

fn default_device() -> String {
    "cpu".to_string()
}

fn default_learning_rate() -> f64 {
    0.02
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NnConfig {
    pub look_back: usize,
    pub layer_units: Vec<usize>,
    pub epochs: usize,
    pub batch_size: usize,
    #[serde(default = "default_learning_rate")]
    pub learning_rate: f64,
    #[serde(default = "default_device")]
    pub device: String,
}

impl Default for NnConfig {
    fn default() -> Self {
        Self {
            look_back: 12,
            layer_units: vec![32, 32],
            epochs: 100,
            batch_size: 32,
            learning_rate: 0.02,
            device: "cpu".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecasterConfig {
    pub id: String,
    #[serde(default)]
    pub arima: ArimaConfig,
    pub lstm: Option<NnConfig>,
    pub gru: Option<NnConfig>,
}

impl Default for ForecasterConfig {
    fn default() -> Self {
        Self {
            id: "arima".to_string(),
            arima: ArimaConfig::default(),
            lstm: None,
            gru: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoldoutMetrics {
    pub mse: f64,
    pub rmse: f64,
    pub mae: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArimaVariableInfo {
    pub order: (usize, usize, usize), // (p, d, q)
    pub aic: f64,
    pub bic: f64,
    pub ljungbox_p: f64,
    pub lambda: f64,
    pub k: f64,
    pub holdout: Option<HoldoutMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastMetrics {
    pub wt: ArimaVariableInfo,
    pub sm: ArimaVariableInfo,
    pub rf: ArimaVariableInfo,
    pub temp: ArimaVariableInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastResult {
    pub forecaster_id: String,
    pub h: usize,
    pub forecast: ColumnData,
    pub metrics: ForecastMetrics,
    pub flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecasterDescriptor {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub description: String,
    pub reason: Option<String>,
    pub params_schema: serde_json::Value,
    pub tooltip: String,
}
pub type EpochCallback<'a> = dyn Fn(&str, usize, usize) + Send + Sync + 'a;

pub trait Forecaster: Send + Sync {
    fn id(&self) -> &'static str;
    fn forecast(
        &self,
        data: &ColumnData,
        config: &ForecasterConfig,
        h: usize,
        seed: u64,
        on_epoch: Option<&EpochCallback<'_>>,
    ) -> Result<ForecastResult, PfrsimError>;
}
pub fn get_forecaster(id: &str) -> Result<Box<dyn Forecaster>, PfrsimError> {
    match id.to_lowercase().as_str() {
        "arima" => Ok(Box::new(arima::ArimaForecaster)),
        "lstm" => Ok(Box::new(lstm::LstmForecaster)),
        "gru" => Ok(Box::new(gru::GruForecaster)),
        _ => Err(PfrsimError::validation(
            "INVALID_FORECASTER",
            format!("Unknown forecaster id '{id}'. Available: arima (v1), lstm, gru"),
            None,
        )),
    }
}

pub fn list_forecasters() -> Vec<ForecasterDescriptor> {
    vec![
        ForecasterDescriptor {
            id: "arima".to_string(),
            name: "AutoARIMA + Box-Cox".to_string(),
            enabled: true,
            description: "Automated ARIMA order search with profile-likelihood Box-Cox transformation".to_string(),
            reason: None,
            params_schema: serde_json::json!({
                "test_split_ratio": { "type": "number", "default": 0.2, "minimum": 0.05, "maximum": 0.5, "description": "Holdout evaluation ratio" },
                "learning_rate": { "type": "number", "default": 0.01, "minimum": 0.0001, "maximum": 1.0, "description": "Refinement gradient descent learning rate" }
            }),
            tooltip: "Automated statistical model best suited for seasonal trends and baseline forecasts.".to_string(),
        },
        ForecasterDescriptor {
            id: "lstm".to_string(),
            name: "LSTM (Long Short-Term Memory)".to_string(),
            enabled: true,
            description: "Deep recurrent neural network with Adam optimizer and sequence lookback".to_string(),
            reason: None,
            params_schema: serde_json::json!({
                "look_back": { "type": "integer", "default": 12, "minimum": 1 },
                "epochs": { "type": "integer", "default": 100, "minimum": 10, "maximum": 500 },
                "batch_size": { "type": "integer", "default": 32, "minimum": 0, "description": "Mini-batch size (0 = Full Batch)" },
                "learning_rate": { "type": "number", "default": 0.02, "minimum": 0.0001, "maximum": 1.0, "description": "Adam optimizer learning rate" }
            }),
            tooltip: "Deep learning neural network capable of capturing long-term temporal dependencies.".to_string(),
        },
        ForecasterDescriptor {
            id: "gru".to_string(),
            name: "GRU (Gated Recurrent Unit)".to_string(),
            enabled: true,
            description: "Gated recurrent neural network with Adam optimizer and sequence lookback".to_string(),
            reason: None,
            params_schema: serde_json::json!({
                "look_back": { "type": "integer", "default": 12, "minimum": 1 },
                "epochs": { "type": "integer", "default": 100, "minimum": 10, "maximum": 500 },
                "batch_size": { "type": "integer", "default": 32, "minimum": 0, "description": "Mini-batch size (0 = Full Batch)" },
                "learning_rate": { "type": "number", "default": 0.02, "minimum": 0.0001, "maximum": 1.0, "description": "Adam optimizer learning rate" }
            }),
            tooltip: "Fast and efficient recurrent neural network for learning dynamic peatland trends.".to_string(),
        },
    ]
}
