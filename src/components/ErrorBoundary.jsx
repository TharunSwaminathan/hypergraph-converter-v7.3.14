import { Component } from "react";

// ── Error Boundary ─────────────────────────────────────────────────────────────
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 48, fontFamily: "monospace", color: "#C0152F", background: "#FFF1F2", minHeight: "100vh" }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Runtime Error</div>
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 24, padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}
