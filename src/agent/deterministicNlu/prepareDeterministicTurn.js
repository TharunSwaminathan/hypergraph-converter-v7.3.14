import { analyzeDeterministicNlu } from "./deterministicNlu.js";
import { compileDeterministicAction } from "./compileDeterministicAction.js";
import { createRuntimeTrace, snapshotRuntimeTrace } from "./runtimeInstrumentation.js";

export function prepareDeterministicTurn({
  query,
  analysisContext = {},
  compileContext = {},
  contextBinding = null,
  analyze = analyzeDeterministicNlu,
  compile = compileDeterministicAction,
  requestId = null,
} = {}) {
  const trace = createRuntimeTrace(requestId ? { requestId } : {});
  const nlu = analyze(query, analysisContext);
  trace.analysisCount += 1;

  const compilation = compile(nlu, compileContext);
  trace.compilationCount += 1;
  trace.authoritativeCompiler = compilation?.diagnostics?.authoritativeCompiler ?? "unknown";
  trace.typedKind = compilation?.typedKind ?? null;
  trace.speechAct = compilation?.speechAct ?? nlu?.speechAct ?? "unknown";
  trace.sideEffectClass = compilation?.sideEffectClass ?? "read_only";
  trace.dispatchAuthorized = compilation?.dispatchAuthorized !== false;
  trace.dispatchBlockReason = compilation?.dispatchBlockReason ?? null;
  trace.blockedSideEffect = compilation?.diagnostics?.blockedSideEffect ?? null;
  trace.semanticConfidence = compilation?.semanticConfidence ?? compilation?.diagnostics?.semanticConfidence ?? null;

  return {
    ok: true,
    handled: Boolean(compilation?.handled),
    nlu,
    compilation,
    contextBinding,
    runtimeTrace: snapshotRuntimeTrace(trace, { status: "prepared" }),
  };
}
