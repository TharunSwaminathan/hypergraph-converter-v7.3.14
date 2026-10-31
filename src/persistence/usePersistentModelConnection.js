import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createProjectStore } from "./projectStore.js";
import { createModelReconnectCoordinator } from "../agent/modelReconnectCoordinator.js";
import { connectionFault } from "./modelConnectionSchema.js";

export function usePersistentModelConnection({ ready, scopeKey, onState, initialModel = null }) {
  const [snapshot, setSnapshot] = useState({ state: "loading", profile: null, message: "Waiting for workspace and memory restoration…", models: [] });
  const owner = useRef(null), publish = useRef(onState);
  const seed = useRef(initialModel);
  useLayoutEffect(() => { publish.current = onState; }, [onState]);
  useEffect(() => {
    if (!ready) return;
    const store = createProjectStore(); let active = true, coordinator;
    try {
      const channel = typeof globalThis.BroadcastChannel === "function" ? new BroadcastChannel("hypergraph-studio.model-connection.v1") : null;
      coordinator = createModelReconnectCoordinator({ store, channel, initialModel: seed.current }); owner.current = coordinator;
      const update = value => { if (active) { setSnapshot(value); publish.current(value); } };
      const unsubscribe = coordinator.subscribe(update); update(coordinator.getSnapshot()); void coordinator.initialize();
      return () => { active = false; unsubscribe(); if (owner.current === coordinator) owner.current = null; void coordinator.dispose().finally(() => store.close()); };
    } catch (error) { setSnapshot({ state: "failed", profile: null, code: error.code, message: error.message, models: [] }); void store.close(); }
  }, [ready, scopeKey]);
  const call = (method, ...args) => { if (!owner.current) return Promise.reject(connectionFault("UNAVAILABLE", "Workspace and memory must finish restoration first.")); return owner.current[method](...args); };
  return { ...snapshot, connect: (...args) => call("connect", ...args), setAutoReconnect: value => call("setAutoReconnect", value), disconnect: () => call("disconnect"), forget: () => call("disconnect", true), retry: () => call("reconnect"), assertReady: () => call("assertReady"), requestFailed: () => owner.current?.requestFailed() };
}
