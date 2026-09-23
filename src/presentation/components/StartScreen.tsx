import { useNewBoardDialog } from "../context/appContext.ts";
import { DirectoryBrowser } from "./DirectoryBrowser.tsx";
import { RecentBoardList } from "./RecentBoardList.tsx";

export function StartScreen() {
  const openNewBoardDialog = useNewBoardDialog((state) => state.open);

  return (
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
  );
}
