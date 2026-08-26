import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/components/AgentChatPanel.jsx", "utf8");
assert.match(
  source,
  /plan\.kind === "configure_local_model"[\s\S]+stateMutationCommitted:\s*Boolean\(result\.changedState\)/,
  "configure_local_model must report mutation committed only when settings actually changed",
);
assert.doesNotMatch(
  source,
  /plan\.kind === "configure_local_model"[\s\S]{0,500}stateMutationCommitted:\s*Boolean\(result\.ok\)/,
  "configure_local_model must not treat successful no-op settings updates as mutations",
);

console.log("v7.3.13 local model settings trace test passed.");
