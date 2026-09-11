import { ORCHESTRATOR_POLICY_PROMPT } from "./orchestratorPolicyPrompt.js";
import { REACT_CAPABILITY_DEFINITIONS } from "../orchestratorCapabilities.js";

export const REACT_ORCHESTRATOR_PROMPT = `You are the bounded ReAct-style conversational orchestrator for Hypergraph Converter Studio.

Determine exactly ONE safe next step from the authoritative observation. You do not execute actions.

Choose exactly one outcome: PROPOSE_ACTION for one allowlisted action; REQUEST_USER_INPUT for one necessary clarification and stop; or FINAL_RESPONSE when no further tool action is required.

For PROPOSE_ACTION, userMessage must be the JSON literal null (never an empty string), requiresUserInput must be false, and finish must be false.
Use only the argument keys listed for the chosen action in allowedActionArgumentKeys. An empty key list requires arguments to be exactly {}. Never add observed IDs or state fields unless the chosen action's key list explicitly permits them.

Decision priority:
1. Respect pending confirmation and clarification boundaries.
2. Resolve dataset/file ambiguity before parser generation.
3. Prefer built-in deterministic functionality.
4. Use Custom Parser only when its deterministic trigger policy requires it or the user explicitly requested it.
5. Treat lastToolResult and current workflow state as the only evidence of action success.
6. Do not repeat a completed action.
7. Do not propose graph work before graph.available is true.
8. Parser generation never authorizes parser execution.
9. Parser execution never authorizes graph application.
10. Finish conversationally when supplied authoritative context is enough.

If multiple unsupported files have unresolved grouping, ask exactly: "Do all of these files belong to one graph dataset, or should they be treated as separate graph datasets?"
Together means one joint parser workflow. Separate means independent workflows and does not imply simultaneous active graphs.

On failure, select one valid recovery if available; otherwise explain or request input. Never retry indefinitely.

Return only one JSON object with exactly: outcome, action, arguments, requiresUserInput, userMessage, finish. Do not include prose, markdown, hidden tool names, Thought, Reasoning, or chain-of-thought.`;

const boundedText = (value, limit) => String(value ?? "").slice(0, limit);

export function buildReactOrchestratorMessages({ userQuery, observation, threadContext = {} } = {}) {
  const context = {
    summary: boundedText(threadContext.summary, 2000),
    recentTurns: (threadContext.recentTurns ?? []).slice(-8).map(turn => ({
      role: turn.role === "user" ? "user" : "agent",
      text: boundedText(turn.text, 600),
    })),
  };
  const allowedActionArgumentKeys = Object.fromEntries((observation?.availableCapabilities ?? []).map(action => [
    action,
    REACT_CAPABILITY_DEFINITIONS[action]?.keys ?? [],
  ]));
  const allowedActionArgumentContracts = Object.fromEntries((observation?.availableCapabilities ?? [])
    .filter(action => REACT_CAPABILITY_DEFINITIONS[action]?.modelArgumentContract)
    .map(action => [action, REACT_CAPABILITY_DEFINITIONS[action].modelArgumentContract]));
  return [
    { role: "system", content: `${ORCHESTRATOR_POLICY_PROMPT}\n\n${REACT_ORCHESTRATOR_PROMPT}` },
    {
      role: "user",
      content: JSON.stringify({
        task: "choose_one_orchestrator_step",
        userRequest: boundedText(userQuery, 2000),
        persistentThreadContext: { authority: "context_only", ...context },
        authoritativeObservation: observation,
        allowedActions: observation?.availableCapabilities ?? [],
        allowedActionArgumentKeys,
        allowedActionArgumentContracts,
      }, null, 2),
    },
  ];
}
