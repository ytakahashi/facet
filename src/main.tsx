import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./presentation/App.tsx";
import { boardStore } from "./presentation/dependencies.ts";
import { BoardStoreProvider } from "./presentation/store/boardStoreContext.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BoardStoreProvider value={boardStore}>
      <App />
    </BoardStoreProvider>
  </StrictMode>,
);
