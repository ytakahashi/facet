mod commands;
mod file_system;
mod literal;
mod rename_file;
mod reveal_in_finder;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::write_text_file,
            commands::create_text_file,
            commands::remove_file,
            commands::rename_file,
            commands::read_dir,
            commands::home_directory,
            commands::exists,
            commands::mkdir,
            commands::reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Facet host");
}
