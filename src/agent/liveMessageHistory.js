// Display history only. Confirmation, pending and result owners live elsewhere.
export const MAX_LIVE_MESSAGES = 500;
export function appendLiveMessage(previous, message) {
  return [...previous.slice(-(MAX_LIVE_MESSAGES - 1)), message];
}
