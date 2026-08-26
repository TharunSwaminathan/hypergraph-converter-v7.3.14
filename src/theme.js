// Design tokens shared across the app.

export const T = {
  bg: "#F3F4FA", surface: "#FFFFFF", card: "#EEF0F8", border: "#DEE1F2",
  accent: "#4F3EE8", accentLt: "#EEEBFF",
  teal: "#0982A8", tealLt: "#E1F5FB",
  amber: "#C0680A", amberLt: "#FDF1E1",
  rose: "#C21F45", roseLt: "#FDEEF1",
  green: "#0B7A55", greenLt: "#E5F8F1",
  purple: "#7228D9", purpleLt: "#EFE8FE",
  text: "#15151C", textDim: "#4B4B5D", textFaint: "#9494AC",
  shadowSm: "0 1px 3px rgba(24,20,70,0.06)",
  shadowMd: "0 4px 14px rgba(24,20,70,0.08)",
  shadowLg: "0 12px 32px rgba(24,20,70,0.12)",
  fontSans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};
export const PALETTE = ["#4F3EE8", "#0982A8", "#C0680A", "#C21F45", "#0B7A55", "#7228D9", "#9D174D", "#B45309", "#075985", "#3F6212", "#7C3AED", "#0F766E", "#B91C1C", "#0369A1", "#15803D"];

export const inputSt = { width: "100%", background: T.surface, border: "1px solid " + T.border, borderRadius: 10, color: T.text, fontSize: 14, fontFamily: T.fontMono, padding: "12px 14px", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.7, transition: "border-color 0.15s ease, box-shadow 0.15s ease" };
