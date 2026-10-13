//! Shows a card's file in Finder.
//!
//! Checking the file system and starting Finder happen in one host call. A file
//! may still disappear between the stat and `open`; that is a failed reveal,
//! not a reason to change the board's state.

use crate::literal::Literal;
use serde::Serialize;
use std::ffi::OsStr;
use std::fs::{self, Metadata};
use std::io::{self, ErrorKind};
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RevealFailure {
    NotFound,
    Failed,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum RevealInFinderResult {
    Revealed {
        revealed: Literal<true>,
    },
    NotRevealed {
        revealed: Literal<false>,
        reason: RevealFailure,
    },
}

fn not_revealed(reason: RevealFailure) -> RevealInFinderResult {
    RevealInFinderResult::NotRevealed {
        revealed: Literal,
        reason,
    }
}

/// Runs `open` with the given arguments and answers whether it succeeded.
pub fn run_open(args: &[&OsStr]) -> io::Result<bool> {
    let status = Command::new("open")
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    Ok(status.success())
}

// metadata (stat), so a symlink is revealed when its target is there.
fn metadata_if_present(path: &Path) -> io::Result<Option<Metadata>> {
    match fs::metadata(path) {
        Ok(metadata) => Ok(Some(metadata)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn reveal(
    path: &Path,
    open: impl FnOnce(&[&OsStr]) -> io::Result<bool>,
) -> io::Result<RevealInFinderResult> {
    let opened = if metadata_if_present(path)?.is_some() {
        open(&[OsStr::new("-R"), path.as_os_str()])?
    } else {
        // A card whose file is gone still has a directory worth showing.
        let Some(directory) = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        else {
            return Ok(not_revealed(RevealFailure::NotFound));
        };
        if !metadata_if_present(directory)?.is_some_and(|metadata| metadata.is_dir()) {
            return Ok(not_revealed(RevealFailure::NotFound));
        }
        open(&[directory.as_os_str()])?
    };
    Ok(if opened {
        RevealInFinderResult::Revealed { revealed: Literal }
    } else {
        not_revealed(RevealFailure::Failed)
    })
}

// Every failure other than "nothing to show" is reported as "failed" rather
// than raised: there is nothing the caller could do with the process error,
// and the user only needs to know Finder did not come up.
pub fn reveal_in_finder(
    path: &Path,
    open: impl FnOnce(&[&OsStr]) -> io::Result<bool>,
) -> RevealInFinderResult {
    reveal(path, open).unwrap_or_else(|_| not_revealed(RevealFailure::Failed))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::ffi::OsString;
    use tempfile::tempdir;

    // Records the arguments `open` would have been given, without starting
    // Finder.
    fn recording(
        calls: &RefCell<Vec<Vec<OsString>>>,
        answer: bool,
    ) -> impl FnOnce(&[&OsStr]) -> io::Result<bool> + '_ {
        move |args| {
            calls
                .borrow_mut()
                .push(args.iter().map(|arg| arg.to_os_string()).collect());
            Ok(answer)
        }
    }

    fn os_strings(args: &[&Path]) -> Vec<OsString> {
        args.iter()
            .map(|arg| arg.as_os_str().to_os_string())
            .collect()
    }

    #[test]
    fn reveals_an_existing_file_with_open_r() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Card\n").unwrap();
        let calls = RefCell::new(Vec::new());

        let result = reveal_in_finder(&path, recording(&calls, true));

        assert_eq!(result, RevealInFinderResult::Revealed { revealed: Literal });
        assert_eq!(calls.into_inner(), [os_strings(&[Path::new("-R"), &path])]);
    }

    #[test]
    fn opens_the_parent_when_the_file_is_gone() {
        let dir = tempdir().unwrap();
        let calls = RefCell::new(Vec::new());

        let result = reveal_in_finder(&dir.path().join("missing.md"), recording(&calls, true));

        assert_eq!(result, RevealInFinderResult::Revealed { revealed: Literal });
        assert_eq!(calls.into_inner(), [os_strings(&[dir.path()])]);
    }

    #[test]
    fn uses_the_root_directory_as_the_parent_of_a_root_level_file() {
        let path = Path::new("/facet-missing-7c1d2e9a-reveal.md");
        assert!(!path.exists(), "the fixture path must not exist");
        let calls = RefCell::new(Vec::new());

        let result = reveal_in_finder(path, recording(&calls, true));

        assert_eq!(result, RevealInFinderResult::Revealed { revealed: Literal });
        assert_eq!(calls.into_inner(), [os_strings(&[Path::new("/")])]);
    }

    #[test]
    fn does_not_start_finder_when_neither_file_nor_parent_exists() {
        let dir = tempdir().unwrap();
        let calls = RefCell::new(Vec::new());

        let result = reveal_in_finder(&dir.path().join("missing/card.md"), recording(&calls, true));

        assert_eq!(result, not_revealed(RevealFailure::NotFound));
        assert!(calls.into_inner().is_empty());
    }

    #[test]
    fn does_not_start_finder_for_a_bare_name_with_no_parent() {
        let calls = RefCell::new(Vec::new());

        let result = reveal_in_finder(
            Path::new("facet-missing-7c1d2e9a-reveal.md"),
            recording(&calls, true),
        );

        assert_eq!(result, not_revealed(RevealFailure::NotFound));
        assert!(calls.into_inner().is_empty());
    }

    #[test]
    fn reports_an_open_failure_without_exposing_a_process_error() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Card\n").unwrap();

        assert_eq!(
            reveal_in_finder(&path, |_| Ok(false)),
            not_revealed(RevealFailure::Failed)
        );
        assert_eq!(
            reveal_in_finder(&path, |_| Err(io::Error::other("open failed"))),
            not_revealed(RevealFailure::Failed)
        );
    }

    #[test]
    fn result_serialises_to_the_shape_the_webview_expects() {
        assert_eq!(
            serde_json::to_value(not_revealed(RevealFailure::NotFound)).unwrap(),
            serde_json::json!({ "revealed": false, "reason": "not-found" })
        );
    }
}
