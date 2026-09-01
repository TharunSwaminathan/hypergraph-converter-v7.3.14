import { executeDerivedOperation } from "../derived/derivedOperations.js";

self.onmessage = event => {
  const { graphVersion, requestId, operationType, options, hyperedges } = event.data ?? {};
  try {
    const value = executeDerivedOperation(operationType, hyperedges ?? [], options ?? {});
    self.postMessage({ ok: true, graphVersion, requestId, operationType, value });
  } catch (error) {
    self.postMessage({
      ok: false,
      graphVersion,
      requestId,
      operationType,
      error: { name: error?.name ?? "Error", message: error?.message ?? String(error) },
    });
  }
};
