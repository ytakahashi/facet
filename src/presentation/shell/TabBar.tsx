import { useEffect, useRef } from "react";
import { useWorkspace } from "../context/appContext.ts";
import type { BoardTab } from "../store/workspaceStore.ts";
import { resolveTabShortcut } from "./tabShortcut.ts";

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function BoardTabItem({
  tab,
  selected,
  activate,
  close,
}: {
  tab: BoardTab;
  selected: boolean;
  activate: (id: string) => void;
  close: (id: string) => boolean;
}) {
  const boardName = tab.session.boardStore((state) => state.board?.name);
  const label = boardName ?? basenameOf(tab.path);

  return (
    <div className="tab-bar__item">
      <button
        id={`board-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls="workspace-panel"
        tabIndex={selected ? 0 : -1}
        title={tab.path}
        className="tab-bar__tab"
        onClick={() => activate(tab.id)}
      >
        {label}
      </button>
      <button
        type="button"
        className="tab-bar__close"
        aria-label={`Close ${label}`}
        onClick={() => close(tab.id)}
      >
        ×
      </button>
    </div>
  );
}

export function TabBar() {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabs = useWorkspace((state) => state.tabs);
  const activeTabId = useWorkspace((state) => state.activeTabId);
  const activateTab = useWorkspace((state) => state.activateTab);
  const closeTab = useWorkspace((state) => state.closeTab);
  const showStartScreen = useWorkspace((state) => state.showStartScreen);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const index = resolveTabShortcut(event);
      if (index === undefined) return;
      // Claim recognised keys even when no tab exists or a modal blocks them.
      event.preventDefault();
      // Switching would unmount board-owned dialogs and interrupt their work.
      if (document.querySelector("dialog[open]")) return;
      // Only board tabs are numbered; the trailing Start screen button is not.
      const tab = tabs[index];
      if (!tab || tab.id === activeTabId) return;
      // Focus the persistent tab button synchronously before switching: blur
      // commits inline edits before the old board unmounts. It also keeps
      // keyboard navigation available after the switch.
      tabListRef.current?.querySelector<HTMLButtonElement>(
        `[id="board-tab-${tab.id}"]`,
      )?.focus();
      activateTab(tab.id);
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [tabs, activeTabId, activateTab]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (
      !(event.target instanceof HTMLButtonElement) ||
      event.target.getAttribute("role") !== "tab"
    ) return;
    const tabButtons = Array.from(
      tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ??
        [],
    );
    const index = tabButtons.indexOf(event.target);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabButtons.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabButtons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    tabButtons[nextIndex].focus();
    tabButtons[nextIndex].click();
  }

  return (
    <div
      ref={tabListRef}
      className="tab-bar"
      role="tablist"
      aria-label="Boards"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <BoardTabItem
          key={tab.id}
          tab={tab}
          selected={activeTabId === tab.id}
          activate={activateTab}
          close={closeTab}
        />
      ))}
      <button
        id="start-tab"
        type="button"
        role="tab"
        aria-label="Start screen"
        aria-selected={activeTabId === undefined}
        aria-controls="workspace-panel"
        tabIndex={activeTabId === undefined ? 0 : -1}
        className="tab-bar__start"
        onClick={showStartScreen}
      >
        +
      </button>
    </div>
  );
}
