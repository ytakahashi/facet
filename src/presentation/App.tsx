import { useBoardStore, useMarkdownViewer } from "./context/appContext.ts";
import { FilterSidebar } from "./components/FilterSidebar.tsx";
import { KanbanBoard } from "./components/KanbanBoard.tsx";
import { MarkdownViewer } from "./components/MarkdownViewer.tsx";
import { NewBoardDialog } from "./components/NewBoardDialog.tsx";
import { StartScreen } from "./components/StartScreen.tsx";
import "./App.css";

function App() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);
  const markdownStatus = useMarkdownViewer((state) => state.status);

  return (
    <>
      {status === "loaded" && board
        ? (
          <div className="board-workspace">
            <FilterSidebar board={board} />
            <KanbanBoard board={board} />
            {markdownStatus !== "idle" && <MarkdownViewer />}
          </div>
        )
        : <StartScreen />}
      {
        /* Mounted once outside both branches: creating a board switches the
          branch mid-submit, and remounting the dialog then would close it
          before the submit handler finishes. */
      }
      <NewBoardDialog />
    </>
  );
}

export default App;
