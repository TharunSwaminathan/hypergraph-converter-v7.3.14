import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/DeterministicCommandHelp.jsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");

assert.match(source, /#help\//, "Help component should support entry deep links");
assert.ok(source.includes("help\\/category\\/"), "Help component should support category deep links");
assert.match(source, /hashchange/, "Help component should listen for hash changes");
assert.match(source, /getCatalogEntry/, "Help component should resolve related command IDs through catalog entries");
assert.match(source, /Copy link/, "Help cards should provide copyable deep links");
assert.match(source, /return `command-\$\{String\(entryId\)/, "Help cards should expose stable command-* anchors");
assert.match(source, /aria-current/, "Deep-linked entries should mark the active card accessibly");
assert.match(panelSource, /window\.location\.hash\.startsWith\("#help"\)/, "Agent panel should open Help when a help hash is requested");

console.log("deterministic help deep-link tests passed.");
