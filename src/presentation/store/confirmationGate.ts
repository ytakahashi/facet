// A question put to the user. It answers asynchronously because a native
// dialog cannot block the webview, and it resolves false rather than
// rejecting: a dialog that fails to appear has not given permission to discard
// or overwrite anything.
export type Confirm = () => Promise<boolean>;

export interface ConfirmationGate {
  // Resolves false without asking while another question from the same gate
  // is still open, so a second click cannot stack a second dialog.
  ask: (confirm: Confirm) => Promise<boolean>;
}

// The answer arrives after the state the question was about may have moved on
// - a save finished, the viewer switched cards - so a caller re-checks its own
// preconditions once ask() resolves, before acting on a yes.
export function createConfirmationGate(): ConfirmationGate {
  let isAsking = false;
  return {
    ask: async (confirm) => {
      if (isAsking) return false;
      isAsking = true;
      try {
        return await confirm();
      } finally {
        isAsking = false;
      }
    },
  };
}
