import { loadSamples, saveSample } from './storage.js';
import { getPhotosForSample, markPhotoUploaded } from './photos-db.js';
import { reverseGeocode } from './geo.js';
import { fetchHistoricalWeather } from './weather.js';

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

export function scheduleFlush(gasUrl, session) {
  const run = async () => {
    // Backfill first so the upserted row carries the freshly-fetched location/weather.
    await flushPendingBackfills();
    await flushQueue(gasUrl);
    await flushUnuploadedPhotos(gasUrl, session);
  };
  if (navigator.onLine) run();
  window.addEventListener('online', run, { once: true });
}

// Returns { folderUrl, uploadedIds }.
//
// We treat a resolved fetch as upload success even if `res.json()` throws — Apps Script
// web apps redirect to script.googleusercontent.com, and the redirected response sometimes
// blocks body reads even though the server-side write succeeded. Marking the photo uploaded
// in that case prevents re-uploads (and duplicate Drive files) on the next save. A genuine
// network failure rejects fetch and the photo stays unuploaded for retry.
export async function uploadPhotosToGas(gasUrl, sampleId, photos, folderPath) {
  if (!gasUrl || photos.length === 0) return { folderUrl: null, uploadedIds: [] };
  let folderLink = null;
  const uploadedIds = [];
  for (const photo of photos) {
    if (photo.uploaded) continue;
    let fetchResolved = false;
    let res = null;
    try {
      const base64 = await blobToBase64(photo.blob);
      res = await fetch(gasUrl, {
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
      fetchResolved = true;
    } catch {
      // network failure — leave photo unuploaded so the next online retry picks it up
    }
    if (fetchResolved) {
      uploadedIds.push(photo.id);
      try {
        const json = await res.json();
        if (json.folderUrl) folderLink = json.folderUrl;
      } catch {
        // body unreadable (CORS redirect) — upload still succeeded server-side
      }
    }
  }
  return { folderUrl: folderLink, uploadedIds };
}

export function buildPhotoFolderPath(session, sample) {
  const modeUpper = (session.mode || 'urban').toUpperCase();
  const dateForFolder = (sample.date || '').replace(/\//g, '-');
  return `Cronobacter Sampling/${session.state}_${session.initials}_${modeUpper}_${dateForFolder}/${sample.sampleId}`;
}

export async function flushUnuploadedPhotos(gasUrl, session) {
  if (!gasUrl || !session) return;
  for (const sample of loadSamples()) {
    if (!sample.sampleId) continue;
    const all = await getPhotosForSample(sample.sampleId);
    const pending = all.filter(p => !p.uploaded);
    if (pending.length === 0) continue;
    const folderPath = buildPhotoFolderPath(session, sample);
    const { folderUrl, uploadedIds } = await uploadPhotosToGas(gasUrl, sample.sampleId, pending, folderPath);
    for (const id of uploadedIds) await markPhotoUploaded(id);
    if (folderUrl && !sample.photosDriveLink) {
      saveSample({ ...sample, photosDriveLink: folderUrl });
    }
  }
}

// Samples saved while offline carry lat/lon (from device GPS) but typically no
// reverse-geocoded location and no weather. When the device is online we look those
// up from the sample's coordinates and timestamp, then re-enqueue the row so the
// sheet upsert carries the new fields.
//
// Triggers are gated on "field looks unfetched": empty `location`, or `ambientTemp == null`.
// A non-null `ambientTemp` means either a successful prior fetch or the user typed a value
// — either way we leave both the temperature and the user's `precipitation` setting alone.
export async function flushPendingBackfills() {
  for (const sample of loadSamples()) {
    if (sample.latitude == null || sample.longitude == null) continue;
    const needsLocation = !sample.location;
    const needsWeather = sample.ambientTemp == null;
    if (!needsLocation && !needsWeather) continue;

    let updated = { ...sample };
    let changed = false;

    if (needsLocation) {
      try {
        const location = await reverseGeocode(sample.latitude, sample.longitude);
        if (location) { updated.location = location; changed = true; }
      } catch { /* leave blank, retry next online event */ }
    }

    if (needsWeather && sample.date && sample.time) {
      try {
        const { temperature, precipitation } = await fetchHistoricalWeather(
          sample.latitude, sample.longitude, sample.date, sample.time
        );
        updated.ambientTemp = temperature;
        updated.precipitation = precipitation;
        changed = true;
      } catch { /* leave null, retry next online event */ }
    }

    if (changed) {
      saveSample(updated);
      enqueueBackup({ ...updated, action: 'upsertRow' });
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
