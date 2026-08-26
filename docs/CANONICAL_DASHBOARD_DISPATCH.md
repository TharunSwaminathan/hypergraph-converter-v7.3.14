# Canonical Dashboard Dispatch

Dashboard NLU compiles to canonical intents such as:

```text
NAVIGATE_STATS
NAVIGATE_VISUALIZATION
OPEN_RUNTIME_DIAGNOSTICS
SET_EXPORT_FORMAT
SET_VISUAL_LIMIT
SET_INPUT_ROUTE
```

`resolveCanonicalControlPlan(...)` maps those canonical values into the existing `planAgentAction(...)` action shapes. This preserves route/export/state validation while avoiding a second raw-text `classifyIntent(...)` pass for successfully compiled dashboard commands.
