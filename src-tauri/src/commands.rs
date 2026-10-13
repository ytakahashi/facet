//! The webview's entry points into the host, and nothing else: argument
//! conversion and error flattening only. Each command has a typed wrapper of
//! the same name, in camelCase, in `src/infrastructure/hostCommands.ts`.
//!
//! Commands are `async` so the work runs off the main thread - a plain
//! `#[tauri::command]` runs on it and would stall the window for the length of
//! every file operation. Arguments are owned because async commands cannot
//! borrow from the request.
//!
//! An `io::Error` becomes a string: it rejects the invoke promise, which the
//! adapter turns into an operation-failed error. Failures a caller has to tell
//! apart never get here; the modules below report those as data.

use crate::file_system::{
    self, CreateTextFileResult, DirEntry, ReadTextFileResult, RemoveFileResult, WriteTextFileResult,
};
use crate::rename_file::{self, RenameFileResult};
use crate::reveal_in_finder::{self, RevealInFinderResult};
use std::io;
use std::path::PathBuf;

fn to_message(error: io::Error) -> String {
    error.to_string()
}

#[tauri::command]
pub async fn read_text_file(path: PathBuf) -> Result<ReadTextFileResult, String> {
    file_system::read_text_file(&path).map_err(to_message)
}

// Called as `expectedRevision` from the webview, which sends null for an
// omitted revision; null and absence both arrive as None.
#[tauri::command]
pub async fn write_text_file(
    path: PathBuf,
    content: String,
    expected_revision: Option<String>,
) -> Result<WriteTextFileResult, String> {
    file_system::write_text_file(&path, &content, expected_revision.as_deref()).map_err(to_message)
}

#[tauri::command]
pub async fn create_text_file(
    path: PathBuf,
    content: String,
) -> Result<CreateTextFileResult, String> {
    file_system::create_text_file(&path, &content).map_err(to_message)
}

#[tauri::command]
pub async fn remove_file(path: PathBuf) -> Result<RemoveFileResult, String> {
    file_system::remove_file(&path).map_err(to_message)
}

#[tauri::command]
pub async fn rename_file(from_path: PathBuf, to_path: PathBuf) -> Result<RenameFileResult, String> {
    rename_file::rename_file(&from_path, &to_path).map_err(to_message)
}

#[tauri::command]
pub async fn read_dir(path: PathBuf) -> Result<Vec<DirEntry>, String> {
    file_system::read_dir(&path).map_err(to_message)
}

#[tauri::command]
pub async fn home_directory() -> String {
    file_system::home_directory()
}

#[tauri::command]
pub async fn exists(path: PathBuf) -> bool {
    file_system::exists(&path)
}

#[tauri::command]
pub async fn mkdir(path: PathBuf) -> Result<(), String> {
    file_system::mkdir(&path).map_err(to_message)
}

#[tauri::command]
pub async fn reveal_in_finder(path: PathBuf) -> RevealInFinderResult {
    reveal_in_finder::reveal_in_finder(&path, reveal_in_finder::run_open)
}
