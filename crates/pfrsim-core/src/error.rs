use serde::{Deserialize, Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
pub enum PfrsimError {
    #[error("Validation error [{code}]: {message}")]
    ValidationError {
        code: String,
        message: String,
        fields: Option<Vec<String>>,
    },

    #[error("Impute error [{code}]: {message}")]
    ImputeError {
        code: String,
        message: String,
        fields: Option<Vec<String>>,
    },

    #[error("Forecast error [{code}]: {message}")]
    ForecastError {
        code: String,
        message: String,
        fields: Option<Vec<String>>,
    },

    #[error("PFVI error [{code}]: {message}")]
    PfviError {
        code: String,
        message: String,
    },

    #[error("Job error [{code}]: {message}")]
    JobError {
        code: String,
        message: String,
    },

    #[error("Dataset error [{code}]: {message}")]
    DatasetError {
        code: String,
        message: String,
    },

    #[error("Run error [{code}]: {message}")]
    RunError {
        code: String,
        message: String,
    },

    #[error("Artifact error [{code}]: {message}")]
    ArtifactError {
        code: String,
        message: String,
    },

    #[error("Not implemented [{code}]: {message}")]
    NotImplemented {
        code: String,
        message: String,
    },

    #[error("Database error [{code}]: {message}")]
    DatabaseError {
        code: String,
        message: String,
    },

    #[error("IO error [{code}]: {message}")]
    IoError {
        code: String,
        message: String,
    },
}

impl PfrsimError {
    pub fn code(&self) -> &str {
        match self {
            Self::ValidationError { code, .. } => code,
            Self::ImputeError { code, .. } => code,
            Self::ForecastError { code, .. } => code,
            Self::PfviError { code, .. } => code,
            Self::JobError { code, .. } => code,
            Self::DatasetError { code, .. } => code,
            Self::RunError { code, .. } => code,
            Self::ArtifactError { code, .. } => code,
            Self::NotImplemented { code, .. } => code,
            Self::DatabaseError { code, .. } => code,
            Self::IoError { code, .. } => code,
        }
    }

    pub fn message(&self) -> &str {
        match self {
            Self::ValidationError { message, .. } => message,
            Self::ImputeError { message, .. } => message,
            Self::ForecastError { message, .. } => message,
            Self::PfviError { message, .. } => message,
            Self::JobError { message, .. } => message,
            Self::DatasetError { message, .. } => message,
            Self::RunError { message, .. } => message,
            Self::ArtifactError { message, .. } => message,
            Self::NotImplemented { message, .. } => message,
            Self::DatabaseError { message, .. } => message,
            Self::IoError { message, .. } => message,
        }
    }

    pub fn fields(&self) -> Option<&[String]> {
        match self {
            Self::ValidationError { fields, .. } | Self::ImputeError { fields, .. } | Self::ForecastError { fields, .. } => {
                fields.as_deref()
            }
            _ => None,
        }
    }

    pub fn validation(code: impl Into<String>, message: impl Into<String>, fields: Option<Vec<String>>) -> Self {
        Self::ValidationError {
            code: code.into(),
            message: message.into(),
            fields,
        }
    }

    pub fn impute_edge_na(cells: Vec<String>) -> Self {
        Self::ImputeError {
            code: "IMPUTE_EDGE_NA".to_string(),
            message: "Linear interpolation leaves leading or trailing NaN values; cannot proceed to forecasting.".to_string(),
            fields: Some(cells),
        }
    }

    pub fn impute_too_sparse(message: impl Into<String>) -> Self {
        Self::ImputeError {
            code: "IMPUTE_TOO_SPARSE".to_string(),
            message: message.into(),
            fields: None,
        }
    }

    pub fn job_busy() -> Self {
        Self::JobError {
            code: "JOB_BUSY".to_string(),
            message: "Another training job is currently running.".to_string(),
        }
    }

    pub fn not_implemented(feature: impl Into<String>) -> Self {
        let f = feature.into();
        Self::NotImplemented {
            code: "NOT_IMPLEMENTED".to_string(),
            message: format!("Feature '{f}' is planned for Phase 5 and not available in v1."),
        }
    }

    pub fn not_found(entity: &str, id: &str) -> Self {
        Self::ArtifactError {
            code: "ARTIFACT_NOT_FOUND".to_string(),
            message: format!("{entity} '{id}' was not found."),
        }
    }

    pub fn db(err: impl std::fmt::Display) -> Self {
        Self::DatabaseError {
            code: "DATABASE_ERROR".to_string(),
            message: err.to_string(),
        }
    }

    pub fn io(err: impl std::fmt::Display) -> Self {
        Self::IoError {
            code: "IO_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}

/// Serialized wrapper for Tauri commands: `{ok: true, data}` or `{ok: false, code, message, fields?}`
#[derive(Debug, Clone, Deserialize)]
pub enum CommandOutput<T> {
    Success(T),
    Failure(PfrsimError),
}

impl<T: Serialize> Serialize for CommandOutput<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        match self {
            Self::Success(data) => {
                map.serialize_entry("ok", &true)?;
                map.serialize_entry("data", data)?;
            }
            Self::Failure(err) => {
                map.serialize_entry("ok", &false)?;
                map.serialize_entry("code", err.code())?;
                map.serialize_entry("message", err.message())?;
                if let Some(fields) = err.fields() {
                    map.serialize_entry("fields", fields)?;
                }
            }
        }
        map.end()
    }
}

impl<T> From<Result<T, PfrsimError>> for CommandOutput<T> {
    fn from(res: Result<T, PfrsimError>) -> Self {
        match res {
            Ok(val) => Self::Success(val),
            Err(err) => Self::Failure(err),
        }
    }
}

impl From<rusqlite::Error> for PfrsimError {
    fn from(err: rusqlite::Error) -> Self {
        Self::db(err)
    }
}

impl From<std::io::Error> for PfrsimError {
    fn from(err: std::io::Error) -> Self {
        Self::io(err)
    }
}

impl From<serde_json::Error> for PfrsimError {
    fn from(err: serde_json::Error) -> Self {
        Self::ArtifactError {
            code: "JSON_ERROR".to_string(),
            message: err.to_string(),
        }
    }
}
