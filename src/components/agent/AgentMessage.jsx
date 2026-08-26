function renderInline(text) {
  const parts = String(text ?? "").split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderBlock(block, index) {
  if (block.type === "code") {
    return <pre key={index} className="agent-message__code"><code>{block.text}</code></pre>;
  }
  const lines = block.text.split(/\n/).filter(Boolean);
  if (lines.length > 1 && lines.every(line => /^\s*[-*]\s+/.test(line))) {
    return (
      <ul key={index}>
        {lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}
      </ul>
    );
  }
  if (lines.length > 1 && lines.every(line => /^\s*\d+[.)]\s+/.test(line))) {
    return (
      <ol key={index}>
        {lines.map((line, itemIndex) => <li key={itemIndex}>{renderInline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}
      </ol>
    );
  }
  return <p key={index}>{renderInline(block.text)}</p>;
}

function parseBlocks(text) {
  const source = String(text ?? "");
  const blocks = [];
  const parts = source.split(/```/);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    if (index % 2 === 1) {
      blocks.push({ type: "code", text: part.replace(/^[a-z0-9_-]+\n/i, "").trim() });
    } else {
      for (const paragraph of part.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)) {
        blocks.push({ type: "text", text: paragraph });
      }
    }
  }
  return blocks.length ? blocks : [{ type: "text", text: "" }];
}

export default function AgentMessage({ message, busy, pendingAction, onAction }) {
  const label = message.role === "user" ? "You" : "Hypergraph Assistant";
  return (
    <article className={`agent-message agent-message--${message.role} ${message.tone ? `agent-message--${message.tone}` : ""}`}>
      <span className="agent-message__label">{label}</span>
      <div className="agent-message__content">
        {message.text
          ? parseBlocks(message.text).map(renderBlock)
          : <p className="agent-message__placeholder">Generating…</p>}
      </div>
      {message.actions?.length > 0 && (
        <div className="agent-message__actions">
          {message.actions.map(action => (
            <button
              key={action.id ?? action.label}
              type="button"
              onClick={() => onAction(action)}
              disabled={busy || Boolean(pendingAction)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}


