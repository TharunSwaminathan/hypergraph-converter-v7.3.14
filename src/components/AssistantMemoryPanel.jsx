import { useState } from "react";
import { MEMORY_TYPES } from "../persistence/assistantMemorySchema.js";

export default function AssistantMemoryPanel({ memory }) {
  const [type, setType] = useState("USER_DECISION"), [topic, setTopic] = useState("general"), [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  async function run(command) { try { const result = command.kind === "list" ? await memory.inspect() : await memory.mutate(command); setMessage(result?.ok === false ? "No memory was changed." : command.kind === "list" ? "Inspection refreshed." : "Memory committed."); } catch (error) { setMessage(error.message); } }
  return <details className="assistant-project-memory" data-testid="assistant-memory">
    <summary>Project Assistant memory</summary>
    <p>Local project context only. Remembered text never approves or runs actions. Choose a specific topic to identify conflicting claims.</p>
    <p role="status">{memory.status === "ready" ? "Project memory available." : memory.status === "saving" ? "Saving memory…" : memory.status === "loading" ? "Loading project memory…" : "Project memory unavailable. Original records are preserved."} {message}</p>
    <label>Memory type <select aria-label="Memory type" value={type} onChange={event => setType(event.target.value)}>{MEMORY_TYPES.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Memory topic <input aria-label="Memory topic" value={topic} maxLength={80} onChange={event => setTopic(event.target.value)} /></label>
    <label>Memory text <textarea aria-label="Memory text" value={content} maxLength={2000} onChange={event => setContent(event.target.value)} /></label>
    <button type="button" disabled={["loading", "saving"].includes(memory.status)} onClick={() => void run({ kind: "remember", memoryType: type, topic, content, provenance: "USER_EXPLICIT" })}>Remember</button>
    <button type="button" onClick={() => void run({ kind: "list" })}>Inspect memories</button>
    <button type="button" onClick={() => void run({ kind: "remember", provenance: "WORKSPACE_DERIVED" })}>Capture verified workspace fact</button>
    <button type="button" onClick={() => void run({ kind: "forgetType", memoryType: type })}>Forget selected category</button>
    <button type="button" onClick={() => void run({ kind: "clear" })}>Clear project memory</button>
    <ul>{memory.records.filter(record => record.status !== "FORGOTTEN").map(record => <li key={record.memoryId} data-memory-id={record.memoryId}>
      <strong>{record.memoryType} / {record.topic}</strong> — {record.provenance} / {record.retrievalStatus ?? record.status}
      <p style={{ whiteSpace: "pre-wrap" }}>{record.content}</p>
      <small>Updated {new Date(record.updatedAt).toLocaleString()}</small>
      {record.status === "ACTIVE" && <button type="button" onClick={() => void run({ kind: "supersede", memoryId: record.memoryId, content, provenance: "USER_EXPLICIT" })}>Replace with editor text</button>}
      <button type="button" onClick={() => void run({ kind: "forget", memoryId: record.memoryId })}>Forget memory</button>
    </li>)}</ul>
  </details>;
}
