use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_single_instance::init as single_instance_init;

#[derive(Default)]
pub struct AppState {
    allowed_paths: Mutex<HashSet<PathBuf>>,
    launch_paths: Mutex<Vec<String>>,
}

#[derive(serde::Serialize)]
pub struct PathStatus {
    pub exists: bool,
    pub parent_exists: bool,
    pub modified_ms: Option<u64>,
    pub len: Option<u64>,
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
fn folio_pick_open(state: tauri::State<AppState>) -> Result<Vec<FilePayload>, String> {
    let files = rfd::FileDialog::new()
        .add_filter(
            "Supported Office Files",
            &[
                "docx", "odt", "rtf", "txt", "md", "html", "htm", "xlsx", "csv", "tsv", "pptx",
                "pdf", "tmdx", "pmdx", "prdx", "tmd", "pmd", "prd",
            ],
        )
        .add_filter("Document (*.tmdx)", &["tmdx"])
        .add_filter("Spreadsheet (*.pmdx)", &["pmdx"])
        .add_filter("Presentation (*.prdx)", &["prdx"])
        .add_filter("Documents (*.docx)", &["docx"])
        .add_filter("OpenDocument Text (*.odt)", &["odt"])
        .add_filter("Rich Text Format (*.rtf)", &["rtf"])
        .add_filter(
            "Text & Markdown (*.txt, *.md, *.html)",
            &["txt", "md", "html", "htm"],
        )
        .add_filter("Spreadsheets (*.xlsx)", &["xlsx"])
        .add_filter("Delimited Text (*.csv, *.tsv)", &["csv", "tsv"])
        .add_filter("Presentations (*.pptx)", &["pptx"])
        .add_filter("PDF Documents (*.pdf)", &["pdf"])
        .pick_files();

    let mut opened = Vec::new();
    if let Some(paths) = files {
        for path in paths {
            let path_str = path.to_string_lossy().to_string();
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
            state.allow_path(&path);
            opened.push(FilePayload {
                path: path_str,
                name,
                bytes,
            });
        }
    }
    Ok(opened)
}

#[tauri::command]
fn folio_path_status(path: String, state: tauri::State<AppState>) -> Result<PathStatus, String> {
    let p = PathBuf::from(&path);
    if !state.is_allowed(&p) {
        return Err(format!(
            "Access denied: path '{}' is not in the allowed session list.",
            path
        ));
    }
    let parent_exists = p.parent().map(|parent| parent.exists()).unwrap_or(false);
    let exists = p.is_file();
    let (modified_ms, len) = if exists {
        match std::fs::metadata(&p) {
            Ok(meta) => {
                let modified = meta.modified().ok().and_then(|time| {
                    time.duration_since(std::time::UNIX_EPOCH)
                        .ok()
                        .map(|duration| duration.as_millis() as u64)
                });
                (modified, Some(meta.len()))
            }
            Err(_) => (None, None),
        }
    } else {
        (None, None)
    };
    Ok(PathStatus {
        exists,
        parent_exists,
        modified_ms,
        len,
    })
}

#[tauri::command]
fn folio_take_launch_paths(state: tauri::State<AppState>) -> Vec<String> {
    let mut paths = state.launch_paths.lock().unwrap();
    std::mem::take(&mut *paths)
}

#[tauri::command]
fn folio_choose(
    window: tauri::WebviewWindow,
    title: String,
    message: String,
    buttons: Vec<String>,
) -> Result<Option<String>, String> {
    if buttons.is_empty() || buttons.len() > 3 {
        return Err("Folio dialogs support 1 to 3 buttons.".to_string());
    }
    let button_set = match buttons.as_slice() {
        [only] => rfd::MessageButtons::OkCustom(only.clone()),
        [yes, no] => rfd::MessageButtons::OkCancelCustom(yes.clone(), no.clone()),
        [yes, no, cancel] => {
            rfd::MessageButtons::YesNoCancelCustom(yes.clone(), no.clone(), cancel.clone())
        }
        _ => unreachable!(),
    };
    let result = rfd::MessageDialog::new()
        .set_title(&title)
        .set_description(&message)
        .set_buttons(button_set)
        .set_parent(&window)
        .show();
    Ok(match result {
        rfd::MessageDialogResult::Custom(text) => Some(text),
        rfd::MessageDialogResult::Ok | rfd::MessageDialogResult::Yes => buttons.first().cloned(),
        rfd::MessageDialogResult::No => buttons.get(1).cloned(),
        rfd::MessageDialogResult::Cancel => None,
    })
}

#[derive(serde::Deserialize)]
pub struct SaveFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
fn folio_pick_save(
    default_name: Option<String>,
    format: Option<String>,
    filters: Option<Vec<SaveFilter>>,
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    if let Some(ref filter_list) = filters {
        for f in filter_list {
            let ext_slices: Vec<&str> = f.extensions.iter().map(|s| s.trim_start_matches('.')).collect();
            dialog = dialog.add_filter(&f.name, &ext_slices);
        }
    } else if let Some(ref fmt) = format {
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
fn folio_read(path: String, state: tauri::State<AppState>) -> Result<FilePayload, String> {
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
fn folio_write(path: String, bytes: Vec<u8>, state: tauri::State<AppState>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !state.is_allowed(&p) {
        return Err(format!(
            "Access denied: path '{}' is not in the allowed session list.",
            path
        ));
    }
    write_replacing(&p, &bytes).map_err(|e| format!("Failed to write file '{}': {}", path, e))?;
    Ok(())
}

/// Write the bytes aside, then replace the target. A failed write leaves the previous file.
fn write_replacing(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let name = target.file_name().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "path has no file name")
    })?;
    let mut tmp_name = name.to_os_string();
    tmp_name.push(".folio-tmp");
    let tmp = target.with_file_name(tmp_name);
    std::fs::write(&tmp, bytes)?;
    match replace_file(&tmp, target) {
        Ok(()) => Ok(()),
        Err(err) => {
            let _ = std::fs::remove_file(&tmp);
            Err(err)
        }
    }
}

#[cfg(windows)]
fn replace_file(from: &Path, to: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    let from_w: Vec<u16> = from.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let to_w: Vec<u16> = to.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    const MOVEFILE_REPLACE_EXISTING: u32 = 1;
    const MOVEFILE_WRITE_THROUGH: u32 = 8;
    let ok = unsafe {
        MoveFileExW(
            from_w.as_ptr(),
            to_w.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
}

#[cfg(not(windows))]
fn replace_file(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::rename(from, to)
}

#[cfg(windows)]
fn read_user_region() -> String {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetUserDefaultGeoName(geo_name: *mut u16, geo_name_count: i32) -> i32;
    }
    let mut buf = [0u16; 16];
    let written = unsafe { GetUserDefaultGeoName(buf.as_mut_ptr(), buf.len() as i32) };
    if written <= 1 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..(written as usize) - 1])
}

#[cfg(not(windows))]
fn read_user_region() -> String {
    String::new()
}

#[tauri::command]
fn folio_user_region() -> String {
    read_user_region()
}

#[tauri::command]
fn folio_allow_path(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    state.allow_path(PathBuf::from(path));
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FontFilePayload {
    #[serde(rename = "fileName")]
    file_name: String,
    bytes: Vec<u8>,
}

fn font_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("fonts");
    std::fs::create_dir_all(dir.join("files")).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn safe_font_name(name: &str) -> Result<(), String> {
    let ok = name.len() == 68
        && (name.ends_with(".ttf") || name.ends_with(".otf"))
        && name.as_bytes()[..64].iter().all(|byte| byte.is_ascii_hexdigit())
        && !name.contains(['/', '\\']);
    if ok {
        Ok(())
    } else {
        Err("Font file name is not allowed.".to_string())
    }
}

#[tauri::command]
fn folio_pick_fonts(state: tauri::State<AppState>) -> Result<Vec<FilePayload>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("Fonts", &["ttf", "otf"])
        .pick_files();
    let mut opened = Vec::new();
    if let Some(paths) = files {
        for path in paths {
            let path_str = path.to_string_lossy().to_string();
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let bytes = std::fs::read(&path).map_err(|err| format!("Failed to read file: {}", err))?;
            state.allow_path(&path);
            opened.push(FilePayload {
                path: path_str,
                name,
                bytes,
            });
        }
    }
    Ok(opened)
}

#[tauri::command]
fn folio_font_list(app: tauri::AppHandle) -> Result<String, String> {
    let index = font_root(&app)?.join("index.json");
    if !index.exists() {
        return Ok("{\"families\":[]}".to_string());
    }
    std::fs::read_to_string(index).map_err(|err| err.to_string())
}

#[tauri::command]
fn folio_font_put(
    app: tauri::AppHandle,
    index_json: String,
    files: Vec<FontFilePayload>,
) -> Result<(), String> {
    let root = font_root(&app)?;
    let parsed: serde_json::Value =
        serde_json::from_str(&index_json).map_err(|err| err.to_string())?;
    let families = parsed
        .get("families")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Font index is missing families.".to_string())?;
    for file in &files {
        safe_font_name(&file.file_name)?;
        std::fs::write(root.join("files").join(&file.file_name), &file.bytes)
            .map_err(|err| err.to_string())?;
    }
    std::fs::write(root.join("index.json"), index_json).map_err(|err| err.to_string())?;
    let mut keep = HashSet::new();
    for family in families {
        if let Some(faces) = family.get("faces").and_then(|value| value.as_array()) {
            for face in faces {
                if let Some(name) = face.get("file").and_then(|value| value.as_str()) {
                    keep.insert(name.to_string());
                }
            }
        }
    }
    if let Ok(entries) = std::fs::read_dir(root.join("files")) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !keep.contains(&name) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn folio_font_read(app: tauri::AppHandle, file_name: String) -> Result<Vec<u8>, String> {
    safe_font_name(&file_name)?;
    std::fs::read(font_root(&app)?.join("files").join(file_name)).map_err(|err| err.to_string())
}

#[tauri::command]
fn folio_font_remove(app: tauri::AppHandle, family: String) -> Result<(), String> {
    let root = font_root(&app)?;
    let index_path = root.join("index.json");
    let current = if index_path.exists() {
        std::fs::read_to_string(&index_path).map_err(|err| err.to_string())?
    } else {
        "{\"families\":[]}".to_string()
    };
    let mut parsed: serde_json::Value =
        serde_json::from_str(&current).map_err(|err| err.to_string())?;
    let families = parsed
        .get_mut("families")
        .and_then(|value| value.as_array_mut())
        .ok_or_else(|| "Font index is missing families.".to_string())?;
    families.retain(|item| {
        item.get("family").and_then(|value| value.as_str()).unwrap_or("") != family
    });
    folio_font_put(
        app,
        serde_json::to_string(&parsed).map_err(|err| err.to_string())?,
        Vec::new(),
    )
}

pub fn run() {
    let app_state = AppState::default();

    let args: Vec<String> = std::env::args().collect();
    let mut launch_paths = Vec::new();
    for arg in args.iter().skip(1) {
        let p = PathBuf::from(arg);
        if p.exists() && p.is_file() {
            app_state.allow_path(&p);
            launch_paths.push(arg.clone());
        }
    }
    *app_state.launch_paths.lock().unwrap() = launch_paths;

    tauri::Builder::default()
        .manage(app_state)
        .plugin(single_instance_init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let mut paths = Vec::new();
                for arg in argv.iter().skip(1) {
                    let p = PathBuf::from(arg);
                    if p.exists() && p.is_file() {
                        let state = app.state::<AppState>();
                        state.allow_path(&p);
                        paths.push(arg.clone());
                    }
                }
                if !paths.is_empty() {
                    let _ = window.emit("folio://open-files", serde_json::json!({ "paths": paths }));
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
            folio_allow_path,
            folio_pick_fonts,
            folio_font_list,
            folio_font_put,
            folio_font_read,
            folio_font_remove,
            folio_path_status,
            folio_take_launch_paths,
            folio_choose,
            folio_user_region
        ])
        .run(tauri::generate_context!())
        .expect("error while running folio tauri application");
}

