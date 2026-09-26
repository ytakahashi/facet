import {
  BoardSessionProvider,
  useBoardStore,
  useMarkdownViewer,
  useWorkspace,
} from "./context/appContext.ts";
import { FilterSidebar } from "./components/FilterSidebar.tsx";
import { BoardScreen } from "./components/BoardScreen.tsx";
import { MarkdownViewer } from "./components/MarkdownViewer.tsx";
import { NewBoardDialog } from "./components/NewBoardDialog.tsx";
import { StartScreen } from "./components/StartScreen.tsx";
import { TabBar } from "./components/TabBar.tsx";
import "./App.css";

function BoardView() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);
  const error = useBoardStore((state) => state.error);
  const markdownStatus = useMarkdownViewer((state) => state.status);

  if (status === "loading" || status === "empty") {
    return <p className="board-load-state">Opening board…</p>;
  }
  if (status === "error") {
    return <p className="board-load-state" role="alert">{error}</p>;
  }
  if (!board) {
    throw new Error("A loaded board must have board data");
  }

  return (
    <div className="board-workspace">
      <FilterSidebar board={board} />
      <div className="board-main">
        <BoardScreen board={board} />
        {markdownStatus !== "idle" && <MarkdownViewer />}
      </div>
    </div>
  );
}

function App() {
  const tabs = useWorkspace((state) => state.tabs);
  const activeTabId = useWorkspace((state) => state.activeTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <>
      <TabBar />
      <div
        id="workspace-panel"
        role="tabpanel"
        aria-labelledby={activeTab ? `board-tab-${activeTab.id}` : "start-tab"}
        className="workspace-panel"
      >
        {activeTab
          ? (
            <BoardSessionProvider key={activeTab.id} value={activeTab.session}>
              <BoardView />
            </BoardSessionProvider>
          )
          : <StartScreen />}
      </div>
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
