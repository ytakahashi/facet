//! The file-system half of what the webview may ask the host to do.
//!
//! Nothing here may reference `tauri`: these functions are exercised against a
//! real file system, because what they are careful about - an empty directory
//! that removes like a file, a write that lands short, the two things NotFound
//! can mean - are facts about the file system rather than about this
//! application, and a stubbed test would only restate the assumptions being
//! questioned.
//!
//! Every failure a caller has to tell apart is returned as data, mirroring the
//! result types in `src/infrastructure/hostCommands.ts`; the two sides are
//! compiled separately and have to be kept in step by hand. Anything else is an
//! `io::Error`, which the webview sees as a failed operation.

use crate::literal::Literal;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::path::Path;

pub type FileRevision = String;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NotFound {
    NotFound,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum ReadTextFileResult {
    Read {
        read: Literal<true>,
        content: String,
        revision: FileRevision,
    },
    NotRead {
        read: Literal<false>,
        reason: NotFound,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WriteFailure {
    RevisionMismatch,
    NotFound,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum WriteTextFileResult {
    Written {
        written: Literal<true>,
        revision: FileRevision,
    },
    NotWritten {
        written: Literal<false>,
        reason: WriteFailure,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AlreadyExists {
    AlreadyExists,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum CreateTextFileResult {
    Created {
        created: Literal<true>,
    },
    NotCreated {
        created: Literal<false>,
        reason: AlreadyExists,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RemoveFailure {
    NotFound,
    IsADirectory,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum RemoveFileResult {
    Removed {
        removed: Literal<true>,
    },
    NotRemoved {
        removed: Literal<false>,
        reason: RemoveFailure,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
}

fn revision_of(bytes: &[u8]) -> FileRevision {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

// Decoded the way the web's TextDecoder decodes: invalid UTF-8 becomes U+FFFD
// rather than an error, and a leading BOM is dropped. A card that is not valid
// UTF-8 still opens; saving it writes the replacement characters back. The
// revision is still taken from the raw bytes, so a file that differs only in
// its BOM is a different revision.
fn decode(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    text.strip_prefix('\u{feff}').unwrap_or(&text).to_owned()
}

// A missing file is reported as data, the same way create_text_file reports
// one that is already there. Callers that repair a card's path need "nothing
// is there" told apart from "there but unreadable".
pub fn read_text_file(path: &Path) -> io::Result<ReadTextFileResult> {
    match fs::read(path) {
        Ok(bytes) => Ok(ReadTextFileResult::Read {
            read: Literal,
            content: decode(&bytes),
            revision: revision_of(&bytes),
        }),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(ReadTextFileResult::NotRead {
            read: Literal,
            reason: NotFound::NotFound,
        }),
        Err(error) => Err(error),
    }
}

// Only a revision opts into conditional writing. The webview sends null for an
// omitted one, and both arrive here as None, keeping the unconditional write
// promised to callers that leave it out.
pub fn write_text_file(
    path: &Path,
    content: &str,
    expected_revision: Option<&str>,
) -> io::Result<WriteTextFileResult> {
    if let Some(expected) = expected_revision {
        let current = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                return Ok(WriteTextFileResult::NotWritten {
                    written: Literal,
                    reason: WriteFailure::NotFound,
                });
            }
            Err(error) => return Err(error),
        };
        if revision_of(&current) != expected {
            return Ok(WriteTextFileResult::NotWritten {
                written: Literal,
                reason: WriteFailure::RevisionMismatch,
            });
        }
    }

    // There is no atomic compare-and-write primitive. Keeping the check and the
    // write in this one host call narrows, but cannot close, the race between
    // observing the current revision and replacing the file.
    fs::write(path, content)?;
    Ok(WriteTextFileResult::Written {
        written: Literal,
        revision: revision_of(content.as_bytes()),
    })
}

// Exclusive through create_new (O_EXCL) rather than an exists() check followed
// by a write: creating a card's Markdown must never land on a file that is
// already there, and only the open(2) flag decides that without leaving a gap
// for one to appear in. A directory in the way is refused the same way.
// write_all loops over partial writes, so a short write never leaves a
// truncated file behind a "created" result.
pub fn create_text_file(path: &Path, content: &str) -> io::Result<CreateTextFileResult> {
    let mut file = match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            return Ok(CreateTextFileResult::NotCreated {
                created: Literal,
                reason: AlreadyExists::AlreadyExists,
            });
        }
        Err(error) => return Err(error),
    };
    file.write_all(content.as_bytes())?;
    Ok(CreateTextFileResult::Created { created: Literal })
}

// A board.yaml can name a directory (a hand-written path, or a directory
// literally named "foo.md"), so directories are rejected explicitly rather than
// left to remove_file's own refusal, whose error would not say why.
// symlink_metadata (lstat), not metadata, so the check describes the path
// itself: a symlink to a Markdown file - or to a directory - is one directory
// entry, and removing it leaves its target alone.
pub fn remove_file(path: &Path) -> io::Result<RemoveFileResult> {
    let not_found = || {
        Ok(RemoveFileResult::NotRemoved {
            removed: Literal,
            reason: RemoveFailure::NotFound,
        })
    };
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() => {
            return Ok(RemoveFileResult::NotRemoved {
                removed: Literal,
                reason: RemoveFailure::IsADirectory,
            });
        }
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => return not_found(),
        Err(error) => return Err(error),
    }
    match fs::remove_file(path) {
        Ok(()) => Ok(RemoveFileResult::Removed { removed: Literal }),
        Err(error) if error.kind() == ErrorKind::NotFound => not_found(),
        Err(error) => Err(error),
    }
}

// Copied field by field: the boundary only ever hands over what the view asked
// about. file_type() does not follow symlinks, so a symlink to a directory is
// reported as not a directory.
pub fn read_dir(path: &Path) -> io::Result<Vec<DirEntry>> {
    fs::read_dir(path)?
        .map(|entry| {
            let entry = entry?;
            Ok(DirEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_directory: entry.file_type()?.is_dir(),
            })
        })
        .collect()
}

pub fn home_directory() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/".to_owned())
}

// Answers about the path resolved, not about the entry: a symlink counts as
// existing when its target does. Any failure at all means "no", because the
// only caller uses this to decide whether a card's file is still there and a
// path it cannot even stat is no better than a missing one.
pub fn exists(path: &Path) -> bool {
    fs::metadata(path).is_ok()
}

pub fn mkdir(path: &Path) -> io::Result<()> {
    fs::create_dir_all(path)
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::fs;
    use std::path::Path;

    pub fn file_names(directory: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::file_names;
    use super::*;
    use serde_json::json;
    use std::os::unix::fs::symlink;
    use tempfile::{TempDir, tempdir};

    // Run against a real directory rather than a stub: see the module comment.
    fn temp_dir() -> TempDir {
        tempdir().unwrap()
    }

    fn read_ok(path: &Path) -> (String, FileRevision) {
        match read_text_file(path).unwrap() {
            ReadTextFileResult::Read {
                content, revision, ..
            } => (content, revision),
            other => panic!("expected {} to be read, got {other:?}", path.display()),
        }
    }

    fn written_revision(result: WriteTextFileResult) -> FileRevision {
        match result {
            WriteTextFileResult::Written { revision, .. } => revision,
            other => panic!("expected the write to succeed, got {other:?}"),
        }
    }

    #[test]
    fn results_serialise_to_the_shapes_the_webview_expects() {
        let cases = [
            (
                serde_json::to_value(ReadTextFileResult::Read {
                    read: Literal,
                    content: "# Card\n".to_owned(),
                    revision: "abc".to_owned(),
                }),
                json!({ "read": true, "content": "# Card\n", "revision": "abc" }),
            ),
            (
                serde_json::to_value(ReadTextFileResult::NotRead {
                    read: Literal,
                    reason: NotFound::NotFound,
                }),
                json!({ "read": false, "reason": "not-found" }),
            ),
            (
                serde_json::to_value(WriteTextFileResult::NotWritten {
                    written: Literal,
                    reason: WriteFailure::RevisionMismatch,
                }),
                json!({ "written": false, "reason": "revision-mismatch" }),
            ),
            (
                serde_json::to_value(CreateTextFileResult::NotCreated {
                    created: Literal,
                    reason: AlreadyExists::AlreadyExists,
                }),
                json!({ "created": false, "reason": "already-exists" }),
            ),
            (
                serde_json::to_value(RemoveFileResult::NotRemoved {
                    removed: Literal,
                    reason: RemoveFailure::IsADirectory,
                }),
                json!({ "removed": false, "reason": "is-a-directory" }),
            ),
            (
                serde_json::to_value(DirEntry {
                    name: "ideas".to_owned(),
                    is_directory: true,
                }),
                json!({ "name": "ideas", "isDirectory": true }),
            ),
        ];
        for (actual, expected) in cases {
            assert_eq!(actual.unwrap(), expected);
        }
    }

    #[test]
    fn read_text_file_reads_a_files_content() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Card\n").unwrap();

        let (content, revision) = read_ok(&path);

        assert_eq!(content, "# Card\n");
        assert!(!revision.is_empty());
    }

    #[test]
    fn read_text_file_reports_a_file_that_is_not_there() {
        let dir = temp_dir();

        assert_eq!(
            read_text_file(&dir.path().join("gone.md")).unwrap(),
            ReadTextFileResult::NotRead {
                read: Literal,
                reason: NotFound::NotFound,
            }
        );
    }

    #[test]
    fn read_text_file_fails_rather_than_reporting_an_unreadable_path() {
        let dir = temp_dir();
        let path = dir.path().join("ideas.md");
        fs::create_dir(&path).unwrap();

        // Only "nothing is there" is data. Anything else is a failure, so a
        // caller repairing a card's path never mistakes a path it could not
        // read for one whose file is gone.
        assert!(read_text_file(&path).is_err());
    }

    #[test]
    fn read_text_file_drops_a_leading_bom_but_its_revision_keeps_it() {
        let dir = temp_dir();
        let with_bom = dir.path().join("bom.md");
        let without_bom = dir.path().join("plain.md");
        fs::write(&with_bom, "\u{feff}# Card\n").unwrap();
        fs::write(&without_bom, "# Card\n").unwrap();

        let (bom_content, bom_revision) = read_ok(&with_bom);
        let (plain_content, plain_revision) = read_ok(&without_bom);

        assert_eq!(bom_content, plain_content);
        assert_ne!(bom_revision, plain_revision);
    }

    #[test]
    fn read_text_file_replaces_invalid_utf8_instead_of_failing() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, b"# Caf\xe9\n").unwrap();

        assert_eq!(read_ok(&path).0, "# Caf\u{fffd}\n");
    }

    #[test]
    fn write_text_file_replaces_the_whole_of_an_existing_file() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# A much longer card\n").unwrap();

        let revision = written_revision(write_text_file(&path, "# Card\n", None).unwrap());

        assert!(!revision.is_empty());
        assert_eq!(fs::read_to_string(&path).unwrap(), "# Card\n");
    }

    #[test]
    fn write_text_file_writes_when_the_expected_revision_matches() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Before\n").unwrap();
        let (_, before) = read_ok(&path);

        let after = written_revision(write_text_file(&path, "# After\n", Some(&before)).unwrap());

        assert_eq!(read_ok(&path), ("# After\n".to_owned(), after));
    }

    #[test]
    fn write_text_file_refuses_a_stale_revision_without_changing_the_file() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Original\n").unwrap();
        let (_, original) = read_ok(&path);
        fs::write(&path, "# External change\n").unwrap();

        assert_eq!(
            write_text_file(&path, "# Facet change\n", Some(&original)).unwrap(),
            WriteTextFileResult::NotWritten {
                written: Literal,
                reason: WriteFailure::RevisionMismatch,
            }
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "# External change\n");
    }

    #[test]
    fn write_text_file_gives_the_same_revision_to_the_same_content() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");

        let first = write_text_file(&path, "# Card\n", None).unwrap();
        let second = write_text_file(&path, "# Card\n", None).unwrap();

        assert_eq!(first, second);
    }

    #[test]
    fn write_text_file_still_creates_a_file_without_an_expected_revision() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");

        written_revision(write_text_file(&path, "# Card\n", None).unwrap());

        assert_eq!(fs::read_to_string(&path).unwrap(), "# Card\n");
    }

    #[test]
    fn write_text_file_does_not_create_a_missing_file_when_a_revision_is_expected() {
        let dir = temp_dir();
        let path = dir.path().join("gone.md");

        assert_eq!(
            write_text_file(&path, "# Card\n", Some("old-revision")).unwrap(),
            WriteTextFileResult::NotWritten {
                written: Literal,
                reason: WriteFailure::NotFound,
            }
        );
        assert!(!exists(&path));
    }

    #[test]
    fn create_text_file_creates_a_file_with_its_content() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");

        assert_eq!(
            create_text_file(&path, "# Card\n").unwrap(),
            CreateTextFileResult::Created { created: Literal }
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "# Card\n");
    }

    #[test]
    fn create_text_file_writes_content_larger_than_a_single_write() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        // Long enough that the write can be split, which is what write_all is
        // there for: a partial write must never be reported as a created file.
        let content = format!("# Card\n\n{}", "body\n".repeat(400_000));

        assert_eq!(
            create_text_file(&path, &content).unwrap(),
            CreateTextFileResult::Created { created: Literal }
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), content);
    }

    #[test]
    fn create_text_file_refuses_a_file_that_is_already_there() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Taken\n").unwrap();

        assert_eq!(
            create_text_file(&path, "# Card\n").unwrap(),
            CreateTextFileResult::NotCreated {
                created: Literal,
                reason: AlreadyExists::AlreadyExists,
            }
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), "# Taken\n");
    }

    #[test]
    fn create_text_file_refuses_a_directory_in_the_way() {
        let dir = temp_dir();
        let path = dir.path().join("ideas.md");
        fs::create_dir(&path).unwrap();

        assert_eq!(
            create_text_file(&path, "# Card\n").unwrap(),
            CreateTextFileResult::NotCreated {
                created: Literal,
                reason: AlreadyExists::AlreadyExists,
            }
        );
    }

    #[test]
    fn remove_file_removes_a_file() {
        let dir = temp_dir();
        let path = dir.path().join("card.md");
        fs::write(&path, "# Card\n").unwrap();

        assert_eq!(
            remove_file(&path).unwrap(),
            RemoveFileResult::Removed { removed: Literal }
        );
        assert!(file_names(dir.path()).is_empty());
    }

    #[test]
    fn remove_file_refuses_an_empty_directory() {
        let dir = temp_dir();
        let path = dir.path().join("ideas.md");
        fs::create_dir(&path).unwrap();

        assert_eq!(
            remove_file(&path).unwrap(),
            RemoveFileResult::NotRemoved {
                removed: Literal,
                reason: RemoveFailure::IsADirectory,
            }
        );
        assert_eq!(file_names(dir.path()), ["ideas.md"]);
    }

    #[test]
    fn remove_file_reports_a_file_that_is_not_there() {
        let dir = temp_dir();

        assert_eq!(
            remove_file(&dir.path().join("gone.md")).unwrap(),
            RemoveFileResult::NotRemoved {
                removed: Literal,
                reason: RemoveFailure::NotFound,
            }
        );
    }

    #[test]
    fn remove_file_removes_a_symlink_and_leaves_its_target() {
        let dir = temp_dir();
        let target = dir.path().join("target.md");
        fs::write(&target, "# Card\n").unwrap();
        symlink(&target, dir.path().join("card.md")).unwrap();

        assert_eq!(
            remove_file(&dir.path().join("card.md")).unwrap(),
            RemoveFileResult::Removed { removed: Literal }
        );
        assert_eq!(file_names(dir.path()), ["target.md"]);
    }

    #[test]
    fn remove_file_removes_a_symlink_to_a_directory_and_leaves_the_directory() {
        let dir = temp_dir();
        let ideas = dir.path().join("ideas");
        fs::create_dir(&ideas).unwrap();
        symlink(&ideas, dir.path().join("link.md")).unwrap();

        // The link is not a directory, so it is removed; the directory it
        // pointed at stays. Only the one directory entry goes.
        assert_eq!(
            remove_file(&dir.path().join("link.md")).unwrap(),
            RemoveFileResult::Removed { removed: Literal }
        );
        assert_eq!(file_names(dir.path()), ["ideas"]);
    }

    #[test]
    fn read_dir_tells_files_and_directories_apart() {
        let dir = temp_dir();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::create_dir(dir.path().join("ideas")).unwrap();

        let mut entries = read_dir(dir.path()).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));

        assert_eq!(
            entries,
            [
                DirEntry {
                    name: "card.md".to_owned(),
                    is_directory: false,
                },
                DirEntry {
                    name: "ideas".to_owned(),
                    is_directory: true,
                },
            ]
        );
    }

    #[test]
    fn read_dir_answers_with_nothing_for_an_empty_directory() {
        let dir = temp_dir();

        assert!(read_dir(dir.path()).unwrap().is_empty());
    }

    #[test]
    fn exists_answers_for_files_directories_and_what_is_not_there() {
        let dir = temp_dir();
        fs::write(dir.path().join("card.md"), "# Card\n").unwrap();
        fs::create_dir(dir.path().join("ideas")).unwrap();

        assert!(exists(&dir.path().join("card.md")));
        assert!(exists(&dir.path().join("ideas")));
        assert!(!exists(&dir.path().join("gone.md")));
    }

    #[test]
    fn exists_follows_a_symlink_to_whatever_it_points_at() {
        let dir = temp_dir();
        let target = dir.path().join("target.md");
        fs::write(&target, "# Card\n").unwrap();
        symlink(&target, dir.path().join("card.md")).unwrap();
        symlink(
            dir.path().join("nowhere.md"),
            dir.path().join("dangling.md"),
        )
        .unwrap();

        // metadata, not symlink_metadata: a dangling link is a card whose file
        // is gone, which is exactly what the caller wants to hear about.
        assert!(exists(&dir.path().join("card.md")));
        assert!(!exists(&dir.path().join("dangling.md")));
    }

    #[test]
    fn mkdir_creates_missing_parent_directories() {
        let dir = temp_dir();
        let path = dir.path().join("boards/personal");

        mkdir(&path).unwrap();

        assert!(fs::metadata(&path).unwrap().is_dir());
    }

    #[test]
    fn mkdir_accepts_a_directory_that_is_already_there() {
        let dir = temp_dir();
        let boards = dir.path().join("boards");
        fs::create_dir(&boards).unwrap();
        fs::write(boards.join("board.yaml"), "columns: []\n").unwrap();

        mkdir(&boards).unwrap();

        // Nothing inside is disturbed: the config directory is created this
        // way on every launch, long after it first held anything.
        assert_eq!(file_names(&boards), ["board.yaml"]);
    }
}
