import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
const submitStart = source.indexOf("async function submitUnlocked(query)");
const confirmStart = source.indexOf("async function confirmPending", submitStart);
assert.ok(submitStart >= 0 && confirmStart > submitStart, "submitUnlocked source block must exist");
const submitSource = source.slice(submitStart, confirmStart);

const pendingBlock = submitSource.indexOf("if (pendingAction)");
const routeCall = submitSource.indexOf("routePendingSubmission({", pendingBlock);
const pendingConversationGate = submitSource.indexOf("resolveConversationIntent(query, current, { pendingAction })", pendingBlock);
assert.ok(pendingBlock >= 0, "the live submission path must contain a pending-action gate");
assert.ok(routeCall > pendingBlock, "the live pending gate must call the pure pending router");
assert.ok(
  pendingConversationGate > routeCall,
  "pending Help/control classification must happen before the broad conversation gate",
);

const directRouteBranch = submitSource.indexOf("PENDING_ROUTE.DETERMINISTIC_CONTROL_OR_HELP", routeCall);
const directDispatch = submitSource.indexOf("maybeHandleDeterministicNlu(query, { pendingAction })", directRouteBranch);
assert.ok(directRouteBranch > routeCall && directDispatch > directRouteBranch, "typed confirm/cancel/Help must enter deterministic dispatch with the pending action");
assert.ok(
  directDispatch < pendingConversationGate,
  "typed pending controls must dispatch before resolveConversationIntent",
);

assert.equal(source.includes("requestInFlightRef"), false, "request lifecycle ownership must not use a shared Boolean ref");
assert.equal(source.includes("isPendingCancellation(query)"), false, "the removed broad pending-cancellation shortcut must not return");
assert.equal(source.includes("isHelpSeekingQuestionText(query)"), false, "the component must use compositional semantics rather than a local Help regex");
assert.ok(source.includes("submissionCoordinatorRef.current"), "the UI must use the owner-ID submission coordinator");

console.log("v7.3.10 live pending-router integration tests passed.");
