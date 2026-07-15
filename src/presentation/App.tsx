import { useBoardStore, useMarkdownViewer } from "./context/appContext.ts";
import { DirectoryBrowser } from "./components/DirectoryBrowser.tsx";
import { KanbanBoard } from "./components/KanbanBoard.tsx";
import { MarkdownViewer } from "./components/MarkdownViewer.tsx";
import { RecentBoardList } from "./components/RecentBoardList.tsx";
import "./App.css";

function App() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);
  const markdownStatus = useMarkdownViewer((state) => state.status);

  if (status === "loaded" && board) {
    return (
      <div className="board-workspace">
        <KanbanBoard board={board} />
        {markdownStatus !== "idle" && <MarkdownViewer />}
      </div>
    );
  }

  return (
    <div className="start-screen">
      <RecentBoardList />
      <DirectoryBrowser />
    </div>
  );
}

export default App;
