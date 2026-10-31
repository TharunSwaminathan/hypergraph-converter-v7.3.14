# Local model connection continuity (Scope 7D)

The Ollama profile belongs to this application at this browser origin. Endpoint,
transport, model selection and reconnect preference are shared across projects;
Scope 7C Assistant memory remains project-owned. A connection never grants graph,
parser, CUDA or destructive-action authority. Nothing pending resumes on reconnect.

Use Assistant Settings to select a model and either direct loopback Ollama or the
existing configured local bridge, then **Connect selected model**. This performs
GET `/api/tags`, verifies the exact model name and commits the validated selection.
It does not run inference. A successful real Assistant request separately tests
generation. Explicitly enable **Auto reconnect** after connecting to opt in.
Manual Connect alone never enables reconnect. The recommended model is a default
draft, not a requirement or a claim that it is installed.

Startup restores workspace and project memory first, then loads the application
profile. CONFIGURED is not CONNECTED: a fresh bounded discovery must succeed.
With reconnect OFF, restart restores configuration without making a probe.
With reconnect ON, the approved endpoint and exact model are checked. Each burst
has four attempts, a 4-second whole-response deadline per attempt, and delays of
1.5, 5 and 12 seconds. Exhaustion enters UNAVAILABLE with no retry timer; use Retry
explicitly. A missing model is terminal MODEL_UNAVAILABLE, with no substitution.
After success, an opted-in connection has a 30-second discovery monitor. A healthy
background check preserves CONNECTED and does not abort an active inference;
failure triggers the same bounded recovery policy. Timings can vary with browser
scheduling and service load; these settings are not latency guarantees.

**Disconnect and stop retries** immediately cancels work and commits reconnect OFF.
It preserves the safe profile. **Forget connection** also commits a revisioned
tombstone, resets legacy general connection hints and removes the old input-only
settings key. It preserves workspace/source/graph, project memory and history.
Storage failures are reported truthfully; a failed durable OFF write means a
future restart may still see the older preference. These controls never start
Ollama, install software, download a model or execute shell commands.

The IndexedDB database advances from version 3 to 4 by adding `modelConnections`;
project/workspace/memory schemas are unchanged. The single profile is keyed
`local-ollama`, with an atomic CAS revision and completion-only save receipts.
A syntactically valid legacy model choice can migrate once as an unverified draft
with reconnect OFF. Legacy liveness/transport history never grants permission.
General localStorage settings retain numeric generation preferences and public
defaults, not the user's selected connection. A tombstone prevents legacy draft
resurrection. The profile's historical `lastSuccessfulConnectionAt` records an
explicit successful Connect, not current liveness or background probe timing.

Only credential-free `http://localhost:11434`, `http://127.0.0.1:11434`, or the
existing configured loopback bridge `/ollama` endpoint can reconnect. URLs with
credentials, queries, fragments, arbitrary ports/paths/hosts or other schemes are
rejected. There is no cloud fallback or automatic transport fallback. Discovery
omits credentials, rejects redirects and has bounded response/model inventory
limits. It never sends conversation, memory, headers or a raw prompt for health.

Generations and abort signals invalidate superseded probes, project lifecycles
and unmounts. Tabs use CAS and a 6-second shared probe lease rather than timestamp
last-writer authority. Broadcast notifications carry revision markers only;
foreign preference changes cancel connectivity and require reload, rather than
rebasing an old writer. Retries are bounded even when another tab owns the lease.
Browser suspension/lease expiry can permit a short overlap with a very late
request, but stale results cannot establish authority. Profile and lease data are
local browser state and are excluded from portable source archives.

Scope 7D qualification uses isolated synthetic browser storage. Actual Ollama
continuity is distinct from controlled local-server outage tests and from mocked
lifecycle/transaction tests. A pre-commit proposed-source archive is not candidate
commit provenance: exact candidate-SHA packaging, remote CI and final exact-SHA
qualification remain deferred until a candidate commit exists. Scope 7E polished
Resume Workspace UX and Scope 7F physical power-loss qualification remain deferred.
