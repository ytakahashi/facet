import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./presentation/App.tsx";
import {
  appDependencies,
  boardSession,
  startApplicationMenu,
  startCardHistoryReset,
} from "./composition/dependencies.ts";
import {
  AppProvider,
  BoardSessionProvider,
} from "./presentation/context/appContext.ts";

startApplicationMenu();
startCardHistoryReset();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider value={appDependencies}>
      <BoardSessionProvider value={boardSession}>
        <App />
      </BoardSessionProvider>
    </AppProvider>
  </StrictMode>,
);
