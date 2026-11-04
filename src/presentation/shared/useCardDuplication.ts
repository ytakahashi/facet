import type { Card } from "../../domain/card.ts";
import { useBoardSession, useShowAlert } from "../context/appContext.ts";
import { toUiError } from "../errors/toUiError.ts";
import { canDuplicateCard } from "../store/boardStore.ts";
import { isCardSaving } from "../store/markdownViewerStore.ts";

export function useCardDuplication() {
  const { boardStore, markdownViewer } = useBoardSession();
  const showAlert = useShowAlert();
  return {
    // Native menus need a snapshot when opened, not a render subscription.
    canDuplicateCard: (card: Card) =>
      canDuplicateCard(
        card,
        isCardSaving(markdownViewer.getState(), card.path),
      ),
    duplicateCard: (path: string): void => {
      void boardStore
        .getState()
        .duplicateCard(path)
        .catch((error) => showAlert(toUiError(error).message));
    },
  };
}
