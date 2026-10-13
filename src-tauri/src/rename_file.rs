//! Moves a card's Markdown file without ever replacing another file.
//!
//! Exercised against a real file system for the reason file_system.rs gives:
//! every rule here - what an inode means, what renaming a hard link does,
//! which failures come back as NotFound - is a rule of the file system.

use crate::literal::Literal;
use serde::Serialize;
use std::fs::{self, Metadata};
use std::io::{self, ErrorKind};
use std::os::unix::fs::MetadataExt;
use std::path::Path;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RenameFailure {
    NotFound,
    AlreadyExists,
    IsADirectory,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum RenameFileResult {
    Renamed {
        renamed: Literal<true>,
    },
    NotRenamed {
        renamed: Literal<false>,
        reason: RenameFailure,
    },
}

fn not_renamed(reason: RenameFailure) -> RenameFileResult {
    RenameFileResult::NotRenamed {
        renamed: Literal,
        reason,
    }
}

fn path_exists(path: &Path) -> io::Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

// Two paths can share an inode for two very different reasons: they are one
// directory entry spelled two ways (the case-only rename the inode check
// exists to allow), or they are separate hard links to the same file.
// Renaming a hard link onto its sibling succeeds while doing nothing, which
// would leave the file at both paths while the board followed it to one.
// The link count settles it on its own: a file with a single link cannot have
// a sibling anywhere. canonicalize (realpath) is consulted only when it might,
// so a case-only rename never depends on how realpath chooses to spell its
// answer - and when it cannot answer at all, the paths are called different,
// which costs a rename rather than a file.
fn names_the_same_entry(source: &Path, destination: &Path, metadata: &Metadata) -> bool {
    if metadata.nlink() == 1 {
        return true;
    }
    // canonicalize resolves a trailing symlink, so for a symlink it answers
    // about the target instead of about the entry, and two hard links to one
    // symlink both answer with that target. Nothing here can tell them apart,
    // so they are called different - the same safe direction taken when
    // canonicalize cannot answer at all.
    if metadata.file_type().is_symlink() {
        return false;
    }
    match (fs::canonicalize(source), fs::canonicalize(destination)) {
        (Ok(source), Ok(destination)) => source == destination,
        _ => false,
    }
}

// fs::rename replaces an existing destination without a word, so the check
// that nothing is about to be overwritten happens here, next to the call it
// guards: the two system calls stay inside one host call, which is as narrow
// as the gap between them can be made without an atomic primitive.
// The destination is compared by inode rather than by path: on the
// case-insensitive volumes macOS formats by default, renaming Task.md to
// task.md names the very same file, and that is a rename, not a collision.
// symlink_metadata (lstat), not metadata, so a dangling symlink at the
// destination still counts as occupied; fs::rename would replace it.
// The source needs no directory check of its own: the caller has just read it
// as text, which a directory cannot be.
pub fn rename_file(source: &Path, destination: &Path) -> io::Result<RenameFileResult> {
    match (
        fs::symlink_metadata(source),
        fs::symlink_metadata(destination),
    ) {
        (Ok(source_metadata), Ok(destination_metadata)) => {
            let is_same_inode = source_metadata.ino() == destination_metadata.ino()
                && source_metadata.dev() == destination_metadata.dev();
            if !is_same_inode || !names_the_same_entry(source, destination, &source_metadata) {
                // Told apart so the message can name what is actually in the
                // way: a directory is not a file the user can go and look at.
                return Ok(not_renamed(if destination_metadata.is_dir() {
                    RenameFailure::IsADirectory
                } else {
                    RenameFailure::AlreadyExists
                }));
            }
        }
        (Err(error), _) | (_, Err(error)) if error.kind() != ErrorKind::NotFound => {
            return Err(error);
        }
        // A missing source falls through to fs::rename, which reports it
        // below; a missing destination is the ordinary case and means nothing
        // is in the way.
        _ => {}
    }

    match fs::rename(source, destination) {
        Ok(()) => Ok(RenameFileResult::Renamed { renamed: Literal }),
        // NotFound also stands for a destination directory that is not there,
        // so the source is asked about before its absence is reported. Blaming
        // the source for the destination's problem would send the user off to
        // repair a card whose file never moved.
        Err(error) if error.kind() == ErrorKind::NotFound && !path_exists(source)? => {
            Ok(not_renamed(RenameFailure::NotFound))
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::file_system::test_support::file_names;
    use std::os::unix::fs::symlink;
    use tempfile::tempdir;

    #[test]
    fn moves_a_file_into_a_subdirectory_content_and_all() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::create_dir(dir.path().join("ideas")).unwrap();

        let result = rename_file(
            &dir.path().join("card.md"),
            &dir.path().join("ideas/card.md"),
        )
        .unwrap();

        assert_eq!(result, RenameFileResult::Renamed { renamed: Literal });
        assert_eq!(file_names(dir.path()), ["ideas"]);
        assert_eq!(
            fs::read_to_string(dir.path().join("ideas/card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn renames_a_file_when_only_its_letter_case_changes() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("Card.md"), "# Card\n").unwrap();

        let result = rename_file(&dir.path().join("Card.md"), &dir.path().join("card.md")).unwrap();

        // Holds on both kinds of volume: where the two names are the same entry
        // the rename only changes its spelling, and where they are not the
        // destination was free. Either way one file is left, under the new name.
        assert_eq!(result, RenameFileResult::Renamed { renamed: Literal });
        assert_eq!(file_names(dir.path()), ["card.md"]);
        assert_eq!(
            fs::read_to_string(dir.path().join("card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn refuses_a_destination_that_is_another_hard_link_to_the_same_file() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::hard_link(dir.path().join("card.md"), dir.path().join("linked.md")).unwrap();

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("linked.md")).unwrap();

        // The rename would report success while leaving the file at both paths.
        assert_eq!(result, not_renamed(RenameFailure::AlreadyExists));
        assert_eq!(file_names(dir.path()), ["card.md", "linked.md"]);
    }

    #[test]
    fn refuses_a_destination_that_is_another_hard_link_to_the_same_symlink() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("target.md");
        fs::write(&target, "# Card\n").unwrap();
        symlink(&target, dir.path().join("card.md")).unwrap();
        // Hard-linking a symlink links the symlink itself, so both names share
        // one inode while canonicalize answers about the target for either.
        fs::hard_link(dir.path().join("card.md"), dir.path().join("linked.md")).unwrap();
        assert!(
            fs::symlink_metadata(dir.path().join("linked.md"))
                .unwrap()
                .file_type()
                .is_symlink(),
            "the fixture must link the symlink, not its target"
        );

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("linked.md")).unwrap();

        assert_eq!(result, not_renamed(RenameFailure::AlreadyExists));
        assert_eq!(
            file_names(dir.path()),
            ["card.md", "linked.md", "target.md"]
        );
    }

    #[test]
    fn renames_a_symlink_that_has_no_other_hard_link() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("target.md");
        fs::write(&target, "# Card\n").unwrap();
        symlink(&target, dir.path().join("card.md")).unwrap();

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("renamed.md")).unwrap();

        assert_eq!(result, RenameFileResult::Renamed { renamed: Literal });
        assert_eq!(file_names(dir.path()), ["renamed.md", "target.md"]);
        assert_eq!(
            fs::read_to_string(dir.path().join("renamed.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn refuses_to_overwrite_another_file() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::write(dir.path().join("taken.md"), "# Taken\n").unwrap();

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("taken.md")).unwrap();

        assert_eq!(result, not_renamed(RenameFailure::AlreadyExists));
        assert_eq!(
            fs::read_to_string(dir.path().join("taken.md")).unwrap(),
            "# Taken\n"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn refuses_a_destination_occupied_by_a_directory() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::create_dir(dir.path().join("ideas.md")).unwrap();

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("ideas.md")).unwrap();

        assert_eq!(result, not_renamed(RenameFailure::IsADirectory));
        assert_eq!(
            fs::read_to_string(dir.path().join("card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn refuses_a_destination_occupied_by_a_dangling_symlink() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        symlink(dir.path().join("nowhere.md"), dir.path().join("taken.md")).unwrap();

        let result =
            rename_file(&dir.path().join("card.md"), &dir.path().join("taken.md")).unwrap();

        assert_eq!(result, not_renamed(RenameFailure::AlreadyExists));
        assert_eq!(
            fs::read_to_string(dir.path().join("card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn reports_a_source_that_is_not_there() {
        let dir = tempdir().unwrap();

        let result = rename_file(&dir.path().join("gone.md"), &dir.path().join("card.md")).unwrap();

        assert_eq!(result, not_renamed(RenameFailure::NotFound));
    }

    #[test]
    fn fails_rather_than_blaming_the_source_when_the_destination_directory_is_missing() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();

        let error = rename_file(
            &dir.path().join("card.md"),
            &dir.path().join("missing/card.md"),
        )
        .unwrap_err();

        // Reported as a failure, not as a missing card file: the Markdown is
        // still where the board says it is.
        assert_eq!(error.kind(), ErrorKind::NotFound);
        assert_eq!(
            fs::read_to_string(dir.path().join("card.md")).unwrap(),
            "# Card\n"
        );
    }

    #[test]
    fn result_serialises_to_the_shape_the_webview_expects() {
        assert_eq!(
            serde_json::to_value(not_renamed(RenameFailure::AlreadyExists)).unwrap(),
            serde_json::json!({ "renamed": false, "reason": "already-exists" })
        );
    }
}
