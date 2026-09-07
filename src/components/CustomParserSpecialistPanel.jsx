import { useState } from "react";

export default function CustomParserSpecialistPanel({ specialist, actions, submit, blocked }) {
  const [notice, setNotice] = useState("");
  if (!specialist) return null;
  const disabled = blocked || specialist.working;
  const policy = specialist.policy;
  const visible = specialist.jobs.length || ["specialist", "awaiting_grouping", "clarify_format"].includes(policy.kind);
  if (!visible) return null;
  return <section className="agent-upload" aria-label="Custom Parser Specialist">
    <strong>Custom Parser Specialist</strong>
    <p>{policy.reason ?? "Generate a bounded parser draft for the active dataset. Review code before requesting a run."}</p>
    {policy.kind === "awaiting_grouping" && <div className="agent-file-actions">
      <button type="button" disabled={disabled} onClick={() => submit("Parse together as one dataset")}>One dataset</button>
      <button type="button" disabled={disabled} onClick={() => submit("Parse separately")}>Separate datasets</button>
    </div>}
    {policy.kind === "specialist" && <button type="button" disabled={disabled} onClick={() => submit("Generate custom parser")}>Generate parser draft</button>}
    <div role="status">{notice}{specialist.working ? " Preparing parser draft…" : ""}</div>
    {specialist.jobs.map(job => <article key={job.id} className="agent-batch">
      <strong>{job.fileNames.join(", ")}</strong><div>{job.status} · {job.attempts}/3 attempts</div>
      {job.error && <p role="alert">{job.error}</p>}
      {job.data?.questionsForUser?.map(q => <p key={q}>{q}</p>)}
      {job.code && <details><summary>Review generated source</summary><pre style={{ maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap" }}>{job.code}</pre></details>}
      {job.status === "ready_for_review" && <div className="agent-file-actions">
        <button type="button" disabled={disabled} onClick={() => { const result = actions.adoptSpecialistDraft(job.id); setNotice(result.ok ? "Draft opened in Custom Parser Studio. Review it, then request Run custom parser in chat." : result.error); }}>Open draft in Studio</button>
      </div>}
      {job.status === "repair_needed" && <button type="button" disabled={disabled || job.attempts >= 3} onClick={async () => { const result = await actions.repairSpecialistDraft(job.id); setNotice(result.message ?? result.error); }}>Repair draft from latest error</button>}
    </article>)}
  </section>;
}
