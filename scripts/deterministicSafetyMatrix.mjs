import { allCatalogExamples } from "../src/agent/deterministicNlu/commandCatalog.js";
import { analyzeDeterministicNlu } from "../src/agent/deterministicNlu/deterministicNlu.js";
import { compileDeterministicAction } from "../src/agent/deterministicNlu/compileDeterministicAction.js";
import { sideEffectIsStateChanging } from "../src/agent/deterministicNlu/sideEffectPolicy.js";
import { buildCompilerContexts } from "../tests/helpers/evaluateDeterministicNluCorpus.mjs";
import { fixtureNameForExample } from "../tests/helpers/deterministicCommandCatalogTestHelpers.mjs";

export function stateChangingCatalogExamples() {
  return allCatalogExamples({ includePanelOnly: false })
    .filter(({ example }) => sideEffectIsStateChanging(example.expectedSideEffect) && !example.expectsClarification);
}

export function normalizeEmbeddedCommand(text) {
  return String(text ?? "").replace(/[.!?]+$/, "").replace(/^./, char => char.toLowerCase());
}

function countBy(records, key) {
  return Object.fromEntries(
    [...records.reduce((map, item) => map.set(item[key], (map.get(item[key]) ?? 0) + 1), new Map())]
      .sort((a, b) => b[1] - a[1]),
  );
}

export async function runReadOnlySafetyMatrix(frames) {
  const bases = stateChangingCatalogExamples();
  const failures = [];
  for (const { entry, example } of bases) {
    const contexts = await buildCompilerContexts(fixtureNameForExample(example));
    for (const [frameName, wrap] of Object.entries(frames)) {
      const query = wrap(example.text);
      const nlu = analyzeDeterministicNlu(query, contexts.analysisContext);
      const compilation = compileDeterministicAction(nlu, contexts.compileContext);
      if (!sideEffectIsStateChanging(compilation.sideEffectClass)) continue;
      failures.push({
        frameName,
        entryId: entry.id,
        base: example.text,
        query,
        domain: compilation.domain,
        intent: compilation.intent,
        speechAct: compilation.speechAct,
        sideEffect: compilation.sideEffectClass,
        typedKind: compilation.typedKind,
        dispatchAuthorized: compilation.dispatchAuthorized,
        operationTypes: compilation.diagnostics?.operationTypes
          ?? compilation.compiled?.diagnostics?.operationTypes
          ?? [],
      });
    }
  }
  return {
    baseCount: bases.length,
    frameCount: Object.keys(frames).length,
    total: bases.length * Object.keys(frames).length,
    failures: failures.length,
    byFrame: countBy(failures, "frameName"),
    byDomain: countBy(failures, "domain"),
    bySpeechAct: countBy(failures, "speechAct"),
    bySideEffect: countBy(failures, "sideEffect"),
    allFailures: failures,
  };
}
