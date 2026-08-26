export async function executeCompiledDashboardControl({ prepared, query, executeDashboardControl } = {}) {
  if (typeof executeDashboardControl !== "function") return { handled: false, outcome: "not_handled" };
  return executeDashboardControl(prepared, query);
}
