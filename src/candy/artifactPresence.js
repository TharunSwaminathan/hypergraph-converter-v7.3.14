// Tab/analysis-owner data cache. No approvals, requests, jobs or results live here.
export function createArtifactPresenceCache({maxEntries=4,maxBytes=8*1024*1024}={}) {
  const entries=new Map();let bytes=0;
  return Object.freeze({
    clear(){entries.clear();bytes=0;},
    async upload(client,{text,id,mediaType,runtimeSessionId},check) {
      const byteLength=new TextEncoder().encode(text).byteLength;
      const key=JSON.stringify([client.baseUrl,runtimeSessionId,id,mediaType,byteLength]);
      const prior=entries.get(key);
      if(prior && prior.text===text && client.getArtifactMetadata) {
        try {
          const metadata=await client.getArtifactMetadata(id);check();
          if(metadata.id!==id || metadata.mediaType!==mediaType || metadata.byteLength!==byteLength)throw Object.assign(new Error("Artifact presence metadata differs from the exact input bytes."),{code:"RESULT_VALIDATION_FAILURE"});
          entries.delete(key);entries.set(key,prior);return metadata;
        }catch(error){check();if(error.details?.httpStatus!==404)throw error;entries.delete(key);bytes-=prior.byteLength;}
      }
      // Upload exactly the immutable text that was hashed, never the source object.
      const artifact=await client.uploadArtifact({bytes:text,mediaType});check();
      if(artifact.id!==id || artifact.mediaType!==mediaType || artifact.byteLength!==undefined && artifact.byteLength!==byteLength)throw Object.assign(new Error("Uploaded artifact identity differs from the authorized bytes."),{code:"RESULT_VALIDATION_FAILURE"});
      if(byteLength<=maxBytes) {
        const existing=entries.get(key);if(existing){entries.delete(key);bytes-=existing.byteLength;}
        while(entries.size>=maxEntries || bytes+byteLength>maxBytes){const [old,value]=entries.entries().next().value;entries.delete(old);bytes-=value.byteLength;}
        entries.set(key,{text,byteLength});bytes+=byteLength;
      }
      return artifact;
    },
    stats:()=>Object.freeze({entries:entries.size,byteLength:bytes,maxEntries,maxBytes}),
  });
}
