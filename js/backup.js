import { loadSamples, saveSample } from './storage.js';

const QUEUE_KEY = 'cronobacter_backup_queue';

export function getQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function enqueueBackup(entry) {
  const q = getQueue();
  q.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function dequeue(id) {
  const q = getQueue().filter(e => e.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue(gasUrl) {
  if (!gasUrl) return;
  for (const entry of getQueue()) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(entry),
      });
      dequeue(entry.id);
      const sample = loadSamples().find(s => s.id === entry.id);
      if (sample) saveSample({ ...sample, backupAttempted: true });
    } catch {
      break;
    }
  }
}

export function scheduleFlush(gasUrl) {
  if (navigator.onLine) flushQueue(gasUrl);
  window.addEventListener('online', () => flushQueue(gasUrl), { once: true });
}

// Unlike flushQueue which uses no-cors, photo uploads expect the GAS to return
// Access-Control-Allow-Origin: * via ContentService, allowing us to read the folderUrl.
export async function uploadPhotosToGas(gasUrl, sampleId, photos, folderPath) {
  if (!gasUrl || photos.length === 0) return null;
  let folderLink = null;
  for (const photo of photos) {
    try {
      const base64 = await blobToBase64(photo.blob);
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'uploadPhoto',
          sampleId,
          photoId: photo.id,
          filename: `${photo.id}.jpg`,
          mimeType: photo.blob.type || 'image/jpeg',
          data: base64,
          folderPath,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.folderUrl) folderLink = json.folderUrl;
      }
    } catch {
      // CORS blocked or network error — best effort, continue to next photo
    }
  }
  return folderLink;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
