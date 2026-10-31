import { CONNECTION_POLICY as P, approvedModelEndpoint, connectionFault } from "../persistence/modelConnectionSchema.js";
import { validateLocalModelName } from "./localModelSettings.js";
import { StorageFault } from "../persistence/storageSafety.js";

// GET discovery only: never send chat, infer, follow redirects, or try a fallback.
export async function probeModelConnection(profile, { signal, fetchImpl = globalThis.fetch, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const endpoint = approvedModelEndpoint(profile.endpoint, profile.transport);
  if (!validateLocalModelName(profile.selectedModel).ok) throw connectionFault("MODEL_UNAVAILABLE", "Select a valid local model.");
  const controller = new AbortController(); let timer, abort;
  const deadline = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(connectionFault("ABORTED", "Connection attempt cancelled.")); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimer(() => { controller.abort(); reject(connectionFault("TIMEOUT", "Local model discovery timed out.")); }, P.probeTimeoutMs);
  });
  async function request() {
    if (controller.signal.aborted) throw connectionFault("ABORTED", "Connection attempt cancelled.");
    const response = await fetchImpl(endpoint + "/api/tags", { method: "GET", signal: controller.signal, redirect: "error", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    if (!response.ok) throw connectionFault("REQUEST_FAILED", "Local model discovery request failed.");
    if (Number(response.headers?.get?.("content-length")) > P.responseBytes) throw connectionFault("PROTOCOL_ERROR", "Local discovery response exceeds its limit.");
    let text = "", size = 0;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > P.responseBytes) throw connectionFault("PROTOCOL_ERROR", "Local discovery response exceeds its limit."); text += decoder.decode(part.value, { stream: true }); } text += decoder.decode(); }
      catch (error) { void reader.cancel().catch(() => {}); throw error; }
      finally { reader.releaseLock(); }
    } else { text = await response.text(); if (new TextEncoder().encode(text).byteLength > P.responseBytes) throw connectionFault("PROTOCOL_ERROR", "Local discovery response exceeds its limit."); }
    let data; try { data = JSON.parse(text); } catch { throw connectionFault("PROTOCOL_ERROR", "Local discovery response is not valid JSON."); }
    if (!data || !Array.isArray(data.models) || data.models.length > P.models) throw connectionFault("PROTOCOL_ERROR", "Local discovery model inventory is invalid.");
    const models = data.models.map(item => item?.name);
    if (models.some(name => typeof name !== "string" || !validateLocalModelName(name).ok || validateLocalModelName(name).model !== name) || new Set(models).size !== models.length) throw connectionFault("PROTOCOL_ERROR", "Local discovery contains invalid model names.");
    if (!models.includes(profile.selectedModel)) throw connectionFault("MODEL_UNAVAILABLE", "The remembered model is not installed. Select a model explicitly.");
    return { ok: true, models, model: profile.selectedModel, endpoint, transport: profile.transport };
  }
  try { return await Promise.race([deadline, request()]); }
  catch (error) { if (error instanceof StorageFault) throw error; throw connectionFault(controller.signal.aborted ? "ABORTED" : "SERVICE_UNREACHABLE", "Local Ollama service is unavailable."); }
  finally { clearTimer(timer); signal?.removeEventListener("abort", abort); controller.abort(); }
}
