use chrono::Utc;
use parking_lot::Mutex;
use polars::prelude::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::error::PfrsimError;
use crate::ingest::{ColumnData, Dataset, DatasetPreview, RowPreview};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetSummary {
    pub id: String,
    pub name: String,
    pub csv_sha: String,
    pub n: usize,
    pub missing_total: usize,
    pub run_count: usize,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetRowsPage {
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub rows: Vec<RowPreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRecord {
    pub job_id: String,
    pub dataset_id: String,
    pub config_hash: String,
    pub seed: u64,
    pub status: String, // "queued" | "running" | "done" | "error"
    pub stage: Option<String>,
    pub progress: f64,
    pub run_id: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
    #[serde(default)]
    pub dataset_name: Option<String>,
    #[serde(default)]
    pub config_json: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageRecord {
    pub stage: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunSummary {
    pub run_id: String,
    pub job_id: String,
    pub dataset_id: String,
    pub dataset_name: Option<String>,
    pub name: String,
    pub created_at: String,
    pub status: String,
    pub imputer_id: Option<String>,
    pub forecaster_id: Option<String>,
    pub h: usize,
    pub best_pfvi_mse: Option<f64>,
    pub seed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunDetail {
    pub summary: RunSummary,
    pub config_json: String,
    pub stages: Vec<StageRecord>,
    pub params: Vec<(String, String)>,
    pub metrics: Vec<(String, String, f64)>, // (stage, key, value)
    pub artifacts: Vec<(String, String, String)>, // (kind, path, sha256)
}

pub struct RunStore {
    conn: Mutex<Connection>,
    base_dir: Option<PathBuf>,
}

impl RunStore {
    pub fn open(path: &Path) -> Result<Self, PfrsimError> {
        let parent = path.parent().map(|p| p.to_path_buf());
        if let Some(ref p) = parent {
            std::fs::create_dir_all(p).map_err(|e| PfrsimError::io(e))?;
        }
        let conn = Connection::open(path)?;
        let store = Self {
            conn: Mutex::new(conn),
            base_dir: parent,
        };
        store.init_tables()?;
        Ok(store)
    }

    pub fn open_in_memory() -> Result<Self, PfrsimError> {
        let conn = Connection::open_in_memory()?;
        let store = Self {
            conn: Mutex::new(conn),
            base_dir: None,
        };
        store.init_tables()?;
        Ok(store)
    }
    fn init_tables(&self) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;

            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                csv_sha TEXT NOT NULL,
                n INTEGER NOT NULL,
                preview_json TEXT NOT NULL,
                raw_columns_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                dataset_id TEXT NOT NULL,
                config_hash TEXT NOT NULL,
                seed INTEGER NOT NULL,
                status TEXT NOT NULL,
                stage TEXT,
                progress REAL NOT NULL DEFAULT 0.0,
                run_id TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                finished_at TEXT,
                config_json TEXT
            );

            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                csv_sha TEXT NOT NULL,
                seed INTEGER NOT NULL,
                config_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stages (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                stage TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT
            );

            CREATE TABLE IF NOT EXISTS params (
                run_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                PRIMARY KEY (run_id, key)
            );

            CREATE TABLE IF NOT EXISTS metrics (
                run_id TEXT NOT NULL,
                stage TEXT NOT NULL,
                key TEXT NOT NULL,
                value REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS artifacts (
                run_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                PRIMARY KEY (run_id, kind)
            );

            CREATE INDEX IF NOT EXISTS idx_datasets_csv_sha ON datasets(csv_sha);
            CREATE INDEX IF NOT EXISTS idx_jobs_dataset ON jobs(dataset_id);
            CREATE INDEX IF NOT EXISTS idx_runs_dataset ON runs(dataset_id);
            CREATE INDEX IF NOT EXISTS idx_metrics_run ON metrics(run_id);
            CREATE INDEX IF NOT EXISTS idx_params_run ON params(run_id);
            CREATE INDEX IF NOT EXISTS idx_stages_run ON stages(run_id);
            ",
        )?;
        // Migration for existing databases
        let _ = conn.execute("ALTER TABLE jobs ADD COLUMN finished_at TEXT", []);
        let _ = conn.execute("ALTER TABLE jobs ADD COLUMN config_json TEXT", []);

        Ok(())
    }

    // Dataset operations
    pub fn save_dataset(&self, ds: &Dataset) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        let preview_json = serde_json::to_string(&ds.preview)?;

        // For large datasets (> 50,000 rows), store columns as a binary Parquet file on disk
        // instead of a 500 MB JSON string in SQLite, keeping memory low and reads fast.
        let raw_columns_json = if ds.n > 50_000 && self.base_dir.is_some() {
            let base = self.base_dir.as_ref().unwrap();
            let ds_dir = base.join("datasets");
            std::fs::create_dir_all(&ds_dir).map_err(PfrsimError::io)?;
            let pq_path = ds_dir.join(format!("{}.parquet", ds.dataset_id));

            let mut df = DataFrame::new(
                ds.n,
                vec![
                    Series::new("WT".into(), &ds.columns.wt).into(),
                    Series::new("SM".into(), &ds.columns.sm).into(),
                    Series::new("Rf".into(), &ds.columns.rf).into(),
                    Series::new("Temp".into(), &ds.columns.temp).into(),
                ],
            )
            .map_err(|e| PfrsimError::validation("PARQUET_WRITE_ERROR", e.to_string(), None))?;

            let mut pq_file = std::fs::File::create(&pq_path).map_err(PfrsimError::io)?;
            ParquetWriter::new(&mut pq_file)
                .with_compression(ParquetCompression::Snappy)
                .finish(&mut df)
                .map_err(|e| PfrsimError::validation("PARQUET_WRITE_ERROR", e.to_string(), None))?;

            format!("file:{}", pq_path.to_string_lossy())
        } else {
            serde_json::to_string(&ds.columns)?
        };

        let created_at = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO datasets (id, name, csv_sha, n, preview_json, raw_columns_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             preview_json = excluded.preview_json,
             raw_columns_json = excluded.raw_columns_json",
            params![
                ds.dataset_id,
                ds.name,
                ds.csv_sha,
                ds.n as i64,
                preview_json,
                raw_columns_json,
                created_at,
            ],
        )?;

        Ok(())
    }

    pub fn find_dataset_by_sha(&self, sha: &str) -> Result<Option<Dataset>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, csv_sha, n, preview_json, raw_columns_json FROM datasets WHERE csv_sha = ?1 LIMIT 1",
        )?;

        let mut rows = stmt.query(params![sha])?;
        if let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let csv_sha: String = row.get(2)?;
            let n: i64 = row.get(3)?;
            let preview_json: String = row.get(4)?;
            let raw_columns_json: String = row.get(5)?;

            let preview: DatasetPreview = serde_json::from_str(&preview_json)?;
            let columns: ColumnData = if raw_columns_json.starts_with("file:") {
                let path_str = &raw_columns_json["file:".len()..];
                let f = std::fs::File::open(path_str).map_err(PfrsimError::io)?;
                let df = ParquetReader::new(f).finish().map_err(|e| {
                    PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None)
                })?;
                let extract = |col_name: &str| -> Vec<f64> {
                    df.column(col_name)
                        .ok()
                        .and_then(|c| {
                            c.f64()
                                .ok()
                                .map(|ca| ca.iter().map(|opt| opt.unwrap_or(f64::NAN)).collect())
                        })
                        .unwrap_or_default()
                };
                ColumnData {
                    wt: extract("WT"),
                    sm: extract("SM"),
                    rf: extract("Rf"),
                    temp: extract("Temp"),
                }
            } else {
                serde_json::from_str(&raw_columns_json)?
            };

            Ok(Some(Dataset {
                dataset_id: id,
                name,
                csv_sha,
                n: n as usize,
                time_kind: crate::ingest::TimeKind::Index,
                time_labels: None,
                missing: preview.missing.clone(),
                stats: preview.stats.clone(),
                columns,
                preview,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_dataset(&self, id: &str) -> Result<Option<Dataset>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, csv_sha, n, preview_json, raw_columns_json FROM datasets WHERE id = ?1 LIMIT 1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let csv_sha: String = row.get(2)?;
            let n: i64 = row.get(3)?;
            let preview_json: String = row.get(4)?;
            let raw_columns_json: String = row.get(5)?;

            let preview: DatasetPreview = serde_json::from_str(&preview_json)?;
            let columns: ColumnData = if raw_columns_json.starts_with("file:") {
                let path_str = &raw_columns_json["file:".len()..];
                let f = std::fs::File::open(path_str).map_err(PfrsimError::io)?;
                let df = ParquetReader::new(f).finish().map_err(|e| {
                    PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None)
                })?;
                let extract = |col_name: &str| -> Vec<f64> {
                    df.column(col_name)
                        .ok()
                        .and_then(|c| {
                            c.f64()
                                .ok()
                                .map(|ca| ca.iter().map(|opt| opt.unwrap_or(f64::NAN)).collect())
                        })
                        .unwrap_or_default()
                };
                ColumnData {
                    wt: extract("WT"),
                    sm: extract("SM"),
                    rf: extract("Rf"),
                    temp: extract("Temp"),
                }
            } else {
                serde_json::from_str(&raw_columns_json)?
            };

            Ok(Some(Dataset {
                dataset_id: id,
                name,
                csv_sha,
                n: n as usize,
                time_kind: crate::ingest::TimeKind::Index,
                time_labels: None,
                missing: preview.missing.clone(),
                stats: preview.stats.clone(),
                columns,
                preview,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_dataset_preview(&self, id: &str) -> Result<Option<DatasetPreview>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare("SELECT preview_json FROM datasets WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let preview_json: String = row.get(0)?;
            let preview: DatasetPreview = serde_json::from_str(&preview_json)?;
            Ok(Some(preview))
        } else {
            Ok(None)
        }
    }
    pub fn get_dataset_rows(
        &self,
        dataset_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<Option<DatasetRowsPage>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT n, preview_json, raw_columns_json FROM datasets WHERE id = ?1 LIMIT 1",
        )?;

        let mut rows = stmt.query(params![dataset_id])?;
        if let Some(row) = rows.next()? {
            let n: i64 = row.get(0)?;
            let total = n as usize;
            let preview_json: String = row.get(1)?;
            let raw_columns_json: String = row.get(2)?;

            let preview: DatasetPreview = serde_json::from_str(&preview_json)?;
            let start = offset.min(total);
            let end = (offset + limit).min(total);
            let page_len = end.saturating_sub(start);
            let mut page_rows = Vec::with_capacity(page_len);

            if raw_columns_json.starts_with("file:") {
                let path_str = &raw_columns_json["file:".len()..];
                let f = std::fs::File::open(path_str).map_err(PfrsimError::io)?;
                let df = ParquetReader::new(f)
                    .with_slice(Some((start, page_len)))
                    .finish()
                    .map_err(|e| {
                        PfrsimError::validation("PARQUET_READ_ERROR", e.to_string(), None)
                    })?;

                let get_cell = |col_name: &str, row_idx: usize| -> Option<f64> {
                    df.column(col_name)
                        .ok()
                        .and_then(|c| c.f64().ok().and_then(|ca| ca.get(row_idx)))
                        .filter(|v| !v.is_nan())
                };

                for idx in 0..page_len {
                    let global_idx = start + idx;
                    let time_label = if global_idx < preview.head.len() {
                        preview.head[global_idx].time_label.clone()
                    } else {
                        Some(format!("{}", global_idx + 1))
                    };
                    page_rows.push(RowPreview {
                        t: global_idx + 1,
                        time_label,
                        wt: get_cell("WT", idx),
                        sm: get_cell("SM", idx),
                        rf: get_cell("Rf", idx),
                        temp: get_cell("Temp", idx),
                    });
                }
            } else {
                let columns: ColumnData = serde_json::from_str(&raw_columns_json)?;
                for i in start..end {
                    let time_label = if i < preview.head.len() {
                        preview.head[i].time_label.clone()
                    } else {
                        Some(format!("{}", i + 1))
                    };
                    page_rows.push(RowPreview {
                        t: i + 1,
                        time_label,
                        wt: columns.wt.get(i).copied().filter(|v| !v.is_nan()),
                        sm: columns.sm.get(i).copied().filter(|v| !v.is_nan()),
                        rf: columns.rf.get(i).copied().filter(|v| !v.is_nan()),
                        temp: columns.temp.get(i).copied().filter(|v| !v.is_nan()),
                    });
                }
            }

            Ok(Some(DatasetRowsPage {
                total,
                offset,
                limit,
                rows: page_rows,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_datasets(&self) -> Result<Vec<DatasetSummary>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT d.id, d.name, d.csv_sha, d.n, d.preview_json, d.created_at,
                    (SELECT COUNT(*) FROM runs r WHERE r.dataset_id = d.id) as run_count
             FROM datasets d
             ORDER BY d.created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let csv_sha: String = row.get(2)?;
            let n: i64 = row.get(3)?;
            let preview_json: String = row.get(4)?;
            let created_at: String = row.get(5)?;
            let run_count: i64 = row.get(6)?;

            let missing_total =
                if let Ok(prev) = serde_json::from_str::<DatasetPreview>(&preview_json) {
                    prev.missing.total
                } else {
                    0
                };

            Ok(DatasetSummary {
                id,
                name,
                csv_sha,
                n: n as usize,
                missing_total,
                run_count: run_count as usize,
                created_at,
            })
        })?;

        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn update_dataset_name(&self, id: &str, new_name: &str) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        let rows = conn.execute(
            "UPDATE datasets SET name = ?1 WHERE id = ?2",
            params![new_name, id],
        )?;
        if rows == 0 {
            return Err(PfrsimError::not_found("Dataset", id));
        }
        Ok(())
    }

    pub fn delete_dataset(&self, id: &str) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();

        // Clean up external parquet storage if present
        let raw_col_opt: Option<String> = conn
            .query_row(
                "SELECT raw_columns_json FROM datasets WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(raw_col) = raw_col_opt {
            if raw_col.starts_with("file:") {
                let path = &raw_col["file:".len()..];
                let _ = std::fs::remove_file(path);
            }
        }

        // 1. Delete metrics, params, stages for any runs belonging to this dataset
        conn.execute(
            "DELETE FROM metrics WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?1)",
            params![id],
        )?;
        conn.execute(
            "DELETE FROM params WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?1)",
            params![id],
        )?;
        conn.execute(
            "DELETE FROM stages WHERE run_id IN (SELECT id FROM runs WHERE dataset_id = ?1)",
            params![id],
        )?;
        // 2. Delete runs
        conn.execute("DELETE FROM runs WHERE dataset_id = ?1", params![id])?;
        // 3. Delete jobs
        conn.execute("DELETE FROM jobs WHERE dataset_id = ?1", params![id])?;
        // 4. Delete dataset record
        let rows = conn.execute("DELETE FROM datasets WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(PfrsimError::not_found("Dataset", id));
        }
        Ok(())
    }

    // Job operations
    pub fn save_job(&self, job: &JobRecord) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO jobs (id, dataset_id, config_hash, seed, status, stage, progress, run_id, error, created_at, finished_at, config_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             stage = excluded.stage,
             progress = excluded.progress,
             run_id = excluded.run_id,
             error = excluded.error,
             finished_at = excluded.finished_at,
             config_json = COALESCE(excluded.config_json, jobs.config_json)",
            params![
                job.job_id,
                job.dataset_id,
                job.config_hash,
                job.seed as i64,
                job.status,
                job.stage,
                job.progress,
                job.run_id,
                job.error,
                job.created_at,
                job.finished_at,
                job.config_json,
            ],
        )?;
        Ok(())
    }

    pub fn get_job(&self, job_id: &str) -> Result<Option<JobRecord>, PfrsimError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT 
                j.id, j.dataset_id, j.config_hash, j.seed, j.status, j.stage, j.progress, j.run_id, j.error, j.created_at, j.finished_at,
                d.name,
                COALESCE(j.config_json, r.config_json)
             FROM jobs j
             LEFT JOIN datasets d ON j.dataset_id = d.id
             LEFT JOIN runs r ON j.id = r.job_id
             WHERE j.id = ?1 LIMIT 1",
        )?;

        let mut rows = stmt.query(params![job_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(JobRecord {
                job_id: row.get(0)?,
                dataset_id: row.get(1)?,
                config_hash: row.get(2)?,
                seed: row.get::<_, i64>(3)? as u64,
                status: row.get(4)?,
                stage: row.get(5)?,
                progress: row.get(6)?,
                run_id: row.get(7)?,
                error: row.get(8)?,
                created_at: row.get(9)?,
                finished_at: row.get(10)?,
                dataset_name: row.get(11)?,
                config_json: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_job_progress(
        &self,
        job_id: &str,
        stage: &str,
        progress: f64,
    ) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE jobs SET stage = ?1, progress = ?2 WHERE id = ?3",
            params![stage, progress, job_id],
        )?;
        Ok(())
    }

    pub fn update_job_status(
        &self,
        job_id: &str,
        status: &str,
        run_id: Option<&str>,
        error: Option<&str>,
    ) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        let fin_at = if status == "done" || status == "error" {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };
        conn.execute(
            "UPDATE jobs SET status = ?1, run_id = ?2, error = ?3, finished_at = COALESCE(?4, finished_at) WHERE id = ?5",
            params![status, run_id, error, fin_at, job_id],
        )?;
        Ok(())
    }

    pub fn recover_orphaned_jobs(&self) -> Result<usize, PfrsimError> {
        let conn = self.conn.lock();
        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn.execute(
            "UPDATE jobs SET status = 'error', error = 'INTERRUPTED_PROCESS_TERMINATED', finished_at = COALESCE(finished_at, ?1)
             WHERE status = 'running' OR status = 'queued'",
            params![now],
        )?;
        Ok(updated)
    }

    pub fn list_jobs(&self, dataset_id: Option<&str>) -> Result<Vec<JobRecord>, PfrsimError> {
        let conn = self.conn.lock();
        let mut out = Vec::new();

        if let Some(ds_id) = dataset_id {
            let mut stmt = conn.prepare(
                "SELECT 
                    j.id, j.dataset_id, j.config_hash, j.seed, j.status, j.stage, j.progress, j.run_id, j.error, j.created_at, j.finished_at,
                    d.name,
                    COALESCE(j.config_json, r.config_json)
                 FROM jobs j
                 LEFT JOIN datasets d ON j.dataset_id = d.id
                 LEFT JOIN runs r ON j.id = r.job_id
                 WHERE j.dataset_id = ?1 ORDER BY j.created_at DESC",
            )?;
            let rows = stmt.query_map(params![ds_id], |row| {
                Ok(JobRecord {
                    job_id: row.get(0)?,
                    dataset_id: row.get(1)?,
                    config_hash: row.get(2)?,
                    seed: row.get::<_, i64>(3)? as u64,
                    status: row.get(4)?,
                    stage: row.get(5)?,
                    progress: row.get(6)?,
                    run_id: row.get(7)?,
                    error: row.get(8)?,
                    created_at: row.get(9)?,
                    finished_at: row.get(10)?,
                    dataset_name: row.get(11)?,
                    config_json: row.get(12)?,
                })
            })?;
            for r in rows {
                out.push(r?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT 
                    j.id, j.dataset_id, j.config_hash, j.seed, j.status, j.stage, j.progress, j.run_id, j.error, j.created_at, j.finished_at,
                    d.name,
                    COALESCE(j.config_json, r.config_json)
                 FROM jobs j
                 LEFT JOIN datasets d ON j.dataset_id = d.id
                 LEFT JOIN runs r ON j.id = r.job_id
                 ORDER BY j.created_at DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(JobRecord {
                    job_id: row.get(0)?,
                    dataset_id: row.get(1)?,
                    config_hash: row.get(2)?,
                    seed: row.get::<_, i64>(3)? as u64,
                    status: row.get(4)?,
                    stage: row.get(5)?,
                    progress: row.get(6)?,
                    run_id: row.get(7)?,
                    error: row.get(8)?,
                    created_at: row.get(9)?,
                    finished_at: row.get(10)?,
                    dataset_name: row.get(11)?,
                    config_json: row.get(12)?,
                })
            })?;
            for r in rows {
                out.push(r?);
            }
        }

        Ok(out)
    }

    pub fn delete_job(&self, job_id: &str) -> Result<bool, PfrsimError> {
        let conn = self.conn.lock();
        let affected = conn.execute("DELETE FROM jobs WHERE id = ?1", params![job_id])?;
        Ok(affected > 0)
    }

    // Run operations
    pub fn create_run(
        &self,
        run_id: &str,
        job_id: &str,
        dataset_id: &str,
        name: &str,
        csv_sha: &str,
        seed: u64,
        config_json: &str,
    ) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        let created_at = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO runs (id, job_id, dataset_id, name, created_at, status, csv_sha, seed, config_json)
             VALUES (?1, ?2, ?3, ?4, ?5, 'RUNNING', ?6, ?7, ?8)",
            params![
                run_id,
                job_id,
                dataset_id,
                name,
                created_at,
                csv_sha,
                seed as i64,
                config_json,
            ],
        )?;
        Ok(())
    }

    pub fn finish_run(&self, run_id: &str, status: &str) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE runs SET status = ?1 WHERE id = ?2",
            params![status, run_id],
        )?;
        Ok(())
    }

    pub fn record_stage(
        &self,
        run_id: &str,
        stage: &str,
        status: &str,
        started_at: &str,
        finished_at: Option<&str>,
    ) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        let id = format!("{run_id}-{stage}");
        conn.execute(
            "INSERT INTO stages (id, run_id, stage, status, started_at, finished_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             finished_at = excluded.finished_at",
            params![id, run_id, stage, status, started_at, finished_at],
        )?;
        Ok(())
    }

    pub fn record_params(&self, run_id: &str, params: &[(&str, &str)]) -> Result<(), PfrsimError> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO params (run_id, key, value) VALUES (?1, ?2, ?3)
                 ON CONFLICT(run_id, key) DO UPDATE SET value = excluded.value",
            )?;
            for &(k, v) in params {
                stmt.execute(params![run_id, k, v])?;
            }
        }
        tx.commit()?;
        Ok(())
    }
    pub fn record_metrics<S: AsRef<str>>(
        &self,
        run_id: &str,
        stage: &str,
        metrics: &[(S, f64)],
    ) -> Result<(), PfrsimError> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO metrics (run_id, stage, key, value) VALUES (?1, ?2, ?3, ?4)",
            )?;
            for (k, v) in metrics {
                stmt.execute(params![run_id, stage, k.as_ref(), v])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn record_artifact(
        &self,
        run_id: &str,
        kind: &str,
        path: &str,
        sha256: &str,
    ) -> Result<(), PfrsimError> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO artifacts (run_id, kind, path, sha256) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(run_id, kind) DO UPDATE SET path = excluded.path, sha256 = excluded.sha256",
            params![run_id, kind, path, sha256],
        )?;
        Ok(())
    }

    pub fn list_runs(
        &self,
        limit: usize,
        offset: usize,
        dataset_id: Option<&str>,
    ) -> Result<Vec<RunSummary>, PfrsimError> {
        let conn = self.conn.lock();
        let mut out = Vec::new();

        let query = if dataset_id.is_some() {
            "SELECT r.id, r.job_id, r.dataset_id, d.name, r.name, r.created_at, r.status, r.seed
             FROM runs r
             LEFT JOIN datasets d ON r.dataset_id = d.id
             WHERE r.dataset_id = ?1
             ORDER BY r.created_at DESC LIMIT ?2 OFFSET ?3"
        } else {
            "SELECT r.id, r.job_id, r.dataset_id, d.name, r.name, r.created_at, r.status, r.seed
             FROM runs r
             LEFT JOIN datasets d ON r.dataset_id = d.id
             ORDER BY r.created_at DESC LIMIT ?1 OFFSET ?2"
        };

        let mut stmt = conn.prepare(query)?;
        let mapper = |row: &rusqlite::Row| -> rusqlite::Result<_> {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)? as u64,
            ))
        };

        let rows: Vec<_> = if let Some(ds_id) = dataset_id {
            stmt.query_map(params![ds_id, limit as i64, offset as i64], mapper)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![limit as i64, offset as i64], mapper)?
                .collect::<Result<Vec<_>, _>>()?
        };

        for (run_id, job_id, d_id, ds_name, name, created_at, status, seed) in rows {
            // Retrieve imputer_id, forecaster_id, h, best_pfvi_mse from params/metrics
            let imputer_id: Option<String> = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'imputer.id'",
                    params![&run_id],
                    |row| row.get(0),
                )
                .optional()?;

            let forecaster_id: Option<String> = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'forecaster.id'",
                    params![&run_id],
                    |row| row.get(0),
                )
                .optional()?;

            let h_val: usize = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'pfvi.h'",
                    params![&run_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()?
                .and_then(|s| s.parse().ok())
                .unwrap_or(4);

            let best_mse: Option<f64> = conn
                .query_row(
                    "SELECT value FROM metrics WHERE run_id = ?1 AND key = 'pfvi.mse'",
                    params![&run_id],
                    |row| row.get(0),
                )
                .optional()?;

            out.push(RunSummary {
                run_id,
                job_id,
                dataset_id: d_id,
                dataset_name: ds_name,
                name,
                created_at,
                status,
                imputer_id,
                forecaster_id,
                h: h_val,
                best_pfvi_mse: best_mse,
                seed,
            });
        }

        Ok(out)
    }

    pub fn get_run(&self, run_id: &str) -> Result<Option<RunDetail>, PfrsimError> {
        let conn = self.conn.lock();

        let mut stmt = conn.prepare(
            "SELECT r.id, r.job_id, r.dataset_id, d.name, r.name, r.created_at, r.status, r.seed, r.config_json
             FROM runs r
             LEFT JOIN datasets d ON r.dataset_id = d.id
             WHERE r.id = ?1 LIMIT 1",
        )?;

        let mut rows = stmt.query(params![run_id])?;
        if let Some(row) = rows.next()? {
            let r_id: String = row.get(0)?;
            let job_id: String = row.get(1)?;
            let dataset_id: String = row.get(2)?;
            let dataset_name: Option<String> = row.get(3)?;
            let name: String = row.get(4)?;
            let created_at: String = row.get(5)?;
            let status: String = row.get(6)?;
            let seed: u64 = row.get::<_, i64>(7)? as u64;
            let config_json: String = row.get(8)?;

            let imputer_id: Option<String> = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'imputer.id'",
                    params![run_id],
                    |r| r.get(0),
                )
                .optional()?;

            let forecaster_id: Option<String> = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'forecaster.id'",
                    params![run_id],
                    |r| r.get(0),
                )
                .optional()?;

            let h_val: usize = conn
                .query_row(
                    "SELECT value FROM params WHERE run_id = ?1 AND key = 'pfvi.h'",
                    params![run_id],
                    |r| r.get::<_, String>(0),
                )
                .optional()?
                .and_then(|s| s.parse().ok())
                .unwrap_or(4);

            let best_mse: Option<f64> = conn
                .query_row(
                    "SELECT value FROM metrics WHERE run_id = ?1 AND key = 'pfvi.mse'",
                    params![run_id],
                    |r| r.get(0),
                )
                .optional()?;

            let summary = RunSummary {
                run_id: r_id,
                job_id,
                dataset_id,
                dataset_name,
                name,
                created_at,
                status,
                imputer_id,
                forecaster_id,
                h: h_val,
                best_pfvi_mse: best_mse,
                seed,
            };

            // Stages
            let mut stage_stmt = conn.prepare(
                "SELECT stage, status, started_at, finished_at FROM stages WHERE run_id = ?1 ORDER BY started_at ASC",
            )?;
            let stage_rows = stage_stmt.query_map(params![run_id], |r| {
                Ok(StageRecord {
                    stage: r.get(0)?,
                    status: r.get(1)?,
                    started_at: r.get(2)?,
                    finished_at: r.get(3)?,
                })
            })?;
            let mut stages = Vec::new();
            for s in stage_rows {
                stages.push(s?);
            }

            // Params
            let mut param_stmt =
                conn.prepare("SELECT key, value FROM params WHERE run_id = ?1 ORDER BY key ASC")?;
            let param_rows = param_stmt.query_map(params![run_id], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })?;
            let mut params_vec = Vec::new();
            for p in param_rows {
                params_vec.push(p?);
            }

            // Metrics
            let mut metric_stmt = conn.prepare(
                "SELECT stage, key, value FROM metrics WHERE run_id = ?1 ORDER BY stage ASC, key ASC",
            )?;
            let metric_rows = metric_stmt.query_map(params![run_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, f64>(2)?,
                ))
            })?;
            let mut metrics_vec = Vec::new();
            for m in metric_rows {
                metrics_vec.push(m?);
            }

            // Artifacts
            let mut art_stmt = conn.prepare(
                "SELECT kind, path, sha256 FROM artifacts WHERE run_id = ?1 ORDER BY kind ASC",
            )?;
            let art_rows = art_stmt.query_map(params![run_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })?;
            let mut artifacts_vec = Vec::new();
            for a in art_rows {
                artifacts_vec.push(a?);
            }

            Ok(Some(RunDetail {
                summary,
                config_json,
                stages,
                params: params_vec,
                metrics: metrics_vec,
                artifacts: artifacts_vec,
            }))
        } else {
            Ok(None)
        }
    }
    pub fn delete_run(&self, run_id: &str) -> Result<bool, PfrsimError> {
        let conn = self.conn.lock();
        let affected = conn.execute("DELETE FROM runs WHERE id = ?1", params![run_id])?;
        if affected > 0 {
            let _ = conn.execute("DELETE FROM stages WHERE run_id = ?1", params![run_id]);
            let _ = conn.execute("DELETE FROM params WHERE run_id = ?1", params![run_id]);
            let _ = conn.execute("DELETE FROM metrics WHERE run_id = ?1", params![run_id]);
            let _ = conn.execute("DELETE FROM artifacts WHERE run_id = ?1", params![run_id]);
            let _ = conn.execute(
                "UPDATE jobs SET run_id = NULL WHERE run_id = ?1",
                params![run_id],
            );
            Ok(true)
        } else {
            Ok(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingest::parse_csv;

    #[test]
    fn test_runstore_smoke() {
        let store = RunStore::open_in_memory().expect("open memory store");
        let csv = "WT,SM,Rf,Temp\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35\n-1,35,0.001,35";
        let ds = parse_csv(csv, "smoke.csv").unwrap();

        store.save_dataset(&ds).unwrap();
        let found = store
            .find_dataset_by_sha(&ds.csv_sha)
            .unwrap()
            .expect("found ds");
        assert_eq!(found.dataset_id, ds.dataset_id);

        let job = JobRecord {
            job_id: "job-1".to_string(),
            dataset_id: ds.dataset_id.clone(),
            config_hash: "cfg123".to_string(),
            seed: 42,
            status: "queued".to_string(),
            stage: None,
            progress: 0.0,
            run_id: None,
            error: None,
            created_at: Utc::now().to_rfc3339(),
            finished_at: None,
            dataset_name: Some("example8".to_string()),
            config_json: Some("{}".to_string()),
        };
        store.save_job(&job).unwrap();
        let j = store.get_job("job-1").unwrap().expect("found job");
        assert_eq!(j.status, "queued");

        store
            .create_run(
                "run-1",
                "job-1",
                &ds.dataset_id,
                "Test Run",
                &ds.csv_sha,
                42,
                "{}",
            )
            .unwrap();
        store
            .record_params(
                "run-1",
                &[
                    ("imputer.id", "knn"),
                    ("forecaster.id", "arima"),
                    ("pfvi.h", "4"),
                ],
            )
            .unwrap();
        store
            .record_metrics("run-1", "pfvi", &[("pfvi.mse", 12.34)])
            .unwrap();
        store.finish_run("run-1", "DONE").unwrap();

        let list = store.list_runs(10, 0, None).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].imputer_id.as_deref(), Some("knn"));
        assert_eq!(list[0].best_pfvi_mse, Some(12.34));

        let detail = store.get_run("run-1").unwrap().expect("found run detail");
        assert_eq!(detail.summary.run_id, "run-1");
        assert_eq!(detail.params.len(), 3);
        assert_eq!(detail.metrics.len(), 1);

        // Test update dataset name
        store
            .update_dataset_name(&ds.dataset_id, "renamed_smoke.csv")
            .unwrap();
        let renamed = store
            .get_dataset(&ds.dataset_id)
            .unwrap()
            .expect("found renamed");
        assert_eq!(renamed.name, "renamed_smoke.csv");

        // Test delete dataset (cascades runs and jobs)
        store.delete_dataset(&ds.dataset_id).unwrap();
        assert!(store.get_dataset(&ds.dataset_id).unwrap().is_none());
        assert!(store.get_job("job-1").unwrap().is_none());
        assert!(store.get_run("run-1").unwrap().is_none());
    }
}
