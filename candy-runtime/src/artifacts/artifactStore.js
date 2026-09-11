import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";

const ID_PATTERN = /^sha256:([a-f0-9]{64})$/;
const MEDIA_TYPES = new Set(["application/json", "application/vnd.candy.graph+json", "application/vnd.candy.updates+json", "application/vnd.candy.state+json", "application/vnd.candy.result+json", "text/plain"]);

export class ArtifactStore {
  constructor({ root, maxBytes }) {
    this.root = resolve(root);
    this.maxBytes = maxBytes;
    this.metadataById = new Map();
  }

  async initialize() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Artifact root must be a private directory.");
    this.realRoot = await realpath(this.root);
    return this;
  }

  validateId(id) {
    const match = ID_PATTERN.exec(id);
    if (!match) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Malformed artifact ID.");
    return match[1];
  }

  pathForId(id) {
    const digest = this.validateId(id);
    const path = resolve(this.root, `${digest}.artifact`);
    if (!path.startsWith(`${this.root}${sep}`)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact path escaped the store.");
    return path;
  }

  async put(bytes, mediaType) {
    if (!MEDIA_TYPES.has(mediaType)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unsupported artifact media type.");
    const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (content.length > this.maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Artifact exceeds the configured size limit.");
    const digest = createHash("sha256").update(content).digest("hex");
    const id = `sha256:${digest}`;
    const path = this.pathForId(id);
    let handle;
    try {
      handle = await open(path, "wx", 0o600);
      await handle.writeFile(content);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existingInfo = await lstat(path);
      if (!existingInfo.isFile() || existingInfo.isSymbolicLink()) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact collision target is not a regular companion-owned file.");
      const existing = await readFile(path);
      if (!existing.equals(content)) throw new CandyContractError(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Artifact digest collision detected.");
    } finally {
      await handle?.close();
    }
    const metadata = Object.freeze({ id, mediaType, byteLength: content.length });
    const prior = this.metadataById.get(id);
    if (prior && prior.mediaType !== mediaType) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Immutable artifact already exists with another media type.");
    this.metadataById.set(id, metadata);
    return metadata;
  }

  metadata(id) {
    this.validateId(id);
    const value = this.metadataById.get(id);
    if (!value) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact does not exist.");
    return value;
  }

  async read(id) {
    this.metadata(id);
    const path = this.pathForId(id);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact is not a regular companion-owned file.");
    const real = await realpath(path);
    if (!real.startsWith(`${this.realRoot}${sep}`)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact escaped the store.");
    const bytes = await readFile(real);
    if (bytes.length > this.maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Stored artifact exceeds the configured size limit.");
    return bytes;
  }

  async dispose() {
    await rm(this.root, { recursive: true, force: true });
  }
}
