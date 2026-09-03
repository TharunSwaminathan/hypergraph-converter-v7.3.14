import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(pkg.name, "hypergraph-converter-studio");
assert.equal(pkg.version, "7.3.14");

const panel = readFileSync(new URL("../src/components/AgentChatPanel.jsx", import.meta.url), "utf8");
assert.match(panel, /precompiledPlan:\s*options\.precompiledPlan/);
assert.match(panel, /precompiledCompilation:\s*options\.precompiledCompilation/);
assert.match(panel, /semanticConfidence:\s*options\.semanticConfidence/);
assert.match(panel, /contextBinding:\s*options\.contextBinding/);
assert.match(panel, /deterministicFirst:\s*options\.deterministicFirst === true/);
assert.match(panel, /recordCompletedDeterministicTrace\(dispatch\.runtimeTrace\)/);

const compiler = readFileSync(new URL("../src/agent/deterministicNlu/compileDeterministicAction.js", import.meta.url), "utf8");
assert.match(compiler, /classifySpeechAct/);
assert.match(compiler, /classifyCompiledSideEffect/);
assert.match(compiler, /speechActIsReadOnly/);
assert.match(compiler, /typedKind:\s*"GroundedQuestion"/);

console.log("v7.3.5 regression tests passed.");
