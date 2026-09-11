import { analyzePositiveAuthorization } from "./deterministicNlu/positiveAuthorization.js";

const CANDY_TOPIC = /\b(candy|sssp|single[- ]source shortest paths?|shortest paths?|job)\b/i;
const ACTION_VERBS = Object.freeze({
  SUBMIT_CANDY_JOB: new Set(["run", "submit", "start", "execute", "compute", "calculate", "find"]),
  CANCEL_CANDY_JOB: new Set(["cancel", "stop"]),
});

export function authorizeCandyReactAction(action, userQuery) {
  if (["DISCOVER_CANDY_CAPABILITIES", "GET_CANDY_JOB_STATUS", "OPEN_CANDY_RESULT"].includes(action)) return Object.freeze({ allowed: true });
  const allowedVerbs = ACTION_VERBS[action];
  if (!allowedVerbs || !CANDY_TOPIC.test(String(userQuery ?? ""))) return Object.freeze({ allowed: false, reason: "The request did not name the matching CANDY operation." });
  const authorization = analyzePositiveAuthorization(userQuery);
  const matched = authorization.mode === "authorized"
    && authorization.authorizedClauses.some(clause => allowedVerbs.has(clause.requestedAction));
  return matched
    ? Object.freeze({ allowed: true })
    : Object.freeze({ allowed: false, reason: "The exact positive request did not authorize this CANDY action family." });
}
