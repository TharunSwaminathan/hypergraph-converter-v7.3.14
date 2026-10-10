// Defer revocation until the browser has dispatched the download. No contents
// or authority are retained by the cleanup registry.
export function createDownloadLifecycle({ document = globalThis.document, urlApi = globalThis.URL,
  BlobType = globalThis.Blob, schedule = globalThis.setTimeout, unschedule = globalThis.clearTimeout } = {}) {
  const pending = new Map();
  const release = url => {
    if (!pending.has(url)) return;
    unschedule(pending.get(url)); pending.delete(url); urlApi.revokeObjectURL(url);
  };
  return Object.freeze({
    download(name, content, mediaType = "text/plain") {
      const url = urlApi.createObjectURL(new BlobType([content], {type:mediaType}));
      pending.set(url, null);
      let anchor;
      try {
        anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
        anchor.hidden = true; document.body.appendChild(anchor); anchor.click();
        pending.set(url, schedule(() => release(url), 1000));
      } catch (error) { release(url); throw error; }
      finally { anchor?.remove(); }
    },
    dispose() { for (const url of pending.keys()) release(url); },
    retainedCount: () => pending.size,
  });
}
