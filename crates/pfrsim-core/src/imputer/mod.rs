pub mod knn;
pub mod linear;
pub mod loess;
pub mod spline;

use serde::{Deserialize, Serialize};

use crate::error::PfrsimError;
use crate::ingest::ColumnData;

fn default_k() -> usize {
    5
}

fn default_span() -> f64 {
    0.5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImputerConfig {
    pub id: String,
    #[serde(default = "default_k")]
    pub k: usize,
    #[serde(default = "default_span")]
    pub span: f64,
}

impl Default for ImputerConfig {
    fn default() -> Self {
        Self {
            id: "knn".to_string(),
            k: 5,
            span: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImputeMask {
    pub wt: Vec<bool>,
    pub sm: Vec<bool>,
    pub rf: Vec<bool>,
    pub temp: Vec<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImputeFlags {
    pub edge_na: bool,
    pub overshoot: bool,
    pub sparse_abort: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImputeResult {
    pub imputer_id: String,
    pub imputed: ColumnData,
    pub mask: ImputeMask,
    pub flags: ImputeFlags,
    pub n_imputed: usize,
    pub frac_imputed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImputerDescriptor {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub description: String,
    pub params_schema: serde_json::Value,
    pub tooltip: String,
}

pub trait Imputer: Send + Sync {
    fn id(&self) -> &'static str;
    fn impute(
        &self,
        columns: &ColumnData,
        config: &ImputerConfig,
        seed: u64,
    ) -> Result<ImputeResult, PfrsimError>;
}

pub fn get_imputer(id: &str) -> Result<Box<dyn Imputer>, PfrsimError> {
    match id.to_lowercase().as_str() {
        "knn" => Ok(Box::new(knn::KnnImputer)),
        "linear" => Ok(Box::new(linear::LinearImputer)),
        "spline" => Ok(Box::new(spline::SplineImputer)),
        "loess" => Ok(Box::new(loess::LoessImputer)),
        _ => Err(PfrsimError::validation(
            "INVALID_IMPUTER",
            format!("Unknown imputer id '{id}'. Available: knn, linear, spline, loess"),
            None,
        )),
    }
}

pub fn list_imputers() -> Vec<ImputerDescriptor> {
    vec![
        ImputerDescriptor {
            id: "knn".to_string(),
            name: "k-Nearest Neighbors (kNN)".to_string(),
            enabled: true,
            description: "Joint 4-variable similarity imputation across time steps".to_string(),
            params_schema: serde_json::json!({
                "k": { "type": "integer", "default": 5, "minimum": 1, "description": "Number of nearest neighbors" }
            }),
            tooltip:
                "Fills missing values using pattern similarity across multi-sensor observations."
                    .to_string(),
        },
        ImputerDescriptor {
            id: "linear".to_string(),
            name: "Linear Interpolation".to_string(),
            enabled: true,
            description: "Fast linear interpolation between observed points".to_string(),
            params_schema: serde_json::json!({}),
            tooltip: "Fast linear interpolation between observed gap boundaries.".to_string(),
        },
        ImputerDescriptor {
            id: "spline".to_string(),
            name: "Cubic Spline Interpolation".to_string(),
            enabled: true,
            description: "Smooth cubic spline interpolation".to_string(),
            params_schema: serde_json::json!({}),
            tooltip: "Smooth cubic curve interpolation for natural continuous trajectories."
                .to_string(),
        },
        ImputerDescriptor {
            id: "loess".to_string(),
            name: "LOESS Interpolation".to_string(),
            enabled: true,
            description: "Locally estimated scatterplot smoothing across time (Cleveland)"
                .to_string(),
            params_schema: serde_json::json!({
                "span": { "type": "number", "default": 0.5, "minimum": 0.05, "maximum": 1.0, "description": "Neighborhood smoothing span" }
            }),
            tooltip: "Adaptive local regression smoothing robust to nonlinear sensor fluctuations."
                .to_string(),
        },
    ]
}
