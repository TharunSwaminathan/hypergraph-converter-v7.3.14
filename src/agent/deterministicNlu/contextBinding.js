import { selectionFingerprint } from "../../graph/entityResolver.js";

export function createDeterministicContextBinding({
  activeBatch = null,
  graphIdentity = {},
  selectedEntity = null,
  pendingAction = null,
} = {}) {
  return {
    batchId: activeBatch?.id ?? null,
    batchVersion: activeBatch?.version ?? null,
    mappingRevision: activeBatch?.mappingRevision ?? null,
    groupingRevision: activeBatch?.groupingRevision ?? null,
    graphId: graphIdentity?.graphId ?? null,
    graphVersion: graphIdentity?.graphVersion ?? null,
    graphFingerprint: graphIdentity?.graphFingerprint ?? null,
    selectedEntity: selectedEntity ? {
      type: selectedEntity.type ?? null,
      id: selectedEntity.id ?? null,
      graphId: selectedEntity.graphId ?? graphIdentity?.graphId ?? null,
      graphVersion: selectedEntity.graphVersion ?? graphIdentity?.graphVersion ?? null,
      graphFingerprint: selectedEntity.graphFingerprint ?? graphIdentity?.graphFingerprint ?? null,
    } : null,
    selectedEntityFingerprint: selectionFingerprint(selectedEntity),
    pendingActionId: pendingAction?.id ?? null,
    pendingActionType: pendingAction?.actionType ?? null,
    pendingActionPlanHash: pendingAction?.plan?.planHash ?? pendingAction?.confirmationToken?.mutationPlanHash ?? null,
  };
}

export function createStateContextBinding(state = {}, pendingAction = null) {
  return {
    batchId: state.activeBatch?.id ?? state.activeBatchId ?? null,
    batchVersion: state.activeBatch?.version ?? state.batchVersion ?? null,
    mappingRevision: state.activeBatch?.mappingRevision ?? null,
    groupingRevision: state.activeBatch?.groupingRevision ?? null,
    graphId: state.graphId ?? null,
    graphVersion: state.graphVersion ?? null,
    graphFingerprint: state.graphFingerprint ?? null,
    selectedEntity: state.selectedGraphEntity ? {
      type: state.selectedGraphEntity.type ?? null,
      id: state.selectedGraphEntity.id ?? null,
      graphId: state.selectedGraphEntity.graphId ?? state.graphId ?? null,
      graphVersion: state.selectedGraphEntity.graphVersion ?? state.graphVersion ?? null,
      graphFingerprint: state.selectedGraphEntity.graphFingerprint ?? state.graphFingerprint ?? null,
    } : null,
    selectedEntityFingerprint: selectionFingerprint(state.selectedGraphEntity),
    pendingActionId: pendingAction?.id ?? null,
    pendingActionType: pendingAction?.actionType ?? null,
    pendingActionPlanHash: pendingAction?.plan?.planHash ?? pendingAction?.confirmationToken?.mutationPlanHash ?? null,
  };
}

export function bindingMismatch(expected = {}, actual = {}, scope = "all") {
  const keysByScope = {
    mapping: ["batchId", "batchVersion", "mappingRevision", "groupingRevision"],
    parser: ["batchId", "batchVersion", "mappingRevision", "groupingRevision"],
    graph: ["graphId", "graphVersion", "graphFingerprint", "pendingActionType", "pendingActionPlanHash"],
    dashboard: [],
    grounded: [],
    pending: ["pendingActionType", "pendingActionPlanHash"],
    all: [
      "batchId",
      "batchVersion",
      "mappingRevision",
      "groupingRevision",
      "graphId",
      "graphVersion",
      "graphFingerprint",
      "pendingActionType",
      "pendingActionPlanHash",
    ],
  };
  const keys = [...(keysByScope[scope] ?? keysByScope.all)];
  if (["graph", "all"].includes(scope) && expected?.selectedEntityFingerprint != null) {
    keys.push("selectedEntityFingerprint");
  }
  for (const key of keys) {
    if ((expected?.[key] ?? null) !== (actual?.[key] ?? null)) {
      return { stale: true, key, expected: expected?.[key] ?? null, actual: actual?.[key] ?? null };
    }
  }
  return { stale: false };
}

export function staleBindingMessage(scope = "all") {
  if (scope === "graph") return "The graph or selected graph entity changed after I interpreted that request. Please send the edit again.";
  if (scope === "mapping") return "The active dataset mapping changed after I interpreted that request. Please send the mapping edit again.";
  if (scope === "parser") return "The active parser or dataset batch changed after I interpreted that request. Please send the workflow request again.";
  if (scope === "pending") return "The pending action changed after I interpreted that correction. Please send the correction again.";
  return "The workspace changed after I interpreted that request. Please send it again.";
}
