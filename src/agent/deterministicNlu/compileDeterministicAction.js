import { compileDatasetMappingGrammar } from "./domains/datasetMappingGrammar.js";
import { compileDatasetGroupingGrammar } from "./domains/datasetGroupingGrammar.js";
import { compileParserWorkflowGrammar } from "./domains/parserWorkflowGrammar.js";
import { compileGraphMutationGrammar } from "./domains/graphMutationGrammar.js";
import { compileDashboardActionGrammar } from "./domains/dashboardActionGrammar.js";
import { compileGroundedQuestionGrammar } from "./domains/groundedQuestionGrammar.js";
import { compileHelpGrammar } from "./domains/helpGrammar.js";
import { compileLegacyActionGrammar } from "./domains/legacyActionGrammar.js";
import { semanticConfidenceFromCompilation } from "./semanticConfidence.js";
import { classifySpeechAct, speechActIsReadOnly } from "./speechActClassifier.js";
import { analyzeRequestSemantics } from "./requestSemantics.js";
import { analyzeDeterministicNlu } from "./deterministicNlu.js";
import { authorizeCompiledSideEffect, authorizeSpeechActSideEffect, classifyCompiledSideEffect } from "./sideEffectPolicy.js";

const COMPILER_BY_DOMAIN = Object.freeze({
  dataset_mapping: "dataset_mapping_v1",
  dataset_grouping: "dataset_grouping_v1",
  parser_workflow: "parser_workflow_v1",
  graph_mutation: "graph_mutation_v1",
  dashboard_control: "dashboard_control_v1",
  grounded_question: "grounded_question_v1",
  help_query: "help_query_v1",
  legacy_action: "legacy_action_registry_v1",
});

export function compileDeterministicAction(nlu, context = {}) {
  const requestSemantics = analyzeRequestSemantics(nlu?.rawText ?? "");
  const previewOnlyAuthorized = requestSemantics.authorization?.authorizedClauses?.some(clause => clause.scopes?.previewWithoutApply) === true;
  const preserveParserStatusContext = nlu?.primaryDomain === "parser_workflow"
    && /\b(?:status|workflow|progress|phase)\b/i.test(requestSemantics.authorizedActionText ?? "");
  const authorizedActionText = requestSemantics.executionAuthorized && requestSemantics.authorizedActionText
    && !preserveParserStatusContext
    && (previewOnlyAuthorized || !equivalentActionText(requestSemantics.authorizedActionText, nlu?.rawText))
    ? normalizeAuthorizedActionText(requestSemantics.authorizedActionText)
    : null;
  const compilationNlu = authorizedActionText
    ? analyzeDeterministicNlu(authorizedActionText, analysisContextFromCompileContext(context))
    : nlu;
  const lexicalDomain = compilationNlu?.primaryDomain ?? nlu?.primaryDomain ?? "unknown";
  const speech = nlu?.speechAct
    ? (authorizedActionText
        ? {
            speechAct: compilationNlu?.speechAct
              ?? classifySpeechAct(authorizedActionText, { domain: lexicalDomain, mode: "action" }).speechAct,
            reasons: compilationNlu?.speechActReasons ?? [],
          }
        : { speechAct: nlu.speechAct, reasons: nlu.speechActReasons ?? [] })
    : classifySpeechAct(authorizedActionText ?? nlu?.rawText ?? "", { domain: lexicalDomain, mode: authorizedActionText ? "action" : nlu?.mode });
  const compiled = compileForDomain(lexicalDomain, compilationNlu, context);
  if (!compiled || compiled.noMatch) {
    if (authorizedActionText && requestSemantics.executionAuthorized) {
      const intent = `clarify_${lexicalDomain}_action`;
      const clarificationQuestion = "I found an authorized action clause, but could not resolve it into one unambiguous operation. Please restate that action with its exact target.";
      return {
        ok: true,
        handled: true,
        domain: "grounded_question",
        intent,
        mode: "clarification",
        speechAct: speech.speechAct,
        sideEffectClass: "read_only",
        dispatchAuthorized: true,
        dispatchBlockReason: "authorized_clause_requires_clarification",
        typedKind: "GroundedQuestion",
        typedValue: { intent, topicDomain: lexicalDomain, needsResolution: true, clarificationQuestion },
        semanticConfidence: semanticConfidenceFromCompilation(compilationNlu, { validatorStatus: "clarification_required" }),
        ambiguities: compilationNlu?.ambiguities ?? [],
        unresolvedReferences: compilationNlu?.unresolvedReferences ?? [],
        compiled: {
          ok: true,
          domain: "grounded_question",
          intent,
          needsClarification: true,
          clarificationQuestion,
          diagnostics: {
            plannerPath: "deterministic_nlu_authorized_clause_clarification",
            sourceDomain: lexicalDomain,
            speechAct: speech.speechAct,
          },
        },
        requestSemantics,
        diagnostics: {
          ...baseDiagnostics(nlu, lexicalDomain, {
            validatorStatus: "clarification_required",
            speechAct: speech.speechAct,
            sideEffectClass: "read_only",
          }),
          authorizedActionText,
          requestSemantics,
        },
      };
    }
    if (speech.speechAct === "cancellation") {
      const intent = "cancel_without_pending_action";
      return {
        ok: true,
        handled: true,
        domain: "grounded_question",
        intent,
        mode: "cancellation",
        speechAct: speech.speechAct,
        sideEffectClass: "read_only",
        dispatchAuthorized: true,
        dispatchBlockReason: null,
        typedKind: "GroundedQuestion",
        typedValue: { intent, topicDomain: lexicalDomain },
        semanticConfidence: semanticConfidenceFromCompilation(nlu, { validatorStatus: "cancellation_noop" }),
        ambiguities: nlu?.ambiguities ?? [],
        unresolvedReferences: nlu?.unresolvedReferences ?? [],
        compiled: { ok: true, domain: "grounded_question", intent, diagnostics: { plannerPath: "deterministic_nlu_cancellation_noop", speechAct: speech.speechAct } },
        requestSemantics,
        diagnostics: { ...baseDiagnostics(nlu, lexicalDomain, { validatorStatus: "cancellation_noop", speechAct: speech.speechAct, sideEffectClass: "read_only" }), requestSemantics },
      };
    }
    const readOnlyQuestion = (requestSemantics.readOnlyScope
      || ["informational_question", "help_seeking_question", "hypothetical_question", "status_question", "explanation_question", "reported_command", "quoted_command"].includes(speech.speechAct))
      && lexicalDomain !== "unknown";
    if (readOnlyQuestion) {
      const intent = questionIntentFor(lexicalDomain, speech.speechAct);
      return {
        ok: true,
        handled: true,
        domain: "grounded_question",
        intent,
        mode: "question",
        speechAct: speech.speechAct,
        sideEffectClass: "read_only",
        dispatchAuthorized: true,
        dispatchBlockReason: null,
        typedKind: "GroundedQuestion",
        typedValue: { intent, topicDomain: lexicalDomain },
        semanticConfidence: semanticConfidenceFromCompilation(nlu, { validatorStatus: "question_fallback" }),
        ambiguities: nlu?.ambiguities ?? [],
        unresolvedReferences: nlu?.unresolvedReferences ?? [],
        compiled: {
          ok: true,
          domain: "grounded_question",
          intent,
          diagnostics: {
            plannerPath: "deterministic_nlu_question_fallback",
            sourceDomain: lexicalDomain,
            speechAct: speech.speechAct,
          },
        },
        requestSemantics,
        diagnostics: {
          ...baseDiagnostics(nlu, lexicalDomain, {
          validatorStatus: "question_fallback",
          speechAct: speech.speechAct,
          sideEffectClass: "read_only",
        }),
          requestSemantics,
        },
      };
    }
    return {
      ok: false,
      handled: false,
      domain: lexicalDomain,
      intent: nlu?.primaryIntent ?? "unknown",
      mode: nlu?.mode ?? "unknown",
      speechAct: speech.speechAct,
      sideEffectClass: "read_only",
      dispatchAuthorized: true,
      dispatchBlockReason: null,
      typedKind: null,
      typedValue: null,
      semanticConfidence: semanticConfidenceFromCompilation(nlu),
      ambiguities: nlu?.ambiguities ?? [],
      unresolvedReferences: nlu?.unresolvedReferences ?? [],
      requestSemantics,
      diagnostics: {
        ...baseDiagnostics(nlu, lexicalDomain, {
        validatorStatus: "not_run",
        speechAct: speech.speechAct,
        sideEffectClass: "read_only",
      }),
        requestSemantics,
      },
    };
  }

  const operations = compiled.draft?.operations ?? compiled.operations ?? compiled.plan?.operations ?? [];
  const operationTypes = operations.map(operation => operation?.type).filter(Boolean);
  const resolvedEntities = compiled.diagnostics?.resolvedEntities
    ?? compiled.diagnostics?.resolvedEntityIds
    ?? compiled.diagnostics?.filesResolved
    ?? [];
  const preserveBlockedAuditDetails = speech.speechAct === "cancellation" && lexicalDomain === "graph_mutation";
  const blockedAuditOperationTypes = preserveBlockedAuditDetails ? operationTypes : [];
  const blockedAuditResolvedEntities = preserveBlockedAuditDetails ? resolvedEntities : [];
  const validatorStatus = compiled.diagnostics?.validatorStatus ?? (compiled.ok ? "compiled" : "not_run");
  const semanticConfidence = compiled.diagnostics?.semanticConfidence ?? semanticConfidenceFromCompilation(nlu, {
    operationCount: operations.length,
    resolvedEntityCount: resolvedEntities.length,
    ambiguityCount: compiled.ambiguities?.length ?? 0,
    validatorStatus,
  });

  const initial = {
    ok: Boolean(compiled.ok),
    handled: true,
    domain: lexicalDomain,
    intent: compiled.authoritativeIntent ?? compiled.intent ?? nlu?.primaryIntent ?? lexicalDomain,
    mode: nlu?.mode ?? "action",
    speechAct: speech.speechAct,
    typedKind: compiled.typedKind ?? typedKindForDomain(lexicalDomain),
    typedValue: typedValueForDomain(lexicalDomain, compiled),
    semanticConfidence,
    ambiguities: compiled.ambiguities ?? nlu?.ambiguities ?? [],
    unresolvedReferences: compiled.unresolvedReferences ?? nlu?.unresolvedReferences ?? [],
    compiled,
    requestSemantics,
  };
  if (compiled.needsClarification && lexicalDomain === "legacy_action") {
    const clarificationIntent = initial.intent;
    const missingArguments = compiled.action?.missingArguments ?? [];
    return {
      ...initial,
      domain: "grounded_question",
      intent: clarificationIntent,
      mode: "clarification",
      typedKind: "GroundedQuestion",
      typedValue: {
        intent: clarificationIntent,
        topicDomain: lexicalDomain,
        needsResolution: true,
        clarificationQuestion: compiled.clarificationQuestion ?? null,
        missingArguments,
        sideEffect: "read_only",
      },
      sideEffectClass: "read_only",
      dispatchAuthorized: true,
      dispatchBlockReason: "clarification_required",
      compiled: {
        ...compiled,
        domain: "grounded_question",
        blockedCompilation: compiled,
      },
      diagnostics: {
        ...baseDiagnostics(nlu, lexicalDomain, {
          validatorStatus: "clarification_required",
          speechAct: speech.speechAct,
          sideEffectClass: "read_only",
        }),
        ...(compiled.diagnostics ?? {}),
        sourceDomain: lexicalDomain,
        missingArguments,
        requestSemantics,
      },
    };
  }
  const sideEffectClass = classifyCompiledSideEffect(initial);
  const authorization = authorizeSpeechActSideEffect({ speechAct: speech.speechAct, sideEffectClass });
  const semanticAuthorization = authorizeCompiledSideEffect({
    semantics: requestSemantics,
    sideEffectClass,
    plan: initial.typedValue,
    context: {
      domain: lexicalDomain,
      speechAct: speech.speechAct,
      typedKind: initial.typedKind,
      intent: initial.intent,
      pendingOperations: context.pendingAction?.plan?.operations ?? [],
      selectedEntity: context.selectedEntity ?? null,
    },
  });

  const preserveReadOnlyTypedKind = initial.typedKind === "DeterministicHelpQuery"
    || (initial.typedKind === "ParserWorkflowOperation" && sideEffectClass === "read_only");
  const requestReadOnlyGate = requestSemantics.readOnlyScope && requestSemantics.executionAuthorized !== true;
  if ((speechActIsReadOnly(speech.speechAct) || !semanticAuthorization.allowed || requestReadOnlyGate) && initial.typedKind !== "GroundedQuestion" && !preserveReadOnlyTypedKind) {
    const blockedCompilation = compiled;
    const questionIntent = questionIntentFor(lexicalDomain, speech.speechAct);
    const blockReason = !semanticAuthorization.allowed ? semanticAuthorization.reason : authorization.reason;
    return {
      ...initial,
      ok: true,
      handled: true,
      domain: "grounded_question",
      mode: speech.speechAct === "status_question" ? "status_request" : "question",
      typedKind: "GroundedQuestion",
      typedValue: {
        intent: questionIntent,
        topicDomain: lexicalDomain,
        blockedSideEffect: sideEffectClass === "read_only" ? null : sideEffectClass,
        originalIntent: initial.intent,
      },
      sideEffectClass: "read_only",
      dispatchAuthorized: true,
      dispatchBlockReason: sideEffectClass === "read_only" ? "read_only_speech_act" : blockReason,
      compiled: {
        ok: true,
        domain: "grounded_question",
        intent: questionIntent,
        blockedCompilation,
        blockedSideEffect: sideEffectClass === "read_only" ? null : sideEffectClass,
        speechAct: speech.speechAct,
        diagnostics: {
          plannerPath: "deterministic_nlu_speech_act_gate",
          authoritativeCompiler: COMPILER_BY_DOMAIN[lexicalDomain] ?? "unknown",
          blockedSideEffect: sideEffectClass === "read_only" ? null : sideEffectClass,
          blockReason: sideEffectClass === "read_only" ? "read_only_speech_act" : blockReason,
          speechAct: speech.speechAct,
          sourceDomain: lexicalDomain,
          operationTypes: blockedAuditOperationTypes,
          resolvedEntities: blockedAuditResolvedEntities,
          requestSemantics,
        },
      },
      requestSemantics,
      diagnostics: {
        ...baseDiagnostics(nlu, lexicalDomain, {
          validatorStatus,
          speechAct: speech.speechAct,
          sideEffectClass: "read_only",
        }),
        semanticConfidence,
        blockedSideEffect: sideEffectClass === "read_only" ? null : sideEffectClass,
        dispatchBlockReason: sideEffectClass === "read_only" ? "read_only_speech_act" : blockReason,
        operationTypes: blockedAuditOperationTypes,
        resolvedEntities: blockedAuditResolvedEntities,
        safetyConvertedToQuestion: true,
        requestSemantics,
      },
    };
  }

  if (!authorization.allowed && sideEffectClass !== "read_only") {
    const blockedCompilation = compiled;
    const questionIntent = questionIntentFor(lexicalDomain, speech.speechAct);
    return {
      ...initial,
      ok: true,
      handled: true,
      domain: "grounded_question",
      mode: "question",
      typedKind: "GroundedQuestion",
      typedValue: {
        intent: questionIntent,
        topicDomain: lexicalDomain,
        blockedSideEffect: sideEffectClass,
        originalIntent: initial.intent,
      },
      sideEffectClass: "read_only",
      dispatchAuthorized: true,
      dispatchBlockReason: authorization.reason,
      compiled: {
        ok: true,
        domain: "grounded_question",
        intent: questionIntent,
        blockedCompilation,
        blockedSideEffect: sideEffectClass,
        speechAct: speech.speechAct,
        diagnostics: {
          plannerPath: "deterministic_nlu_safety_gate",
          authoritativeCompiler: COMPILER_BY_DOMAIN[lexicalDomain] ?? "unknown",
          blockedSideEffect: sideEffectClass,
          blockReason: authorization.reason,
          speechAct: speech.speechAct,
          sourceDomain: lexicalDomain,
          operationTypes: blockedAuditOperationTypes,
          resolvedEntities: blockedAuditResolvedEntities,
        },
      },
      requestSemantics,
      diagnostics: {
        ...baseDiagnostics(nlu, lexicalDomain, {
          validatorStatus,
          speechAct: speech.speechAct,
          sideEffectClass: "read_only",
        }),
        ...(compiled.diagnostics ?? {}),
        semanticConfidence,
        blockedSideEffect: sideEffectClass,
        dispatchBlockReason: authorization.reason,
        operationTypes: blockedAuditOperationTypes,
        resolvedEntities: blockedAuditResolvedEntities,
        safetyConvertedToQuestion: true,
        requestSemantics,
      },
    };
  }

  const finalDispatchAuthorization = authorization.allowed && semanticAuthorization.allowed;
  return {
    ...initial,
    sideEffectClass,
    dispatchAuthorized: finalDispatchAuthorization,
    dispatchBlockReason: finalDispatchAuthorization ? null : (authorization.allowed ? semanticAuthorization.reason : authorization.reason),
    diagnostics: {
      ...baseDiagnostics(nlu, lexicalDomain, {
        validatorStatus,
        speechAct: speech.speechAct,
        sideEffectClass,
      }),
      ...(compiled.diagnostics ?? {}),
      semanticConfidence,
      speechAct: speech.speechAct,
      sideEffectClass,
      dispatchAuthorized: finalDispatchAuthorization,
      dispatchBlockReason: finalDispatchAuthorization ? null : (authorization.allowed ? semanticAuthorization.reason : authorization.reason),
      requestSemantics,
    },
  };
}

function equivalentActionText(left = "", right = "") {
  const normalize = value => String(value ?? "").trim().replace(/[.!?]+$/g, "").trim();
  return normalize(left) === normalize(right);
}

function normalizeAuthorizedActionText(text = "") {
  return String(text ?? "")
    .replace(/^\s*(?:please\s+)?create\s+(?:a\s+)?preview\s+(?:to|for)\s+/i, "")
    .replace(/\s*,?\s*(?:but\s+)?(?:do\s+not|don['’]?t)\s+apply\s+(?:it|this|that|the\s+(?:change|preview|edit))\s*[.!?]?\s*$/i, "")
    .trim();
}

function analysisContextFromCompileContext(context = {}) {
  const hyperedges = Array.isArray(context.hyperedges) ? context.hyperedges : [];
  const files = context.datasetProfile?.files ?? context.batch?.datasetProfile?.files ?? [];
  return {
    ...(hyperedges.length ? {
      graph: {
        hyperedges: hyperedges.map(edge => String(edge.id)),
        vertices: [...new Set(hyperedges.flatMap(edge => (edge.vertices ?? []).map(String)))],
      },
    } : {}),
    ...(files.length ? {
      datasetMapping: {
        fileNames: files.map(file => file.fileName ?? file.name).filter(Boolean),
        headersByFile: Object.fromEntries(files.map(file => [
          file.fileName ?? file.name,
          (file.columns ?? []).map(column => column.name ?? column).filter(Boolean),
        ]).filter(([fileName]) => Boolean(fileName))),
      },
    } : {}),
    ...(context.state?.activeBatch ? {
      parserWorkflow: {
        mappingStatus: context.state.activeBatch.mappingSpecStatus ?? "unknown",
        planStatus: context.state.activeBatch.transformationPlan ? "generated" : "none",
        parserStatus: context.state.activeBatch.generatedParserFromMapping ? "generated" : "none",
        resultStatus: context.state.customResultId ? "generated" : "none",
      },
    } : {}),
    ...(context.state ? { dashboard: context.state } : {}),
  };
}

function compileForDomain(domain, nlu, context) {
  if (domain === "dataset_grouping") {
    return compileDatasetGroupingGrammar(nlu.rawText, {
      nlu,
      batch: context.batch,
      mappingSpec: context.mappingSpec,
      datasetProfile: context.datasetProfile,
    });
  }
  if (domain === "dataset_mapping") {
    return compileDatasetMappingGrammar(nlu.rawText, {
      nlu,
      batch: context.batch,
      mappingSpec: context.mappingSpec,
      datasetProfile: context.datasetProfile,
    });
  }
  if (domain === "parser_workflow") return compileParserWorkflowGrammar(nlu.rawText, { nlu, state: context.state });
  if (domain === "graph_mutation") {
    return compileGraphMutationGrammar(nlu.rawText, {
      nlu,
      hyperedges: context.hyperedges,
      graphIdentity: context.graphIdentity,
      graphHistory: context.graphHistory,
      selectedEntity: context.selectedEntity,
      recentReferences: context.recentReferences,
      pendingAction: context.pendingAction,
    });
  }
  if (domain === "dashboard_control") return compileDashboardActionGrammar(nlu.rawText, { nlu, state: context.state });
  if (domain === "grounded_question") return compileGroundedQuestionGrammar(nlu.rawText, { nlu, state: context.state });
  if (domain === "help_query") return compileHelpGrammar(nlu.rawText, { nlu, state: context.state });
  if (domain === "legacy_action") return compileLegacyActionGrammar(nlu.rawText, { nlu, state: context.state });
  return { ok: false, noMatch: true };
}

function typedValueForDomain(domain, compiled) {
  if (domain === "graph_mutation") return compiled.plan ?? compiled.draft ?? compiled;
  if (domain === "dataset_mapping" || domain === "dataset_grouping") return compiled.draft ?? compiled;
  if (domain === "parser_workflow") return compiled.operations ?? compiled;
  if (domain === "dashboard_control") return {
    canonicalIntent: compiled.canonicalIntent ?? compiled.intent,
    slots: compiled.slots ?? {},
  };
  if (domain === "grounded_question") return { intent: compiled.intent };
  if (domain === "help_query") return compiled.query ?? { intent: compiled.intent };
  if (domain === "legacy_action") return compiled.action ?? { intent: compiled.intent };
  return compiled.draft ?? compiled.plan ?? compiled.operations ?? compiled;
}

function typedKindForDomain(domain) {
  if (domain === "dataset_mapping" || domain === "dataset_grouping") return "DatasetMappingPatch";
  if (domain === "parser_workflow") return "ParserWorkflowOperation";
  if (domain === "graph_mutation") return "GraphMutationPlan";
  if (domain === "dashboard_control") return "DashboardControlIntent";
  if (domain === "grounded_question") return "GroundedQuestion";
  if (domain === "help_query") return "DeterministicHelpQuery";
  if (domain === "legacy_action") return "LegacyActionIntent";
  return null;
}

function baseDiagnostics(nlu, domain, {
  validatorStatus = "not_run",
  speechAct = "unknown",
  sideEffectClass = "read_only",
} = {}) {
  return {
    lexicalDomain: nlu?.primaryDomain ?? "unknown",
    lexicalIntent: nlu?.primaryIntent ?? "unknown",
    authoritativeDomain: domain,
    authoritativeIntent: nlu?.primaryIntent ?? "unknown",
    authoritativeCompiler: COMPILER_BY_DOMAIN[domain] ?? "unknown",
    lexicalConfidence: nlu?.confidence ?? null,
    validatorStatus,
    speechAct,
    sideEffectClass,
    legacyParserCalled: false,
    modelCalled: false,
    genericActionPlannerCalled: false,
  };
}

function questionIntentFor(domain, speechAct) {
  if (speechAct === "hypothetical_question") return `explain_hypothetical_${domain}`;
  if (speechAct === "reported_command") return `explain_reported_${domain}`;
  if (speechAct === "quoted_command") return `explain_quoted_${domain}`;
  if (domain === "parser_workflow" && speechAct === "status_question") return "parser_workflow";
  return `explain_${domain}`;
}
