import { useEffect, useState } from "react";
import { BRIDGE_OLLAMA_BASE_URL } from "../agent/ollamaConnectionManager.js";

export default function ModelConnectionControls({ connection, selectedModel }) {
  const [model, setModel] = useState(selectedModel), [transport, setTransport] = useState("direct"), [error, setError] = useState("");
  useEffect(() => { setModel(selectedModel); }, [selectedModel]);
  useEffect(() => { setTransport(connection.profile?.transport ?? "direct"); }, [connection.profile?.transport]);
  async function run(action) { setError(""); try { const result = await action(); if (result?.ok === false) setError(result.error || "Connection action failed."); } catch (e) { setError(e.message); } }
  return <section aria-label="Persistent local connection" data-model-continuity={connection.state}>
    <p role="status">{connection.message} {error}</p>
    <label>Selected local model <input aria-label="Selected local model" maxLength={128} value={model} onChange={event => setModel(event.target.value)} /></label>
    <label>Approved transport <select aria-label="Approved transport" value={transport} onChange={event => setTransport(event.target.value)}><option value="direct">Direct loopback Ollama</option><option value="bridge">Configured local bridge</option></select></label>
    <button type="button" onClick={() => void run(() => connection.connect(model, { transport, endpoint: transport === "direct" ? "http://localhost:11434" : BRIDGE_OLLAMA_BASE_URL }))}>Connect selected model</button>
    <label><input type="checkbox" aria-label="Auto reconnect" checked={connection.profile?.autoReconnectEnabled ?? false} disabled={!connection.profile || connection.profile.lastKnownModelAvailability !== "AVAILABLE"} onChange={event => void run(() => connection.setAutoReconnect(event.target.checked))} />Auto reconnect to this approved local endpoint</label>
    <button type="button" onClick={() => void run(connection.disconnect)}>Disconnect and stop retries</button>
    <button type="button" onClick={() => void run(connection.retry)}>Retry approved connection</button>
    <button type="button" onClick={() => void run(connection.forget)}>Forget connection</button>
    <p>Discovery sends no conversation or inference request. Automatic retries stop after four attempts; workspace and memory stay available. Ollama processes and models are never started or installed automatically.</p>
  </section>;
}
