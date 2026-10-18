import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { CANDY_ERROR_CODES, CandyContractError } from "../../../src/candy/contracts/errorClasses.js";
import { OwnedRoot } from "./ownedRoot.js";

const ID_PATTERN = /^sha256:([a-f0-9]{64})$/;
const MEDIA_TYPES = new Set(["application/json", "application/vnd.candy.graph+json", "application/vnd.candy.updates+json", "application/vnd.candy.state+json", "application/vnd.candy.result+json", "text/plain"]);

export class ArtifactStore {
  constructor({ root, maxBytes, maxArtifacts = 512, maxTotalBytes = 64 * 1024 * 1024, maxPendingWrites = 4 }) {
    this.root = resolve(root);
    this.maxBytes = maxBytes;
    this.metadataById = new Map();
    this.maxArtifacts = maxArtifacts;
    this.maxTotalBytes = maxTotalBytes;
    this.writes = Promise.resolve();
    this.pins = new Map();
    this.terminalOwners = new Map();
    this.pendingWrites = 0;
    this.maxPendingWrites = maxPendingWrites;
    this.ownedRoot = new OwnedRoot(this.root);
    this.closed = false;
  }

  async initialize() {
    await this.ownedRoot.initialize();
    this.realRoot = this.ownedRoot.realRoot;
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

  pin(ids, owner) {
    for (const id of new Set(ids)) this.metadata(id);
    for (const id of new Set(ids)) { if(!this.pins.has(id)) this.pins.set(id,new Set()); this.pins.get(id).add(owner); }
  }

  async release(owner, removeIds = []) {
    this.terminalOwners.delete(owner);
    this.unpin(owner);
    const operation=this.writes.then(async()=>{for(const id of new Set(removeIds))if(!this.pins.has(id) && this.metadataById.has(id))await this.evict(id);});
    this.writes=operation.catch(()=>{}); return operation;
  }

  unpin(owner) {
    for(const [id,owners] of this.pins) { owners.delete(owner); if(!owners.size)this.pins.delete(id); }
  }

  retainTerminal(owner, createdIds, expire) { this.terminalOwners.set(owner,{createdIds:[...createdIds],expire}); }

  async expireOldestTerminal() {
    const entry=this.terminalOwners.entries().next().value;
    if(!entry)return false;
    const [owner,record]=entry;this.terminalOwners.delete(owner);
    record.expire(); // synchronous unpublish before any artifact can disappear
    this.unpin(owner);
    // Already inside serialized writes: never enqueue release from this path.
    for(const id of new Set(record.createdIds))if(!this.pins.has(id) && this.metadataById.has(id))await this.evict(id);
    return true;
  }

  async evict(id) {
    if(this.pins.has(id))throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Artifact remains pinned by a job.");
    const prior=this.metadataById.get(id);this.metadataById.delete(id);
    try { await this.ownedRoot.removeFile(this.pathForId(id)); }
    catch(error){if(prior)this.metadataById.set(id,prior);throw error;}
  }

  totalBytes() { return [...this.metadataById.values()].reduce((n,m)=>n+m.byteLength,0); }

  async put(bytes, mediaType, {owner} = {}) {
    const length=typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes?.byteLength;
    if(this.closed || !Number.isSafeInteger(length) || length>this.maxBytes || this.pendingWrites>=this.maxPendingWrites)throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Artifact write admission limit reached.");
    if(!MEDIA_TYPES.has(mediaType))throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA,"Unsupported artifact media type.");
    this.pendingWrites++;
    try {
      const owned = Buffer.from(bytes);
      const write = this.writes.then(() => this.putOwned(owned,mediaType,owner));
      this.writes = write.catch(()=>{});
      return await write;
    } finally { this.pendingWrites--; }
  }

  async putOwned(bytes, mediaType, owner) {
    if (!MEDIA_TYPES.has(mediaType)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Unsupported artifact media type.");
    const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (content.length > this.maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Artifact exceeds the configured size limit.");
    const digest = createHash("sha256").update(content).digest("hex");
    const id = `sha256:${digest}`;
    await this.ownedRoot.check();
    const prior = this.metadataById.get(id);
    if(prior && prior.mediaType!==mediaType)throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA,"Immutable artifact already exists with another media type.");
    if(content.length>this.maxTotalBytes)throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Artifact exceeds store byte budget.");
    while(!prior && (this.metadataById.size>=this.maxArtifacts || this.totalBytes()+content.length>this.maxTotalBytes)) {
      const victim=[...this.metadataById.keys()].find(key=>!this.pins.has(key));
      if(victim)await this.evict(victim);
      else if(!await this.expireOldestTerminal())throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT,"Artifact store is full of active-job inputs/results.");
    }
    const path = this.pathForId(id);
    let handle;
    let created = false;
    try {
      handle = await open(path, "wx", 0o600);
      created = true;
      await handle.writeFile(content);
    } catch (error) {
      if (error.code !== "EEXIST") {
        await handle?.close(); handle=null;
        if(created)await this.ownedRoot.removeFile(path);
        throw error;
      }
      const existingInfo = await lstat(path);
      if (!existingInfo.isFile() || existingInfo.isSymbolicLink() || existingInfo.size!==content.length) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact collision target is not a bounded regular companion-owned file.");
      const existing = await readFile(path);
      if (!existing.equals(content)) throw new CandyContractError(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE, "Artifact digest collision detected.");
    } finally {
      await handle?.close();
    }
    const metadata = Object.freeze({ id, mediaType, byteLength: content.length });
    this.metadataById.delete(id);
    this.metadataById.set(id, metadata);
    if(owner)this.pin([id],owner);
    return metadata;
  }

  metadata(id) {
    this.validateId(id);
    const value = this.metadataById.get(id);
    if (!value) throw Object.assign(new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact is unknown or expired."),{httpStatus:404});
    this.metadataById.delete(id); this.metadataById.set(id,value);
    return value;
  }

  async read(id) {
    const metadata=this.metadata(id), owner=Symbol("read"); this.pin([id],owner);
    try {
    await this.ownedRoot.check();
    const path = this.pathForId(id);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size>this.maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact is not a bounded regular companion-owned file.");
    const real = await realpath(path);
    if (!real.startsWith(`${this.realRoot}${sep}`)) throw new CandyContractError(CANDY_ERROR_CODES.INVALID_GRAPH_SCHEMA, "Artifact escaped the store.");
    const bytes = await readFile(real);
    if (bytes.length > this.maxBytes) throw new CandyContractError(CANDY_ERROR_CODES.RESOURCE_LIMIT, "Stored artifact exceeds the configured size limit.");
    if (`sha256:${createHash("sha256").update(bytes).digest("hex")}` !== id || bytes.length !== metadata.byteLength) throw new CandyContractError(CANDY_ERROR_CODES.RESULT_VALIDATION_FAILURE,"Immutable artifact content no longer matches its authorized digest.");
    return bytes;
    } finally { const owners=this.pins.get(id);owners?.delete(owner);if(!owners?.size)this.pins.delete(id); }
  }

  async dispose() {
    this.closed=true;
    await this.writes;
    await this.ownedRoot.dispose();
  }

  async close() { this.closed=true;await this.writes;await this.ownedRoot.release(); }
}
