import { createHash } from "node:crypto";

// Pure parsing reuse only. Callers must freshly read/hash/validate every source
// and recheck tags/device/binary; a hit confers no qualification authority.
export function createQualificationJsonCache({maxEntries=16,maxBytes=4*1024*1024}={}) {
  const entries=new Map();let bytes=0,hits=0,parses=0;
  const freeze=value=>{if(value && typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
  return Object.freeze({
    parse(input) {
      const source=Buffer.isBuffer(input)?input:Buffer.from(input);
      const key=createHash("sha256").update(source).digest("hex"),entry=entries.get(key);
      if(entry && entry.source.equals(source)){hits++;entries.delete(key);entries.set(key,entry);return entry.value;}
      const value=freeze(JSON.parse(source.toString("utf8")));parses++;
      if(source.length<=maxBytes) {
        if(entry){bytes-=entry.source.length;entries.delete(key);}
        while(entries.size>=maxEntries || bytes+source.length>maxBytes){const [old,victim]=entries.entries().next().value;entries.delete(old);bytes-=victim.source.length;}
        entries.set(key,{source:Buffer.from(source),value});bytes+=source.length;
      }
      return value;
    },
    stats:()=>Object.freeze({entries:entries.size,sourceBytes:bytes,hits,parses,maxEntries,maxBytes}),
  });
}
export const qualificationJsonCache=createQualificationJsonCache();
