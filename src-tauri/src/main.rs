#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod state;

use state::AppState;

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PFRSIM FATAL PANIC: {info}\n");
        eprintln!("{msg}");
        if let Some(dir) = dirs::data_dir() {
            let log_dir = dir.join("pfrsim");
            let _ = std::fs::create_dir_all(&log_dir);
            let _ = std::fs::write(log_dir.join("crash.log"), msg);
        }
    }));

    let app_state = AppState::new().expect("Failed to initialize pfrsim app state");

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::dataset_import,
            commands::datasets_list,
            commands::dataset_get_preview,
            commands::dataset_get_detail,
            commands::dataset_stl_decomposition,
            commands::dataset_autocorrelation,
            commands::dataset_get_rows,
            commands::dataset_get_series_downsampled,
            commands::dataset_get_all_series_downsampled,
            commands::dataset_update_name,
            commands::dataset_delete,
            commands::capability_query,
            commands::gpu_spec_query,
            commands::pipeline_run,
            commands::pipeline_job_status,
            commands::pipeline_jobs_list,
            commands::pipeline_cancel,
            commands::pipeline_job_delete,
            commands::runs_list,
            commands::run_get,
            commands::run_delete,
            commands::artifact_load_frames,
            commands::artifact_load_manifest,
            commands::artifact_export,
            commands::dialog_pick_folder,
            commands::dialog_pick_file,
            commands::run_import,
            commands::dataset_inspect,
            commands::dataset_import_mapped,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close,
            commands::window_start_dragging,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn test_gpu_spec_query_command() {
        let res = commands::gpu_spec_query().await;
        assert!(matches!(res, pfrsim_core::error::CommandOutput::Success(_)));
    }
}
