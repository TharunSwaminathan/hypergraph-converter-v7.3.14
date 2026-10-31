import { CONNECTION_POLICY as P, initialConnectionProfile, validateConnectionProfile, connectionFault } from "../persistence/modelConnectionSchema.js";
import { newProjectId } from "../persistence/projectSchema.js";
import { probeModelConnection } from "./modelConnectionProbe.js";

export function createModelReconnectCoordinator({ store, probe = probeModelConnection, setTimer = setTimeout, clearTimer = clearTimeout, channel = null, initialModel = null }) {
  const owner = newProjectId(), listeners = new Set();
  let live = true, generation = 0, revision = 0, profile = null, controller = null, timer = null, pendingWake = null, writes = Promise.resolve();
  let snapshot = Object.freeze({ state: "loading", code: "", profile: null, revision: 0, attempts: 0, models: [], message: "Loading local connection preferences…", transitions: [] });
  const isCurrent = token => live && token === generation;
  function emit(state, code = "", fields = {}) {
    if (!live) return;
    const transitions = [...snapshot.transitions, { state, code }].slice(-16);
    snapshot = Object.freeze({ ...snapshot, state, code, profile, revision, ...fields, transitions });
    for (const listener of listeners) listener(snapshot);
  }
  function cancel() { generation++; controller?.abort(); controller = null; clearTimer(timer); timer = null; pendingWake?.(); pendingWake = null; }
  function sleep(ms, token) { return new Promise(resolve => { pendingWake = resolve; timer = setTimer(() => { timer = null; pendingWake = null; resolve(); }, ms); if (!isCurrent(token)) { clearTimer(timer); resolve(); } }); }
  function persist(update, token) {
    const next = writes.then(async () => {
      if (!isCurrent(token)) throw connectionFault("ABORTED", "Connection preference action cancelled.");
      const saved = await store.saveConnectionProfile(revision, update(profile));
      revision = saved.revision; profile = saved.profile;
      channel?.postMessage({ kind: "preferences-changed", owner, revision });
      return saved;
    });
    writes = next.catch(() => {}); return next;
  }
  async function currentProfile(token) {
    const latest = await store.readConnectionProfile();
    if (!isCurrent(token)) throw connectionFault("ABORTED", "Connection attempt cancelled.");
    if (latest.revision !== revision) throw connectionFault("CONFLICT", "Connection preferences changed in another tab. Reload before reconnecting.");
  }
  async function attempt(value, token) {
    await currentProfile(token);
    if (!await store.acquireConnectionLease(owner)) throw connectionFault("LEASE_BUSY", "Another tab is probing the local model. Retry later.");
    if (!isCurrent(token)) throw connectionFault("ABORTED", "Connection attempt cancelled.");
    controller = new AbortController(); const result = await probe(value, { signal: controller.signal });
    await currentProfile(token); return result;
  }
  function connected(result, token) {
    if (!isCurrent(token)) return;
    emit("connected", "", { models: result.models, message: `Connected — ${profile.selectedModel}. Fresh model discovery succeeded; generation is tested only by a real request.` });
    if (profile.autoReconnectEnabled) timer = setTimer(() => { timer = null; void reconnect(true); }, P.monitorMs);
  }
  async function reconnect(background = false) {
    cancel(); const token = generation;
    if (!profile?.autoReconnectEnabled) { emit(profile ? "configured" : "disconnected", "", { message: "Automatic reconnect is off. Use Connect explicitly." }); return; }
    for (let n = 0; n < P.attempts && isCurrent(token); n++) {
      if (!(background && n === 0 && snapshot.state === "connected")) emit(n === 0 ? "connecting" : "reconnecting", "", { attempts: n + 1, message: `Checking approved local model (${n + 1}/${P.attempts})…` });
      try { const result = await attempt(profile, token); connected(result, token); return; }
      catch (error) {
        if (!isCurrent(token)) return;
        const code = error.code || "REQUEST_FAILED";
        if (["CONFLICT", "MODEL_UNAVAILABLE", "INVALID_ENDPOINT", "CORRUPT", "INCOMPATIBLE"].includes(code)) { emit(code === "MODEL_UNAVAILABLE" ? "model_unavailable" : "failed", code, { message: error.message }); return; }
        if (n === P.attempts - 1) { emit("unavailable", code, { message: "Bounded reconnect attempts exhausted. Workspace and memory remain available. Retry explicitly." }); return; }
        emit("reconnecting", code, { message: "Local model unavailable; waiting for the next bounded retry." });
        await sleep(P.delays[n], token);
      }
    }
  }
  if (channel) channel.onmessage = event => {
    const data = event.data;
    if (data?.kind !== "preferences-changed" || data.owner === owner || !Number.isSafeInteger(data.revision) || data.revision === revision) return;
    cancel(); emit("failed", "CONFLICT", { message: "Connection preferences changed in another tab. Reload to review them." });
  };
  return Object.freeze({
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    async initialize() {
      const token = generation;
      try {
        let saved = await store.readConnectionProfile(); if (!isCurrent(token)) return;
        // Legacy selection is a configured draft, never reconnect permission.
        if (saved.revision === 0 && initialModel) saved = await store.saveConnectionProfile(0, initialConnectionProfile(initialModel));
        if (!isCurrent(token)) return;
        revision = saved.revision; profile = saved.profile;
        emit(profile ? "configured" : "disconnected", "", { message: profile ? "Safe connection preferences restored; connectivity is not yet established." : "No approved local connection profile. Connect explicitly." });
        if (profile?.autoReconnectEnabled) void reconnect();
      } catch (error) { if (isCurrent(token)) emit("failed", error.code || "UNAVAILABLE", { message: error.message }); }
    },
    async connect(model, { endpoint = profile?.endpoint ?? "http://localhost:11434", transport = profile?.transport ?? "direct" } = {}) {
      cancel(); const token = generation;
      emit("connecting", "", { attempts: 1, message: "Checking the explicitly selected local model…" });
      try {
        const selection = initialConnectionProfile(model, endpoint, transport), result = await attempt(selection, token);
        if (!isCurrent(token)) throw connectionFault("ABORTED", "Connection attempt cancelled.");
        await persist(current => validateConnectionProfile({ ...selection, autoReconnectEnabled: current?.autoReconnectEnabled ?? false, lastKnownModelAvailability: "AVAILABLE", lastSuccessfulConnectionAt: new Date().toISOString() }), token);
        if (!isCurrent(token)) throw connectionFault("ABORTED", "Connection attempt cancelled.");
        connected(result, token); return { ...result, baseUrl: result.endpoint, message: `Connected to ${profile.selectedModel} after fresh local discovery.`, modelListed: true, generationTested: false, generationStructured: false };
      } catch (error) { if (isCurrent(token)) emit(error.code === "MODEL_UNAVAILABLE" ? "model_unavailable" : "failed", error.code || "REQUEST_FAILED", { message: error.message }); return { ok: false, classification: error.code, error: error.message }; }
    },
    async setAutoReconnect(enabled) {
      const wasConnected = snapshot.state === "connected"; cancel(); const token = generation;
      try {
        await persist(current => { if (!current || enabled && current.lastKnownModelAvailability !== "AVAILABLE") throw connectionFault("UNAVAILABLE", "Connect successfully before enabling reconnect."); return { ...current, autoReconnectEnabled: enabled }; }, token);
        if (!isCurrent(token)) return { ok: false, error: "Preference action superseded." };
        if (wasConnected) { connected({ models: snapshot.models }, token); return { ok: true, saved: true }; }
        emit("configured", "", { message: enabled ? "Automatic local reconnect enabled." : "Automatic reconnect disabled." });
        if (enabled) void reconnect();
        return { ok: true, saved: true };
      } catch (error) { if (isCurrent(token)) emit("failed", error.code || "UNAVAILABLE", { message: error.message }); return { ok: false, error: error.message }; }
    },
    async disconnect(forget = false) {
      cancel(); const token = generation; emit("disconnected", "", { message: "Disconnected. Retries cancelled; saving the preference…" });
      try {
        await persist(current => forget ? null : current ? { ...current, autoReconnectEnabled: false } : null, token);
        await store.releaseConnectionLease(owner).catch(() => {});
        if (isCurrent(token)) emit("disconnected", "", { message: forget ? "Connection preferences forgotten. Project data and memory retained." : "Disconnected; automatic reconnect disabled across restarts." });
        return { ok: true, saved: true };
      } catch (error) { if (isCurrent(token)) emit("failed", error.code || "UNAVAILABLE", { message: "Disconnected locally, but preference was NOT saved. " + error.message }); return { ok: false, error: error.message }; }
    },
    reconnect,
    async assertReady() { if (snapshot.state !== "connected") throw connectionFault("SERVICE_UNREACHABLE", "Local model is not connected."); await currentProfile(generation); return snapshot; },
    requestFailed() { if (live && snapshot.state === "connected") { cancel(); emit("disconnected", "SERVICE_UNREACHABLE", { message: "Model request failed; live connection must be revalidated." }); if (profile?.autoReconnectEnabled) void reconnect(); } },
    async dispose() { live = false; cancel(); listeners.clear(); channel?.close(); await store.releaseConnectionLease(owner).catch(() => {}); },
  });
}
