import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./presentation/App.tsx";
import {
  appDependencies,
  startApplicationMenu,
  startCardHistoryReset,
} from "./composition/dependencies.ts";
import { AppProvider } from "./presentation/context/appContext.ts";

startApplicationMenu();
startCardHistoryReset();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider value={appDependencies}>
      <App />
    </AppProvider>
  </StrictMode>,
);
