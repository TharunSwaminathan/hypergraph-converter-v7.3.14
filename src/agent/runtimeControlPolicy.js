const SELECTABLE_TRANSPORTS = new Set(["direct", "bridge"]);

export function isTransportSelectingConnectionPlan(plan) {
  return String(plan?.kind ?? "") === "test_local_model"
    && SELECTABLE_TRANSPORTS.has(String(plan?.configOverride?.preferTransport ?? ""));
}
