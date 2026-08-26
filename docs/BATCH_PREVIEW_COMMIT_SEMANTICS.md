# Batch preview and commit semantics

Advanced Options batch commands are no longer presented as a generic "apply" checkbox.

The intended state flow is:

```text
committed graph
  -> Preview Batch Changes
  -> temporary batch preview overlay
  -> Commit Batch Changes OR Discard Preview
```

While the preview overlay is active, conversational graph edits are blocked. This avoids ambiguity about whether the assistant should edit the committed graph or the temporary preview graph.

Commit uses the existing graph mutation preview/commit pipeline and records the graph change normally. Discard clears only the preview overlay; it does not modify the committed graph.
