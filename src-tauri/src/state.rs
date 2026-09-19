use parking_lot::Mutex;
use pfrsim_core::runstore::RunStore;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub base_dir: PathBuf,
    pub runstore: Arc<RunStore>,
    pub active_jobs: Arc<Mutex<HashSet<String>>>,
}

impl AppState {
    pub fn new() -> Result<Self, pfrsim_core::error::PfrsimError> {
        let base_dir = dirs::data_dir()
            .map(|d| d.join("pfrsim"))
            .unwrap_or_else(|| PathBuf::from("./pfrsim_data"));

        std::fs::create_dir_all(&base_dir).map_err(|e| pfrsim_core::error::PfrsimError::io(e))?;

        let db_path = base_dir.join("runs.sqlite");
        let runstore = Arc::new(RunStore::open(&db_path)?);
        // Gracefully recover any orphaned jobs left in running/queued state from a previous killed process
        let _ = runstore.recover_orphaned_jobs();

        Ok(Self {
            base_dir,
            runstore,
            active_jobs: Arc::new(Mutex::new(HashSet::new())),
        })
    }
}
