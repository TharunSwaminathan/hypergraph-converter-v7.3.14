import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const chatSource = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const helpSource = await readFile(new URL("../src/components/DeterministicCommandHelp.jsx", import.meta.url), "utf8");
const helpCss = await readFile(new URL("../src/components/DeterministicCommandHelp.css", import.meta.url), "utf8");

assert.match(chatSource, /function insertCommandExample/, "AgentChatPanel should define insert-only Try command behavior");
assert.match(chatSource, /window\.confirm\(/, "non-empty composer replacement should require confirmation");
assert.match(chatSource, /setInput\(next\)/, "Try command should insert text into the composer");
assert.match(chatSource, /getElementById\(\"hypergraph-agent-composer\"\)/, "Try command should focus the composer by ID");
assert.doesNotMatch(chatSource, /insertCommandExample[\s\S]{0,800}handleSend\(/, "Try command must not submit automatically");
assert.doesNotMatch(chatSource, /insertCommandExample[\s\S]{0,800}dispatchCompiledAction\(/, "Try command must not route or mutate graph state");

assert.match(helpSource, /<span>Search commands<\/span>/, "Help search needs a visible accessible label");
assert.match(helpSource, /<details/i, "Help cards should use details/summary semantics");
assert.match(helpSource, /<summary/i, "Help cards should use keyboard-friendly summaries");
assert.match(helpSource, /aria-live=\"polite\"/, "Copy feedback should use aria-live");
assert.match(helpSource, />Try this command</, "Try button needs a visible name");
assert.match(helpSource, />Copy</, "Copy button needs a visible name");
assert.match(helpSource, /onTryExample\?\.\(example\.text\)/, "Try button should insert the selected example only");
assert.match(helpSource, /badgeText\(entry\)/, "badges should be rendered from text labels, not color-only meaning");
assert.match(helpSource, /<b key=\{badge\}>\{badge\}<\/b>/, "visible badge text should be rendered");
assert.match(helpCss, /overflow-x:\s*hidden/, "Help panel should avoid horizontal overflow");
assert.match(helpCss, /position:\s*sticky/, "filter controls should remain usable while scrolling");

console.log("deterministic help Try-command/accessibility tests passed.");
