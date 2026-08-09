import { assertEquals } from "@std/assert";
import { createMenuClickQueue } from "./menuClickQueue.ts";

Deno.test("hands a waiting caller the click that arrives next", async () => {
  const queue = createMenuClickQueue();

  const click = queue.next();
  queue.push("new-board");

  assertEquals(await click, "new-board");
});

Deno.test("holds a click that arrives with nobody waiting", async () => {
  const queue = createMenuClickQueue();

  // The view is not always inside nextMenuClick(): it is off handling the
  // previous click for as long as opening a board takes. A click landing in
  // that window must not be dropped.
  queue.push("recent:0");

  assertEquals(await queue.next(), "recent:0");
});

Deno.test("hands over held clicks in the order they arrived", async () => {
  const queue = createMenuClickQueue();

  queue.push("recent:0");
  queue.push("recent:1");

  assertEquals(await queue.next(), "recent:0");
  assertEquals(await queue.next(), "recent:1");
});

Deno.test("keeps waiting once a held click has been taken", async () => {
  const queue = createMenuClickQueue();

  queue.push("recent:0");
  assertEquals(await queue.next(), "recent:0");

  const click = queue.next();
  queue.push("new-board");

  assertEquals(await click, "new-board");
});
