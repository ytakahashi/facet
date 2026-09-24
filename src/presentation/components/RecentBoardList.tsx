import { useEffect } from "react";
import type { RecentBoardEntry } from "../../usecase/listRecentBoardEntries.ts";
import { useRecentBoards, useWorkspace } from "../context/appContext.ts";

function basenameOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

const STATUS_BADGES: Record<RecentBoardEntry["status"], string | undefined> = {
  available: undefined,
  missing: "File not found",
  unreadable: "Cannot read",
};

function RecentBoardEntryRow({ entry }: { entry: RecentBoardEntry }) {
  const openBoard = useWorkspace((state) => state.openBoard);
  const remove = useRecentBoards((state) => state.remove);
  const fileName = basenameOf(entry.path);
  // A hand-edited board can carry a blank name; the file name stands in so the
  // entry never renders without a heading.
  const name = entry.status === "available" && entry.name.trim() !== ""
    ? entry.name
    : undefined;
  const title = name ?? fileName;
  const badge = STATUS_BADGES[entry.status];

  return (
    <li
      className={`recent-board-list__item${
        entry.status === "available" ? "" : " recent-board-list__item--missing"
      }`}
    >
      {
        /* Still opens when the file cannot be read, so the user gets the
          reason from the open failure rather than a dead entry. */
      }
      <button
        type="button"
        className="recent-board-list__entry"
        onClick={() => openBoard(entry.path)}
      >
        <span className="recent-board-list__entry-heading">
          <span className="recent-board-list__entry-name">{title}</span>
          {name !== undefined && (
            <span className="recent-board-list__entry-file">{fileName}</span>
          )}
          {badge && (
            <span className="recent-board-list__entry-badge">{badge}</span>
          )}
        </span>
        <span className="recent-board-list__entry-path">{entry.path}</span>
      </button>
      <button
        type="button"
        className="recent-board-list__remove"
        aria-label={`Remove ${title} from Recent Boards`}
        title="Remove from Recent Boards"
        onClick={() => void remove(entry.path)}
      >
        ×
      </button>
    </li>
  );
}

export function RecentBoardList() {
  const entries = useRecentBoards((state) => state.entries);
  const error = useRecentBoards((state) => state.error);
  const load = useRecentBoards((state) => state.load);

  // Reloaded whenever the start screen is shown: board names are read from
  // their files, which may have changed since the last visit.
  useEffect(() => {
    void load();
  }, [load]);

  if (entries.length === 0 && !error) {
    return null;
  }

  return (
    <div className="recent-board-list">
      <h2>Recent Boards</h2>
      {error && <p role="alert">{error.message}</p>}
      <ul className="recent-board-list__entries">
        {entries.map((entry) => (
          <RecentBoardEntryRow key={entry.path} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
