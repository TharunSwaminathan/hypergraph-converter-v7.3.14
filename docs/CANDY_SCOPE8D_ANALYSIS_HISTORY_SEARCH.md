# Find retained analysis results

Open **Algorithms → Analysis history** in the active project. **Search analysis labels** matches a literal substring of existing result labels, ignores case and surrounding spaces, and accepts up to 80 UTF-16 code units. Choose a **Backend** (All, CPU, CUDA_STATIC or CUDA_INCREMENTAL) and an **Origin** (All, Local or Imported / unverified) to narrow the same list. The search and both filters apply together.

**Showing X of Y results** counts matching rows and total loaded retained results. Results keep their existing order. The panel distinguishes loading or unavailable history, a confirmed empty archive, and a loaded archive with no matches. If history is updating or an operation fails, previously loaded rows are identified as a snapshot.

**Reset filters** shows the full retained list. An open result stays selected while it matches. Filtering out a result, or losing it from the archive, closes its details. Expanding the list again leaves it unselected. Searches and filters reset on project changes or reload. They are held only in the current panel and are never saved or transferred. Search does not include result contents, graph, source or Assistant memory.

History-only projects use these controls after Resume. Imported results retain their unverified provenance. Browsing and filtering run no analysis or model request. A rerun remains an explicit operation with the existing current-input and confirmation checks. **Clear project analysis history** still requires confirmation and applies to the whole active project's retained history, even when only some rows match or none match.

The existing project limits remain 24 retained results and 2 MiB of analysis history. Filtering changes neither retention nor the contents of either portable file format.
