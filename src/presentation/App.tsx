import {
  useBoardStore,
  useMarkdownViewer,
  useNewBoardDialog,
} from "./context/appContext.ts";
import { DirectoryBrowser } from "./components/DirectoryBrowser.tsx";
import { FilterSidebar } from "./components/FilterSidebar.tsx";
import { KanbanBoard } from "./components/KanbanBoard.tsx";
import { MarkdownViewer } from "./components/MarkdownViewer.tsx";
import { NewBoardDialog } from "./components/NewBoardDialog.tsx";
import { RecentBoardList } from "./components/RecentBoardList.tsx";
import "./App.css";

function App() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);
  const markdownStatus = useMarkdownViewer((state) => state.status);
  const openNewBoardDialog = useNewBoardDialog((state) => state.open);

  return (
    <>
      {status === "loaded" && board
        ? (
          <div className="board-workspace">
            <FilterSidebar />
            <KanbanBoard board={board} />
            {markdownStatus !== "idle" && <MarkdownViewer />}
          </div>
        )
        : (
          <div className="start-screen">
            <div className="start-screen__actions">
              <button
                type="button"
                className="start-screen__new-board"
                onClick={openNewBoardDialog}
              >
                New Board…
              </button>
            </div>
            <RecentBoardList />
            <DirectoryBrowser />
          </div>
        )}
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
