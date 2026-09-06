import { useEffect, useRef } from "react";

export default function AgentComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy = false,
  streaming = false,
  disabled = false,
  activeBatch = null,
  fileCount = 0,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(180, Math.max(48, node.scrollHeight))}px`;
  }, [value]);

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="agent-composer" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <div className="agent-composer__context">
        <span className="agent-composer__batch">
          {activeBatch ? `${activeBatch.label} · ${fileCount} file${fileCount === 1 ? "" : "s"}` : "No active batch"}
        </span>
      </div>
      <label className="agent-composer__label" htmlFor="hypergraph-agent-composer">
        Message Hypergraph Assistant
      </label>
      <div className="agent-composer__row">
        <textarea
          id="hypergraph-agent-composer"
          ref={textareaRef}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your files, formats, mappings, parser, graph, or request an action…"
          disabled={disabled || (busy && !streaming)}
          rows={2}
        />
        {streaming ? (
          <button type="button" onClick={onStop} className="agent-composer__stop">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!value.trim() || busy || disabled}>
            Send
          </button>
        )}
      </div>
      <div className="agent-composer__hint">Enter sends · Shift+Enter adds a newline</div>
    </form>
  );
}


