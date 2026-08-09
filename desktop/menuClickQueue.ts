// Holds menu clicks until the webview comes to collect them.
//
// A menu click is the one thing that starts on the host side, and the only way
// back is a call the view leaves open: `executeJs` is the sole host -> view
// direction Deno Desktop offers, and it evaluates a string, so it carries no
// types and no way to report that the view failed to handle what it was sent.
// The view therefore awaits nextMenuClick() in a loop and this bridges the gap
// between a click and somebody waiting for one, in whichever order they arrive.
//
// One waiter at a time: the view polls from a single loop, and a second
// concurrent next() would replace the first, which would then never resolve.
export interface MenuClickQueue {
  push(id: string): void;
  next(): Promise<string>;
}

export function createMenuClickQueue(): MenuClickQueue {
  const pending: string[] = [];
  let waiter: ((id: string) => void) | null = null;

  return {
    push(id: string): void {
      if (waiter === null) {
        pending.push(id);
        return;
      }
      const resolve = waiter;
      waiter = null;
      resolve(id);
    },

    next(): Promise<string> {
      const queued = pending.shift();
      if (queued !== undefined) {
        return Promise.resolve(queued);
      }
      return new Promise<string>((resolve) => {
        waiter = resolve;
      });
    },
  };
}
