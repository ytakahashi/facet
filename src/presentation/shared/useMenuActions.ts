import {
  useClipboard,
  useFinder,
  useShowAlert,
} from "../context/appContext.ts";
import { toUiError } from "../errors/toUiError.ts";

export function useMenuActions() {
  const clipboard = useClipboard();
  const finder = useFinder();
  const showAlert = useShowAlert();

  function run(action: Promise<void>): void {
    void action.catch((error) => showAlert(toUiError(error).message));
  }

  return {
    copyText: (text: string): void => run(clipboard.copyText(text)),
    reveal: (path: string): void => run(finder.reveal(path)),
  };
}
