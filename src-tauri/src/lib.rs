use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_single_instance::init as single_instance_init;

#[derive(Default)]
pub struct AppState {
    allowed_paths: Mutex<HashSet<PathBuf>>,
}

impl AppState {
    pub fn allow_path<P: AsRef<Path>>(&self, path: P) {
        let p = path.as_ref();
        let mut set = self.allowed_paths.lock().unwrap();
        set.insert(p.to_path_buf());
        if let Ok(canon) = p.canonicalize() {
            set.insert(canon);
        }
    }

    pub fn is_allowed<P: AsRef<Path>>(&self, path: P) -> bool {
        let p = path.as_ref();
        let set = self.allowed_paths.lock().unwrap();
        if set.contains(p) {
            return true;
        }
        if let Ok(canon) = p.canonicalize() {
            if set.contains(&canon) {
                return true;
            }
        }
        false
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FilePayload {
    pub path: String,
    pub name: String,
    pub bytes: Vec<u8>,
}

#[tauri::command]
pub fn folio_pick_open(state: tauri::State<AppState>) -> Result<Option<FilePayload>, String> {
    let file = rfd::FileDialog::new()
        .add_filter(
            "Supported Office Files",
            &[
                "docx", "odt", "rtf", "txt", "md", "html", "htm", "xlsx", "csv", "tsv", "pptx",
                "pdf",
            ],
        )
        .add_filter("Word Documents (*.docx)", &["docx"])
        .add_filter("OpenDocument Text (*.odt)", &["odt"])
        .add_filter("Rich Text Format (*.rtf)", &["rtf"])
        .add_filter(
            "Text & Markdown (*.txt, *.md, *.html)",
            &["txt", "md", "html", "htm"],
        )
        .add_filter("Excel Spreadsheets (*.xlsx)", &["xlsx"])
        .add_filter("Delimited Text (*.csv, *.tsv)", &["csv", "tsv"])
        .add_filter("PowerPoint Presentations (*.pptx)", &["pptx"])
        .add_filter("PDF Documents (*.pdf)", &["pdf"])
        .pick_file();

    if let Some(path) = file {
        let path_str = path.to_string_lossy().to_string();
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
        state.allow_path(&path);
        Ok(Some(FilePayload {
            path: path_str,
            name,
            bytes,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn folio_pick_save(
    default_name: Option<String>,
    format: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    if let Some(ref fmt) = format {
        dialog = dialog.add_filter(fmt, &[fmt.as_str()]);
    }
    let file = dialog.save_file();
    if let Some(path) = file {
        let path_str = path.to_string_lossy().to_string();
        state.allow_path(&path);
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn folio_read(path: String, state: tauri::State<AppState>) -> Result<FilePayload, String> {
    let p = PathBuf::from(&path);
    if !state.is_allowed(&p) {
        return Err(format!(
            "Access denied: path '{}' is not in the allowed session list.",
            path
        ));
    }
    let name = p
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let bytes = std::fs::read(&p).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    Ok(FilePayload { path, name, bytes })
}

#[tauri::command]
pub fn folio_write(path: String, bytes: Vec<u8>, state: tauri::State<AppState>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !state.is_allowed(&p) {
        return Err(format!(
            "Access denied: path '{}' is not in the allowed session list.",
            path
        ));
    }
    std::fs::write(&p, &bytes)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))?;
    Ok(())
}

#[tauri::command]
pub fn folio_allow_path(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    state.allow_path(PathBuf::from(path));
    Ok(())
}

pub fn run() {
    let app_state = AppState::default();

    // Check command line arguments on initial launch
    let args: Vec<String> = std::env::args().collect();
    for arg in args.iter().skip(1) {
        let p = PathBuf::from(arg);
        if p.exists() && p.is_file() {
            app_state.allow_path(&p);
        }
    }

    tauri::Builder::default()
        .manage(app_state)
        .plugin(single_instance_init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                for arg in argv.iter().skip(1) {
                    let p = PathBuf::from(&arg);
                    if p.exists() && p.is_file() {
                        let state = app.state::<AppState>();
                        state.allow_path(&p);
                        let _ = window.emit("folio://open-file", serde_json::json!({ "path": arg }));
                        break;
                    }
                }
            }
        }))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let state = window.state::<AppState>();
                for p in paths {
                    state.allow_path(p);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            folio_pick_open,
            folio_pick_save,
            folio_read,
            folio_write,
            folio_allow_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running folio tauri application");
}

