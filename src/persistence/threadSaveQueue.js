// Retain one in-flight save and one latest snapshot, even if storage stalls.
// A disposed mount cannot enqueue writes or receive completion callbacks.
export function createThreadSaveQueue(save, onSuccess, onError) {
  let latest = null, running = false, epoch = 0, active = true;
  async function drain() {
    running = true;
    try {
      while (active && latest) {
        const value = latest.value, generation = epoch;
        latest = null;
        try {
          await save(value);
          if (active && generation === epoch) onSuccess();
        } catch (error) {
          if (active && generation === epoch) onError(error);
        }
      }
    } finally { running = false; }
  }
  return Object.freeze({
    enqueue(value) { if (!active) return; latest = { value }; if (!running) void drain(); },
    activate() { active = true; },
    dispose() { active = false; epoch++; latest = null; },
  });
}
