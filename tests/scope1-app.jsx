import { createRoot } from "react-dom/client";
import App from "../src/App.jsx";
import { CUSTOM_PARSER_FEW_SHOTS } from "../src/agent/prompts/customParserFewShots.js";
import "../src/index.css";

// Scoped to this test HTML entry. No production route imports this transport.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.href);
  if (url.pathname === "/api/tags") return Response.json({ models: [{ name: "qwen3:8b" }] });
  if (url.pathname === "/api/chat") {
    const body = JSON.parse(init.body);
    const task = body.format?.properties?.task?.enum?.[0];
    const content = task === "generate_custom_parser" || task === "repair_custom_parser"
      ? { task, summary: "Controlled test draft", ...(task === "generate_custom_parser" ? { parseMode: "together", fileRoles: [], expectedOutput: "canonicalHyperedges", assumptions: [], testPlan: [] } : { fixes: [] }), parserCode: CUSTOM_PARSER_FEW_SHOTS.find(e => e.id === "08").code, warnings: [], requiresClarification: false, questionsForUser: [] }
      : { status: "ok" };
    return Response.json({ message: { role: "assistant", content: JSON.stringify(content) }, done: true });
  }
  if (url.origin !== location.origin) throw new Error("Test transport blocks all other external requests.");
  return originalFetch(input, init);
};
createRoot(document.querySelector("#root")).render(<App />);
