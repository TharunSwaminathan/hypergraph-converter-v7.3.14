import React, { useRef } from "react";
import {
  mapWithConcurrency,
  readFileText,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_POLICY,
  uploadFileExtension,
  validateSelectedFiles,
} from "../agent/uploadPolicy.js";

export function useUpload(cb) {
  const r = useRef(null);
  const abortRef = useRef(null);
  const go = () => r.current?.click();
  const el = React.createElement("input", { type: "file", accept: UPLOAD_ACCEPT_ATTRIBUTE, ref: r, style: { display: "none" }, onChange: async e => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const f = validateSelectedFiles(e.target.files ?? [], { ...UPLOAD_POLICY, maxFiles: 1 })[0];
      if (!f) return;
      const text = await readFileText(f, { signal: controller.signal });
      if (controller.signal.aborted || abortRef.current !== controller) return;
      cb(text, f);
    } catch (error) {
      if (error?.name === "AbortError") return;
      cb("", null, error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      e.target.value = "";
    }
  } });
  return [el, go];
}
export function useMultiUpload(cb) {
  const r = useRef(null);
  const abortRef = useRef(null);
  const go = () => r.current?.click();
  const el = React.createElement("input", { type: "file", accept: UPLOAD_ACCEPT_ATTRIBUTE, multiple: true, ref: r, style: { display: "none" }, onChange: async e => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const files = validateSelectedFiles(e.target.files ?? []);
      if (!files.length) return;
      const records = await mapWithConcurrency(files, UPLOAD_POLICY.readConcurrency, async f => ({
        name: f.name,
        text: await readFileText(f, { signal: controller.signal }),
        size: f.size,
        type: f.type,
        extension: uploadFileExtension(f.name).replace(/^\./, ""),
      }), { signal: controller.signal });
      if (controller.signal.aborted || abortRef.current !== controller) return;
      cb(records);
    } catch (error) {
      if (error?.name === "AbortError") return;
      cb([], error);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      e.target.value = "";
    }
  } });
  return [el, go];
}
