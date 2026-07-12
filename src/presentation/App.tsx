import { useBoardStore } from "./store/boardStoreContext.ts";
import { DirectoryBrowser } from "./components/DirectoryBrowser.tsx";
import { KanbanBoard } from "./components/KanbanBoard.tsx";
import "./App.css";

function App() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);

  if (status === "loaded" && board) {
    return <KanbanBoard board={board} />;
  }

  return <DirectoryBrowser />;
}

export default App;
