// Design tokens shared across the app.
//
// Visual language: a restrained "computational notebook" look inspired by Wolfram Cloud —
// white cells on a light neutral canvas, hairline rules, small radii, one warm red-orange
// accent for primary actions, a steel blue for secondary/informational controls, and
// self-hosted Source Sans / Source Serif / Source Code fonts (bundled; nothing is fetched
// from a CDN, so the app still works offline).
//
// IMPORTANT: colour values must stay 6-digit hex strings. Many call sites build translucent
// variants by appending two hex digits (for example `T.accent + "22"`). The same values are
// mirrored as CSS custom properties in src/index.css; keep the two in sync.

export const T = {
  // surfaces
  bg: "#F4F5F6", surface: "#FFFFFF", card: "#F7F8F9", border: "#DCDFE3", borderStrong: "#C3C8CE",
  // brand / primary action
  accent: "#C8361A", accentDark: "#A82B13", accentLt: "#FBEDE9",
  // secondary / informational (links, assistant, vertices)
  teal: "#1F6E99", tealLt: "#E9F1F7",
  // semantic
  amber: "#8F5E00", amberLt: "#FBF3DE",
  rose: "#A31230", roseLt: "#FBECEF",
  green: "#2A7A4B", greenLt: "#E8F4EC",
  purple: "#5C4E8C", purpleLt: "#EFEDF6",
  // text (all pass WCAG AA 4.5:1 on white and on bg)
  text: "#1B1F24", textDim: "#4A5159", textFaint: "#6A727B",
  // elevation — deliberately faint; structure comes from hairline borders, not shadows
  shadowSm: "0 1px 2px rgba(20,28,38,0.06)",
  shadowMd: "0 2px 8px rgba(20,28,38,0.08)",
  shadowLg: "0 8px 24px rgba(20,28,38,0.12)",
  // type
  fontSans: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  fontSerif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  fontMono: "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  // shape
  radiusSm: 3, radiusMd: 4, radiusLg: 6,
};

// Categorical colours for hyperedges / components. Modelled on the default plot colours used
// by computational notebooks (blue, orange, green, red-orange, violet, ...) so rings stay
// distinguishable on a white canvas.
export const PALETTE = [
  "#5E81B5", "#E19C24", "#8FB032", "#EB6235", "#8778B3",
  "#C56E1A", "#5D9EC7", "#C9A400", "#A560A3", "#7F8A00",
  "#6685D9", "#BC5C80", "#47B76E", "#C8361A", "#4F6D7A",
];

export const inputSt = {
  width: "100%", background: T.surface, border: "1px solid " + T.borderStrong, borderRadius: T.radiusMd,
  color: T.text, fontSize: 13.5, fontFamily: T.fontMono, padding: "10px 12px", resize: "vertical",
  boxSizing: "border-box", outline: "none", lineHeight: 1.65,
  transition: "border-color 0.12s ease, box-shadow 0.12s ease",
};

// Shared control styles. Components may spread these and override single properties.
export const btnPrimarySt = {
  padding: "7px 16px", borderRadius: T.radiusMd, border: "1px solid " + T.accent, background: T.accent,
  color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: T.fontSans,
};
export const btnSecondarySt = {
  padding: "5px 12px", borderRadius: T.radiusMd, border: "1px solid " + T.borderStrong, background: T.surface,
  color: T.text, fontWeight: 500, fontSize: 13, cursor: "pointer", fontFamily: T.fontSans,
};
export const labelSt = {
  fontSize: 11, color: T.textFaint, textTransform: "uppercase", letterSpacing: 0.9, fontWeight: 600,
};
