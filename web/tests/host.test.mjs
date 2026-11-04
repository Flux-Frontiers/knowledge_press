import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// A page with no app around it: a window, no webkit. The store needs localStorage.
globalThis.window = { localStorage: { getItem: () => null, setItem: () => {} } };
const hostModule = () => require(`${process.env.FOREST_TEST_BUILD}/host.js`);
const deepLink = () => require(`${process.env.FOREST_TEST_BUILD}/deepLink.js`);

/** Stand in for the app's `forest` message handler, recording what is posted. */
function withHandler(fn) {
  const posted = [];
  window.webkit = { messageHandlers: { forest: { postMessage: (body) => posted.push(body) } } };
  try { fn(posted); } finally { delete window.webkit; }
  return posted;
}

test("without a host the forest is on its own: not available, and post does nothing", () => {
  const { host } = hostModule();
  assert.equal(host.available, false);
  assert.doesNotThrow(() => host.post({ kind: "ready" }));
  // No window at all (a worker, a test): still nothing, still no throw.
  const saved = globalThis.window;
  delete globalThis.window;
  try {
    assert.equal(host.available, false);
    assert.doesNotThrow(() => host.post({ kind: "tree", slug: "hamlet" }));
  } finally { globalThis.window = saved; }
});

test("a host's message handler receives what the forest posts", () => {
  const { host } = hostModule();
  const posted = withHandler(() => {
    assert.equal(host.available, true);
    host.post({ kind: "ask", slug: "hamlet" });
  });
  assert.deepEqual(posted, [{ kind: "ask", slug: "hamlet" }]);
  assert.equal(host.available, false);
});

test("a handler that throws does not take the forest down", () => {
  const { host } = hostModule();
  window.webkit = { messageHandlers: { forest: { postMessage: () => { throw new Error("gone"); } } } };
  try { assert.doesNotThrow(() => host.post({ kind: "ready" })); } finally { delete window.webkit; }
});

test("on receives a command dispatched through window.__forestHost", () => {
  const { host } = hostModule();
  const heard = [];
  const off = host.on((c) => heard.push(c));
  window.__forestHost.dispatch('{"kind":"goto","slug":"hamlet"}');
  window.__forestHost.dispatch({ kind: "home" });
  off();
  window.__forestHost.dispatch({ kind: "home" });
  assert.deepEqual(heard, [{ kind: "goto", slug: "hamlet" }, { kind: "home" }]);
});

test("malformed commands are dropped, not thrown", () => {
  const { host, dispatch, parseCommand } = hostModule();
  const heard = [];
  const off = host.on((c) => heard.push(c));
  for (const bad of ["not json", "null", '{"kind":"goto"}', '{"kind":"goto","slug":""}', '{"kind":"explode"}', 7, null]) {
    assert.doesNotThrow(() => dispatch(bad));
  }
  off();
  assert.deepEqual(heard, []);
  assert.deepEqual(parseCommand('{"kind":"goto","slug":"hamlet","extra":1}'), { kind: "goto", slug: "hamlet" });
});

test("the store tells the host when a card comes up and when a book is pressed", () => {
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  const posted = withHandler(() => {
    st().pinTree("hamlet");
    st().pinTree("hamlet"); // already up: no second event
    st().collect("hamlet", "Hamlet");
    st().collect("hamlet", "Hamlet"); // already in the press
    st().pinTree(null);
    st().setNearby("macbeth", 3, 0); // the cart slows beside a tree
  });
  assert.deepEqual(posted, [
    { kind: "tree", slug: "hamlet" },
    { kind: "pressed", slug: "hamlet" },
    { kind: "tree", slug: "macbeth" },
  ]);
  // On the web the same moves post nothing and break nothing.
  assert.doesNotThrow(() => { st().pinTree("lear"); st().collect("lear", "King Lear"); });
});

test("goto finds its tree the way ?tree= does", () => {
  const { treeBySlug, treeFromSearch } = deepLink();
  const trees = [{ book: { slug: "hamlet" } }, { book: { slug: "macbeth" } }];
  assert.equal(treeBySlug("macbeth", trees), trees[1]);
  assert.equal(treeBySlug(" Hamlet ", trees), trees[0]);
  assert.equal(treeBySlug("lear", trees), undefined);
  assert.equal(treeFromSearch("?tree=hamlet", trees), trees[0]);
  assert.equal(treeFromSearch("?other=1", trees), undefined);
});

test("the address follows the host's last goto, other parameters kept", () => {
  const { searchWithTree } = deepLink();
  assert.equal(searchWithTree("", "hamlet"), "?tree=hamlet");
  assert.equal(searchWithTree("?tree=hamlet&qa=1", "macbeth"), "?tree=macbeth&qa=1");
  assert.equal(searchWithTree("?tree=hamlet&qa=1", null), "?qa=1");
  assert.equal(searchWithTree("?tree=hamlet", null), "");
});
