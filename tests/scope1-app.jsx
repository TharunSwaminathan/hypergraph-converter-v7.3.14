import { createRoot } from "react-dom/client";
import { useState } from "react";
import App from "../src/App.jsx";
import { runBoundedOrchestrator } from "../src/agent/orchestratorLoop.js";
import "../src/index.css";

/* eslint-disable react-refresh/only-export-components -- standalone browser qualification entry */

const CONTROLLED_MULTIFILE_PARSER = `async function parseHypergraph(files, helpers) {
  const required = ["members.weird", "relations.weird", "metadata.weird"];
  const available = new Set(files.map(file => file.name));
  if (!required.every(name => available.has(name))) throw new Error("Controlled fixture files are incomplete.");
  return [
    { id: "h0", vertices: ["A", "B"], time: null, weight: 1 },
    { id: "h1", vertices: ["B", "C"], time: null, weight: 1 },
    { id: "h2", vertices: ["A", "C"], time: null, weight: 2 }
  ];
}`;

// Scoped to this test HTML entry. No production route imports this transport.
const originalFetch = window.fetch.bind(window);
window.__scope2Probe = { reactCalls: 0, specialistCalls: 0, requests: [] };
window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  if (url.pathname === "/api/tags") return Response.json({ models: [{ name: "qwen3:8b" }] });
  if (url.pathname === "/api/chat") {
    const body = JSON.parse(init.body);
    const task = body.format?.properties?.task?.enum?.[0];
    const isReactStep = body.format?.required?.includes("outcome") && body.format?.required?.includes("finish");
    window.__scope2Probe.requests.push({ task: isReactStep ? "react_orchestrator_step" : task ?? "health", messageCount: body.messages?.length ?? 0 });
    if (isReactStep) {
      window.__scope2Probe.reactCalls += 1;
      const payload = JSON.parse(body.messages.at(-1).content);
      const request = String(payload.userRequest ?? "");
      if (request.includes("TEST MAX STEPS")) {
        const limit = Math.min(10_000, Number(payload.authoritativeObservation?.ui?.visualLimit ?? 50) + 1);
        return Response.json({ message: { role: "assistant", content: JSON.stringify({ outcome: "PROPOSE_ACTION", action: "SET_VIZ_LIMIT", arguments: { limit }, requiresUserInput: false, userMessage: null, finish: false }) }, done: true });
      }
      if (request.includes("TEST TOOL FAILURE")) {
        const failed = payload.authoritativeObservation?.lastToolResult?.ok === false;
        const content = failed
          ? { outcome: "FINAL_RESPONSE", action: null, arguments: {}, requiresUserInput: false, userMessage: "The mapping validation failed; no change was made.", finish: true }
          : { outcome: "PROPOSE_ACTION", action: "VALIDATE_MAPPING_SPEC", arguments: {}, requiresUserInput: false, userMessage: null, finish: false };
        return Response.json({ message: { role: "assistant", content: JSON.stringify(content) }, done: true });
      }
      const canStartSpecialist = payload.allowedActions.includes("START_CUSTOM_PARSER_WORKFLOW");
      const content = canStartSpecialist
        ? { outcome: "PROPOSE_ACTION", action: "START_CUSTOM_PARSER_WORKFLOW", arguments: {}, requiresUserInput: false, userMessage: null, finish: false }
        : { outcome: "FINAL_RESPONSE", action: null, arguments: {}, requiresUserInput: false, userMessage: "No further action is available from the authoritative state.", finish: true };
      return Response.json({ message: { role: "assistant", content: JSON.stringify(content) }, done: true });
    }
    if (task === "generate_custom_parser" || task === "repair_custom_parser") window.__scope2Probe.specialistCalls += 1;
    const content = task === "generate_custom_parser" || task === "repair_custom_parser"
      ? { task, summary: "Controlled test draft", ...(task === "generate_custom_parser" ? { parseMode: "together", fileRoles: [], expectedOutput: "canonicalHyperedges", assumptions: [], testPlan: [] } : { fixes: [] }), parserCode: CONTROLLED_MULTIFILE_PARSER, warnings: [], requiresClarification: false, questionsForUser: [] }
      : { status: "ok" };
    return Response.json({ message: { role: "assistant", content: JSON.stringify(content) }, done: true });
  }
  if (url.origin !== location.origin) throw new Error("Test transport blocks all other external requests.");
  return originalFetch(input, init);
};
// Browser-qualification helper scoped to this test entry. It exercises the
// production upload event without a native file-picker dialog.
window.__scope2UploadUnsupportedFiles = () => {
  const input = document.querySelector('input[aria-label="Choose files for Batch Updates"]');
  const files = [
    new window.File(["alpha|beta\nA|B"], "members.weird", { type: "text/plain" }),
    new window.File(["left=>right\nB=>C"], "relations.weird", { type: "text/plain" }),
    new window.File(["meta::2026"], "metadata.weird", { type: "text/plain" }),
  ];
  Object.defineProperty(input, "files", { configurable: true, value: files });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
};

function ControlledScope2App() {
  const [coreEvidence, setCoreEvidence] = useState(null);
  async function runBrowserCoreQualification() {
    const step = (outcome, action, args, userMessage, finish, requiresUserInput) => JSON.stringify({ outcome, action, arguments: args, requiresUserInput, userMessage, finish });
    let version = 0;
    let modelCalls = 0;
    let executions = 0;
    const observe = lastToolResult => ({ stateVersionToken: String(version), pendingConfirmation: null, upload: { fileCount: 1, requiresReupload: false }, formatDetection: { status: "supported" }, grouping: { status: "together" }, dataset: { activeDatasetId: "browser", available: true }, availableCapabilities: ["SET_VIZ_LIMIT"], lastToolResult });
    const max = await runBoundedOrchestrator({
      userQuery: "Coordinate this workflow.", getObservation: observe,
      callModel: async () => ({ ok: true, raw: step("PROPOSE_ACTION", "SET_VIZ_LIMIT", { limit: ++modelCalls }, null, false, false) }),
      authorizeAction: () => ({ allowed: true }), executeAction: async () => { executions++; version++; return { ok: true, outcome: "updated" }; },
    });
    let toolCalls = 0;
    const failure = await runBoundedOrchestrator({
      userQuery: "Validate this workflow.", getObservation: lastToolResult => ({ ...observe(lastToolResult), availableCapabilities: ["VALIDATE_MAPPING_SPEC"] }),
      callModel: async ({ observation }) => ({ ok: true, raw: observation.lastToolResult
        ? step("FINAL_RESPONSE", null, {}, "The tool failed; no change was made.", true, false)
        : step("PROPOSE_ACTION", "VALIDATE_MAPPING_SPEC", {}, null, false, false) }),
      authorizeAction: () => ({ allowed: true }), executeAction: async () => { toolCalls++; throw new Error("controlled browser tool failure"); },
    });
    let fallbacks = 0;
    const falseSuccess = await runBoundedOrchestrator({
      userQuery: "Coordinate this workflow.", getObservation: observe,
      callModel: async () => ({ ok: true, raw: step("FINAL_RESPONSE", null, {}, "Successfully applied and completed.", true, false) }),
      fallback: async () => { fallbacks++; return { ok: true, outcome: "fallback" }; },
    });
    setCoreEvidence({ maxOutcome: max.outcome, modelCalls: max.metrics.modelCalls, executions, toolFailureOutcome: failure.outcome, toolCalls, falseSuccessFallback: Boolean(falseSuccess.fallbackUsed && fallbacks === 1) });
  }
  return <>
    <button type="button" id="scope2-controlled-upload" onClick={() => window.__scope2UploadUnsupportedFiles()}>TEST ONLY: load unsupported multi-file batch</button>
    <button type="button" id="scope2-browser-core" onClick={runBrowserCoreQualification}>TEST ONLY: run bounded browser core checks</button>
    {coreEvidence && <output id="scope2-browser-core-result">{JSON.stringify(coreEvidence)}</output>}
    <App />
  </>;
}

createRoot(document.querySelector("#root")).render(<ControlledScope2App />);
