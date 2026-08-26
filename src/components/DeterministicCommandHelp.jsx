import { useEffect, useMemo, useState } from "react";
import {
  COMMAND_CATALOG,
  getCatalogEntry,
  getQuickStartEntries,
} from "../agent/deterministicNlu/commandCatalog.js";
import { searchCommandCatalog } from "../agent/deterministicNlu/commandCatalogSearch.js";
import { badgeText } from "../agent/deterministicNlu/commandCatalogFormatter.js";
import {
  COMMAND_AVAILABILITY,
  COMMAND_CATEGORY_LABELS,
  categoryLabel,
} from "../agent/deterministicNlu/commandCatalogSchema.js";
import "./DeterministicCommandHelp.css";

const ALL = "all";

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function selectOptions(mapOrValues) {
  if (Array.isArray(mapOrValues)) return mapOrValues.map(value => ({ value, label: value }));
  return Object.entries(mapOrValues).map(([label, value]) => ({ value, label: readableEnumLabel(value, label) }));
}

function readableEnumLabel(value, fallback = value) {
  if (value === ALL) return "All";
  return String(value ?? fallback).replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

export default function DeterministicCommandHelp({ onTryExample, onOpenPanel }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [availability, setAvailability] = useState(ALL);
  const [sideEffect, setSideEffect] = useState(ALL);
  const [confirmation, setConfirmation] = useState(ALL);
  const [modelPolicy, setModelPolicy] = useState(ALL);
  const [copyStatus, setCopyStatus] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const filteredEntries = useMemo(() => searchCommandCatalog({
    query,
    category,
    availability,
    sideEffect,
    confirmation,
    modelPolicy,
    limit: 200,
  }), [query, category, availability, sideEffect, confirmation, modelPolicy]);

  const quickStartEntries = useMemo(() => getQuickStartEntries(), []);
  const visibleEntries = filteredEntries;
  const availabilityOptions = uniqueOptions(COMMAND_CATALOG.map(entry => entry.availability));
  const sideEffectOptions = uniqueOptions(COMMAND_CATALOG.map(entry => entry.sideEffect));
  const confirmationOptions = uniqueOptions(COMMAND_CATALOG.map(entry => entry.confirmation));
  const modelPolicyOptions = uniqueOptions(COMMAND_CATALOG.map(entry => entry.modelPolicy));

  useEffect(() => {
    function applyHash() {
      if (typeof window === "undefined") return;
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!hash.startsWith("help")) return;
      const categoryMatch = hash.match(/^help\/category\/(.+)$/);
      if (categoryMatch) {
        setCategory(categoryMatch[1].replace(/-/g, "_"));
        setExpandedId("");
        return;
      }
      const entryMatch = hash.match(/^help\/(.+)$/);
      if (!entryMatch) return;
      const entry = getCatalogEntry(entryMatch[1]);
      if (!entry) return;
      setExpandedId(entry.id);
      setCategory(ALL);
      setQuery("");
      window.requestAnimationFrame?.(() => focusCommandCardById(entry.id));
    }
    applyHash();
    window.addEventListener?.("hashchange", applyHash);
    return () => window.removeEventListener?.("hashchange", applyHash);
  }, []);

  function clearFilters() {
    setQuery("");
    setCategory(ALL);
    setAvailability(ALL);
    setSideEffect(ALL);
    setConfirmation(ALL);
    setModelPolicy(ALL);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`Copied: ${text.slice(0, 48)}`);
    } catch {
      setCopyStatus("Copy failed. Select the example text manually.");
    }
  }

  async function copyLink(entryId) {
    const link = typeof window === "undefined"
      ? `#help/${entryId}`
      : `${window.location.origin}${window.location.pathname}${window.location.search}#help/${entryId}`;
    await copyText(link);
  }

  function navigateToEntry(entryId) {
    const entry = getCatalogEntry(entryId);
    if (!entry) return;
    setExpandedId(entry.id);
    setQuery("");
    setCategory(ALL);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `#help/${entry.id}`);
    }
    window.requestAnimationFrame?.(() => focusCommandCardById(entry.id));
  }

  return (
    <div className="det-command-help agent-model agent-help" aria-label="Deterministic command help and reference">
      <div className="agent-model__header">
        <div>
          <span className="agent-model__title">Help</span>
        </div>
        <span className="agent-model__future">deterministic command catalog</span>
      </div>

      <section className="det-command-help__intro" aria-label="Help introduction">
        <p>
          These are supported command patterns and examples, not a case-sensitive command language.
          The deterministic assistant accepts several natural-language variations. Search and filters are local-only:
          no model call, no network call, no graph mutation.
        </p>
      </section>

      <section className="det-command-help__quick" aria-label="Quick Start">
        <h3>Quick Start</h3>
        <div className="det-command-help__quick-grid">
          {quickStartEntries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => navigateToEntry(entry.id)}
              aria-label={`Show help for ${entry.title}`}
            >
              <strong>{entry.title}</strong>
              <span>{entry.examples?.[0]?.text ?? entry.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="det-command-help__faq" aria-label="Frequently asked questions">
        <details>
          <summary>How do I connect a local model?</summary>
          <p>Open Assistant Settings, start Ollama on this machine, then click Connect. Deterministic commands and this Help system still work when Ollama is disconnected.</p>
        </details>
        <details>
          <summary>Do I need the local model?</summary>
          <p>No. Graph previews, mapping/grouping edits, dashboard routing, parser workflow controls, command search, and catalog help are deterministic and offline. A local model may assist unusual phrasing only after deterministic routing is not confident.</p>
        </details>
        <details>
          <summary>Is data sent to the cloud?</summary>
          <p>No cloud APIs, hosted model calls, API keys, or bundled model weights are included. Remote model endpoints are blocked by default to avoid leaking uploaded file previews.</p>
        </details>
        <details>
          <summary>Why do graph edits require confirmation?</summary>
          <p>Graph edits first create a deterministic preview. Nothing changes until you confirm the staged action.</p>
        </details>
        <details>
          <summary>What is the difference between a question and an action?</summary>
          <p>`Would paper_id be a better key?` is read-only. `Could you use paper_id as the key?` is an action request and creates a reversible mapping edit.</p>
        </details>
        <details>
          <summary>Are algorithms chatbot commands or panel tools?</summary>
          <p>In this build, Connected Components, BFS, DFS, Dijkstra, Degree Distribution, and K-shell/Coreness are panel-only. Use the Algorithms panel after loading a graph.</p>
          <button type="button" onClick={() => onOpenPanel?.("workspace")}>Return to workspace</button>
        </details>
      </section>

      <div className="det-command-help__filters" aria-label="Command search and filters">
        <label>
          <span>Search commands</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="add vertex, paper key, confirmation, quoted..."
          />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value={ALL}>All categories</option>
            {Object.entries(COMMAND_CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Availability</span>
          <select value={availability} onChange={event => setAvailability(event.target.value)}>
            <option value={ALL}>All availability</option>
            {selectOptions(availabilityOptions).map(option => <option key={option.value} value={option.value}>{readableEnumLabel(option.value)}</option>)}
          </select>
        </label>
        <label>
          <span>Side effect</span>
          <select value={sideEffect} onChange={event => setSideEffect(event.target.value)}>
            <option value={ALL}>All side effects</option>
            {selectOptions(sideEffectOptions).map(option => <option key={option.value} value={option.value}>{readableEnumLabel(option.value)}</option>)}
          </select>
        </label>
        <label>
          <span>Confirmation</span>
          <select value={confirmation} onChange={event => setConfirmation(event.target.value)}>
            <option value={ALL}>All confirmation</option>
            {selectOptions(confirmationOptions).map(option => <option key={option.value} value={option.value}>{readableEnumLabel(option.value)}</option>)}
          </select>
        </label>
        <label>
          <span>Offline/model</span>
          <select value={modelPolicy} onChange={event => setModelPolicy(event.target.value)}>
            <option value={ALL}>All model policies</option>
            {selectOptions(modelPolicyOptions).map(option => <option key={option.value} value={option.value}>{readableEnumLabel(option.value)}</option>)}
          </select>
        </label>
        <button type="button" className="det-command-help__clear" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="det-command-help__copy-status" aria-live="polite">{copyStatus}</div>

      <section className="det-command-help__results" aria-label="Command reference results">
        <div className="det-command-help__result-count">
          {visibleEntries.length} catalog entr{visibleEntries.length === 1 ? "y" : "ies"}
        </div>
        {visibleEntries.map(entry => (
          <details
            key={entry.id}
            id={commandDomId(entry.id)}
            data-legacy-id={`help-${entry.id}`}
            className="det-command-card"
            open={expandedId === entry.id || Boolean(query && visibleEntries.length <= 5)}
            onToggle={event => {
              if (query && visibleEntries.length <= 5) return;
              const isOpen = event.currentTarget.open;
              setExpandedId(current => isOpen ? entry.id : current === entry.id ? "" : current);
            }}
          >
            <summary aria-current={expandedId === entry.id ? "true" : undefined}>
              <span>
                <strong>{entry.title}</strong>
                <em>{categoryLabel(entry.category)} · {entry.availability === COMMAND_AVAILABILITY.PANEL_ONLY ? "Panel only" : entry.availability === COMMAND_AVAILABILITY.FORMAT_REFERENCE ? "Format reference" : "Chat/reference"}</em>
              </span>
              <span className="det-command-card__badges" aria-label={`Badges for ${entry.title}`}>
                {badgeText(entry).slice(0, 6).map(badge => <b key={badge}>{badge}</b>)}
              </span>
            </summary>
            <div className="det-command-card__body">
              <p>{entry.summary}</p>
              <dl>
                <div><dt>Required context</dt><dd>{(entry.requiredContext ?? []).join(", ") || "none"}</dd></div>
                <div><dt>What it changes</dt><dd>{readableEnumLabel(entry.sideEffect)}</dd></div>
                <div><dt>Confirmation</dt><dd>{readableEnumLabel(entry.confirmation)}</dd></div>
                <div><dt>Offline/model</dt><dd>{readableEnumLabel(entry.modelPolicy)}</dd></div>
                <div><dt>Typed kind</dt><dd>{entry.typedKind}</dd></div>
                <div><dt>Operations/intents</dt><dd>{(entry.operationTypes ?? []).join(", ") || "none"}</dd></div>
              </dl>
              {entry.patterns?.length > 0 && (
                <div className="det-command-card__section">
                  <h4>Supported patterns</h4>
                  <ul>{entry.patterns.map(pattern => <li key={pattern}><code>{pattern}</code></li>)}</ul>
                </div>
              )}
              {entry.examples?.length > 0 && (
                <div className="det-command-card__section">
                  <h4>Examples</h4>
                  <ul className="det-command-card__examples">
                    {entry.examples.map(example => (
                      <li key={example.text}>
                        <code>{example.text}</code>
                        <span>
                          <button type="button" onClick={() => onTryExample?.(example.text)} aria-label={`Try this command: ${example.text}`}>Try this command</button>
                          <button type="button" onClick={() => copyText(example.text)} aria-label={`Copy command: ${example.text}`}>Copy</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.format && (
                <div className="det-command-card__section">
                  <h4>Format example</h4>
                  <pre>{entry.format.example}</pre>
                  <p>{entry.format.expectations} Auto Detect: {entry.format.autoDetect ? "supported" : "not advertised for this route"}.</p>
                </div>
              )}
              {entry.identifierNotes?.length > 0 && (
                <div className="det-command-card__section">
                  <h4>Quoted identifier notes</h4>
                  <ul>{entry.identifierNotes.map(note => <li key={note}>{note}</li>)}</ul>
                </div>
              )}
              {entry.ambiguityNotes?.length > 0 && (
                <div className="det-command-card__section">
                  <h4>Possible clarification</h4>
                  <ul>{entry.ambiguityNotes.map(note => <li key={note}>{note}</li>)}</ul>
                </div>
              )}
              {entry.relatedCommandIds?.length > 0 && (
                <div className="det-command-card__section">
                  <h4>Related commands</h4>
                  <div className="det-command-card__related">
                    {entry.relatedCommandIds.map(relatedId => {
                      const related = getCatalogEntry(relatedId);
                      return related
                        ? (
                          <button
                            type="button"
                            key={relatedId}
                            onClick={() => navigateToEntry(relatedId)}
                            aria-label={`Open related command ${related.title}`}
                          >
                            {related.title}
                          </button>
                        )
                        : null;
                    })}
                  </div>
                </div>
              )}
              <div className="det-command-card__link-row">
                <button type="button" onClick={() => copyLink(entry.id)} aria-label={`Copy deep link for ${entry.title}`}>Copy link</button>
              </div>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function commandDomId(entryId = "") {
  return `command-${String(entryId).replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function focusCommandCardById(entryId = "") {
  if (typeof document === "undefined") return;
  const card = document.getElementById(commandDomId(entryId));
  if (!card) return;
  card.scrollIntoView?.({ block: "center", behavior: "smooth" });
  card.querySelector("summary")?.focus?.();
}
