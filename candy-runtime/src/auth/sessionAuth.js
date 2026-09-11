import { randomBytes, timingSafeEqual } from "node:crypto";

export function generatePairingToken() {
  return randomBytes(32).toString("base64url");
}

export function createSessionAuth(token = generatePairingToken()) {
  if (typeof token !== "string" || token.length < 32) throw new TypeError("Pairing token must contain at least 32 characters.");
  const expected = Buffer.from(token, "utf8");
  return Object.freeze({
    token,
    authorize(header) {
      if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
      const supplied = Buffer.from(header.slice(7), "utf8");
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    },
  });
}
