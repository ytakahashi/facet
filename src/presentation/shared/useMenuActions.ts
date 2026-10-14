import {
  useClipboard,
  useFinder,
  useShowAlert,
} from "../context/appContext.ts";
import { createMenuActions } from "./menuActions.ts";

export function useMenuActions() {
  const clipboard = useClipboard();
  const finder = useFinder();
  const showAlert = useShowAlert();

  return createMenuActions({ clipboard, finder, showAlert });
}
