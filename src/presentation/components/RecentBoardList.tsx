import { useEffect, useState } from "react";
import { useBoardStore, useRecentBoards } from "../context/appContext.ts";

function basenameOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function RecentBoardList() {
  const { list } = useRecentBoards();
  const openBoard = useBoardStore((state) => state.openBoard);
  const [recentBoards, setRecentBoards] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    list().then((paths) => {
      if (!cancelled) {
        setRecentBoards(paths);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [list]);

  if (recentBoards.length === 0) {
    return null;
  }

  return (
    <div className="recent-board-list">
      <h2>Recent Boards</h2>
      <ul className="recent-board-list__entries">
        {recentBoards.map((path) => (
          <li key={path}>
            <button
              type="button"
              className="recent-board-list__entry"
              onClick={() => void openBoard(path)}
            >
              <span className="recent-board-list__entry-name">
                {basenameOf(path)}
              </span>
              <span className="recent-board-list__entry-path">{path}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
