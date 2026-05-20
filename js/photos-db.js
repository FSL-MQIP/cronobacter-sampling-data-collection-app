const DB_NAME = 'cronobacter_photos';
const STORE = 'photos';
let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

export async function savePhoto(sampleId, photoId, blob, label) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: photoId, sampleId, blob, label, uploaded: false });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

export async function getPhotosForSample(sampleId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.filter(p => p.sampleId === sampleId));
    req.onerror = e => reject(e.target.error);
  });
}

export async function deletePhoto(photoId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(photoId);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

export async function markPhotoUploaded(photoId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(photoId);
    req.onsuccess = () => {
      const photo = req.result;
      if (photo) { photo.uploaded = true; store.put(photo); }
      tx.oncomplete = resolve;
    };
    tx.onerror = e => reject(e.target.error);
  });
}

export async function clearPhotosForSamples(sampleIds) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      req.result.filter(p => sampleIds.includes(p.sampleId)).forEach(p => store.delete(p.id));
      tx.oncomplete = resolve;
    };
    tx.onerror = e => reject(e.target.error);
  });
}
