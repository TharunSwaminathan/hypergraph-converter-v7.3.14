# Scope 7F physical interruption and integrated restart plan

Baseline: `1d4c3b0659e39ae015f8e85888a1f0f68b14cecf`.
Required branch: `candy-integration-scope7f-physical-restart-qualification`.
The parent qualification tag must peel to this baseline. No product changes are proposed initially.

1. Freeze tracked bytes, historical evidence and Git refs; run fresh installation, all source tests, focused 7A–7E tests, lint, production/Pages/relative builds, production audit and whitespace check before any corrective.
2. Exercise native IndexedDB with isolated Chrome profiles at canonical `127.0.0.1:5173`, using only owned browser/process IDs. Test-only boundary instrumentation lives under `artifacts/candy-scope7f-work`; production source stays unchanged unless a reproduced defect requires a corrective.
3. Record all twenty requested interruption scenarios, including revision/hash state, last acknowledged state, interruption method and post-restart recovery. Separate actual forced process termination from transaction abort, delayed callbacks and controlled network failures. Never label these as machine power removal.
4. Exercise actual local qwen3:8b when available; independently test offline recovery, bounded reconnect and durable reconnect OFF without stopping personal/unowned services. A controlled outage is explicitly labeled as such.
5. Run repeated integrated recovery cycles and measure object growth, memory consistency, stale rejection, browser errors and reconnect behavior. Freeze any defect before editing; qualify the smallest correction if needed.
6. Record manual security review, exact evidence/proposed inventory and protected history. No automated security seal is planned or claimed. True machine power-loss testing is not automated and remains unexecuted unless explicitly performed.

Hard stop before staging, committing, tagging or modifying main. Do not begin export/import, motif history, broader Runtime redesign or another scope.
