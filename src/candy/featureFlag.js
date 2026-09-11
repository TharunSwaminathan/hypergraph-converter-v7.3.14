export function candyRuntimeEnabled(env = import.meta.env) {
  return String(env?.VITE_CANDY_RUNTIME_ENABLED ?? "").trim().toLowerCase() === "true";
}

export const DEFAULT_CANDY_RUNTIME_URL = "http://127.0.0.1:8791";
