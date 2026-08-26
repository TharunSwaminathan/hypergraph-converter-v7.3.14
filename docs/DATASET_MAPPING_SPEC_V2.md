# DatasetMappingSpec v2

`DatasetMappingSpec` v2 adds batch/version binding, grouping revision, mapping revision, groups, files, entities, relationships, filters, policies, evidence, warnings, questions, and assumptions.

The validator rejects stale batch/grouping versions, unknown files, unknown columns, update-stream execution, executable-looking fields, unsupported roles, unsupported filter operators, and invalid policy values.

`src/agent/datasetMappingMigration.js` migrates v1 specs into v2 in memory so existing mapping flows remain usable.
## v7.3.1 bootstrap rule

If an active Custom Parser batch has profile/grouping evidence but no stored mapping, chat mapping instructions may bootstrap a valid DatasetMappingSpec v2 from the deterministic v7.3 generator. The bootstrap base uses mapping revision `0`; the user/model patch creates the next revision only if validated mapping content changes.
