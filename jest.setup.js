import { jest as jestGlobal } from '@jest/globals';

global.jest = jestGlobal;

// Node's native structuredClone (used by fake-indexeddb to persist values) doesn't
// recognize jsdom's Blob, so the blob comes back as {}. Recurse with `.slice()` to
// preserve real Blob instances through the IndexedDB roundtrip.
const cloneWithBlobs = (obj) => {
  if (obj instanceof Blob) return obj.slice(0, obj.size, obj.type);
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const out = {};
    for (const k in obj) out[k] = cloneWithBlobs(obj[k]);
    return out;
  }
  if (Array.isArray(obj)) return obj.map(cloneWithBlobs);
  return obj;
};
global.structuredClone = cloneWithBlobs;
