import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const graphGrammar = await readFile("src/agent/deterministicNlu/domains/graphMutationGrammar.js", "utf8");
const mappingAdapter = await readFile("src/agent/deterministicDatasetMappingPatch.js", "utf8");
const customParserConversation = await readFile("src/agent/customParserConversation.js", "utf8");
const dashboardGrammar = await readFile("src/agent/deterministicNlu/domains/dashboardActionGrammar.js", "utf8");
const chatPanel = await readFile("src/components/AgentChatPanel.jsx", "utf8");
const app = await readFile("src/App.jsx", "utf8");

assert.match(graphGrammar, /GraphMutationPlan/);
assert.match(graphGrammar, /createMutationPlan/);
assert.doesNotMatch(graphGrammar, /return\s+{[\s\S]{0,120}text:\s*raw[\s\S]{0,80}}\s*;/, "graph grammar must not only route raw text");

assert.match(mappingAdapter, /compileDatasetMappingGrammar/);
assert.doesNotMatch(mappingAdapter, /parseRoleInstructions|parseTimeInstruction|parseJoinPairs|sentenceChunks|roleFromPhrase/);

assert.match(customParserConversation, /ensureDatasetMappingSpecV2/);
assert.doesNotMatch(customParserConversation, /structuredClone\(mappingSpec\)|spec\.files\[[^\]]+\]\s*=/, "compatibility adapter must not directly mutate mappings");

assert.match(dashboardGrammar, /canonicalIntent/);
assert.doesNotMatch(dashboardGrammar, /delegateToExistingControlPlanner:\s*true/);

assert.match(chatPanel, /agentActions\.compileDeterministicTurn/);
assert.match(chatPanel, /dispatchCompiledAction/);
assert.match(chatPanel, /precompiledPlan/);
assert.match(chatPanel, /precompiledDraft/);
assert.match(app, /compileGraphMutationGrammar/);
assert.match(app, /compileDeterministicAction/);
assert.match(app, /precompiledDraftUsed:\s*true/);
assert.doesNotMatch(app, /interpretGraphMutationRequest\(rawQuery/);

console.log("deterministic NLU authoritative routing source guards passed.");
