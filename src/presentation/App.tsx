import { useBoardStore } from "./store/boardStoreContext.ts";
import { BoardDropZone } from "./components/BoardDropZone.tsx";
import { KanbanBoard } from "./components/KanbanBoard.tsx";
import "./App.css";

function App() {
  const status = useBoardStore((state) => state.status);
  const board = useBoardStore((state) => state.board);

  if (status === "loaded" && board) {
    return <KanbanBoard board={board} />;
  }

  return <BoardDropZone />;
}

export default App;
