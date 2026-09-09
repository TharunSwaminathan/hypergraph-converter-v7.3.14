export const MAX_REACT_STEPS = 8;
export const REACT_ORCHESTRATOR_FLAG = "VITE_REACT_ORCHESTRATOR_ENABLED";

export function reactOrchestratorEnabled(value = undefined) {
  const configured = value ?? (typeof import.meta !== "undefined" ? import.meta.env?.[REACT_ORCHESTRATOR_FLAG] : undefined);
  return !["0", "false", "off", "disabled"].includes(String(configured ?? "true").trim().toLowerCase());
}
