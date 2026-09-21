use std::{
    fs,
    io,
    path::{Path, PathBuf},
    process::{Child, Command},
    sync::Mutex,
};

use tauri::{Manager, RunEvent};

struct AutomationServiceState {
    child: Mutex<Option<Child>>,
    data_dir: PathBuf,
    browser_dir: PathBuf,
}

#[tauri::command]
fn get_automation_service_url() -> String {
    "http://127.0.0.1:3001".to_string()
}

#[tauri::command]
fn get_automation_service_token() -> Result<String, String> {
    if let Ok(token) = std::env::var("HT_DOLA_AUTH_TOKEN") {
        if !token.trim().is_empty() {
            return Ok(token);
        }
    }

    let data_directory = if let Ok(path) = std::env::var("HT_DOLA_DATA_DIR") {
        PathBuf::from(path)
    } else if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data")
    } else {
        let app_data = std::env::var("APPDATA").map_err(|_| "APPDATA is unavailable".to_string())?;
        PathBuf::from(app_data).join("HT_Dola_Studio/data")
    };

    std::fs::read_to_string(data_directory.join("logs/.auth_token"))
        .map(|token| token.trim().to_string())
        .map_err(|_| "Automation service token is unavailable".to_string())
}

#[tauri::command]
fn get_production_paths(state: tauri::State<'_, AutomationServiceState>) -> serde_json::Value {
    serde_json::json!({
        "dataDir": state.data_dir,
        "browserDir": state.browser_dir,
        "logsDir": state.data_dir.join("logs"),
    })
}

fn app_data_root() -> Result<PathBuf, String> {
    let app_data = std::env::var("APPDATA").map_err(|_| "APPDATA is unavailable".to_string())?;
    Ok(PathBuf::from(app_data).join("HT_Dola_Studio"))
}

fn boxed_error(message: String) -> Box<dyn std::error::Error> {
    Box::new(io::Error::new(io::ErrorKind::Other, message))
}

fn resolve_resource(app: &tauri::App, relative: &str) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map(|dir| dir.join(relative))
        .map_err(|error| format!("Unable to resolve resource directory: {error}"))
}

fn spawn_automation_service(app: &tauri::App, data_dir: &Path, browser_dir: &Path) -> Result<Child, String> {
    let node_exe = resolve_resource(app, "resources/node/node.exe")?;
    let service_entry = resolve_resource(app, "resources/automation-service/dist/index.js")?;
    let service_dir = resolve_resource(app, "resources/automation-service")?;

    if !node_exe.exists() {
        return Err(format!("Packaged Node runtime is missing: {}", node_exe.display()));
    }
    if !service_entry.exists() {
        return Err(format!("Packaged automation service entry is missing: {}", service_entry.display()));
    }

    let mut command = Command::new(node_exe);
    command
        .arg(service_entry)
        .current_dir(service_dir)
        .env("NODE_ENV", "production")
        .env("PORT", "3001")
        .env("HT_DOLA_DATA_DIR", data_dir)
        .env("PLAYWRIGHT_BROWSERS_PATH", browser_dir)
        .env("HT_DOLA_AUTO_INSTALL_BROWSERS", "1");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
    }

    command.spawn().map_err(|error| format!("Unable to start automation service: {error}"))
}

fn stop_automation_service(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AutomationServiceState>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_root = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data")
            } else {
                app_data_root().map_err(boxed_error)?.join("data")
            };
            let browser_root = if cfg!(debug_assertions) {
                data_root.join("browsers")
            } else {
                app_data_root().map_err(boxed_error)?.join("browsers")
            };

            fs::create_dir_all(data_root.join("logs"))?;
            fs::create_dir_all(data_root.join("projects"))?;
            fs::create_dir_all(data_root.join("profiles"))?;
            fs::create_dir_all(data_root.join("downloads"))?;
            fs::create_dir_all(&browser_root)?;

            let child = if cfg!(debug_assertions) {
                None
            } else {
                Some(spawn_automation_service(app, &data_root, &browser_root)
                    .map_err(boxed_error)?)
            };

            app.manage(AutomationServiceState {
                child: Mutex::new(child),
                data_dir: data_root,
                browser_dir: browser_root,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_automation_service_url,
            get_automation_service_token,
            get_production_paths
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                stop_automation_service(app);
            }
        });
}
