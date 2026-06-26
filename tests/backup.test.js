import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { jest } from '@jest/globals';
import { enqueueBackup, getQueue, dequeue, flushQueue, uploadPhotosToGas, flushUnuploadedPhotos, flushPendingBackfills } from '../js/backup.js';
import { savePhoto, getPhotosForSample, markPhotoUploaded, _resetDbForTests } from '../js/photos-db.js';
import { saveSample, loadSamples } from '../js/storage.js';

beforeEach(() => {
  localStorage.clear();
  global.indexedDB = new IDBFactory();
  _resetDbForTests();
});

test('enqueueBackup adds entry to queue', () => {
  enqueueBackup({ id: 'sample-1', type: 'soil' });
  expect(getQueue()).toHaveLength(1);
});

test('dequeue removes entry by id', () => {
  enqueueBackup({ id: 'sample-1', type: 'soil' });
  enqueueBackup({ id: 'sample-2', type: 'water' });
  dequeue('sample-1');
  const q = getQueue();
  expect(q).toHaveLength(1);
  expect(q[0].id).toBe('sample-2');
});

test('flushQueue posts each entry and clears on success', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, type: 'opaque' });
  enqueueBackup({ id: 'a', type: 'soil' });
  enqueueBackup({ id: 'b', type: 'water' });
  await flushQueue('https://example.com/gas');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(getQueue()).toHaveLength(0);
});

test('flushQueue stops on fetch error and keeps remaining items', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network'));
  enqueueBackup({ id: 'a', type: 'soil' });
  await flushQueue('https://example.com/gas');
  expect(getQueue()).toHaveLength(1);
});

test('uploadPhotosToGas posts photos and returns folderUrl with uploadedIds', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, folderUrl: 'https://drive.google.com/folder/abc' }),
  });
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  const photos = [{ id: 'photo_001', blob, label: '' }];
  const result = await uploadPhotosToGas('https://example.com/gas', 'NY-YJ-1_U_SL', photos, 'Cronobacter/test');
  expect(result.folderUrl).toBe('https://drive.google.com/folder/abc');
  expect(result.uploadedIds).toEqual(['photo_001']);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('uploadPhotosToGas returns empty result when no gasUrl', async () => {
  const result = await uploadPhotosToGas('', 'sample', [], 'path');
  expect(result).toEqual({ folderUrl: null, uploadedIds: [] });
});

test('uploadPhotosToGas skips photos already marked uploaded', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ folderUrl: 'https://drive.google.com/folder/xyz' }),
  });
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  const photos = [
    { id: 'photo_old', blob, label: '', uploaded: true },
    { id: 'photo_new', blob, label: '' },
  ];
  const result = await uploadPhotosToGas('https://example.com/gas', 'sample-1', photos, 'path');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(result.uploadedIds).toEqual(['photo_new']);
});

test('uploadPhotosToGas treats fetch-resolved as success even if response body unreadable (CORS)', async () => {
  // Apps Script web apps redirect to script.googleusercontent.com; the redirected response
  // sometimes blocks body reads even though the upload succeeded on the server.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => { throw new Error('CORS blocked response body'); },
  });
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  const photos = [{ id: 'photo_001', blob, label: '' }];
  const result = await uploadPhotosToGas('https://example.com/gas', 'sample-1', photos, 'path');
  expect(result.uploadedIds).toEqual(['photo_001']);
  expect(result.folderUrl).toBeNull();
});

test('uploadPhotosToGas does not mark uploaded on network failure', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network offline'));
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  const photos = [{ id: 'photo_001', blob, label: '' }];
  const result = await uploadPhotosToGas('https://example.com/gas', 'sample-1', photos, 'path');
  expect(result.uploadedIds).toEqual([]);
  expect(result.folderUrl).toBeNull();
});

test('flushUnuploadedPhotos uploads unuploaded photos, marks them uploaded, and stores folderUrl', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ folderUrl: 'https://drive.google.com/folder/abc' }),
  });
  saveSample({ id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL', date: '21/05/2026', photosDriveLink: '' });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', new Blob(['x'], { type: 'image/jpeg' }), '');

  await flushUnuploadedPhotos('https://gas/', { state: 'NY', initials: 'YJ', mode: 'urban' });

  const photos = await getPhotosForSample('NY-YJ-1_U_SL');
  expect(photos[0].uploaded).toBe(true);
  const sample = loadSamples().find(s => s.id === 'uuid-1');
  expect(sample.photosDriveLink).toBe('https://drive.google.com/folder/abc');
});

test('flushUnuploadedPhotos skips samples whose photos are already uploaded', async () => {
  global.fetch = jest.fn();
  saveSample({ id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL', date: '21/05/2026' });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', new Blob(['x'], { type: 'image/jpeg' }), '');
  await markPhotoUploaded('photo_001');

  await flushUnuploadedPhotos('https://gas/', { state: 'NY', initials: 'YJ', mode: 'urban' });

  expect(global.fetch).not.toHaveBeenCalled();
});

test('flushUnuploadedPhotos preserves existing photosDriveLink', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ folderUrl: 'https://drive.google.com/folder/NEW' }),
  });
  saveSample({
    id: 'uuid-1',
    sampleId: 'NY-YJ-1_U_SL',
    date: '21/05/2026',
    photosDriveLink: 'https://drive.google.com/folder/OLD',
  });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', new Blob(['x'], { type: 'image/jpeg' }), '');

  await flushUnuploadedPhotos('https://gas/', { state: 'NY', initials: 'YJ', mode: 'urban' });

  const sample = loadSamples().find(s => s.id === 'uuid-1');
  expect(sample.photosDriveLink).toBe('https://drive.google.com/folder/OLD');
});

test('flushUnuploadedPhotos derives folderPath from sample.date, not today', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ folderUrl: 'https://drive.google.com/folder/abc' }),
  });
  saveSample({ id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL', date: '15/03/2026' });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', new Blob(['x'], { type: 'image/jpeg' }), '');

  await flushUnuploadedPhotos('https://gas/', { state: 'NY', initials: 'YJ', mode: 'urban' });

  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.folderPath).toBe('Cronobacter Sampling/NY_YJ_URBAN_15-03-2026/NY-YJ-1_U_SL');
});

// ── flushPendingBackfills ──────────────────────────────────────────────────────
function mockBackfillFetch({ location = 'Cornell, Tompkins County, NY, USA', temp = 18.5, precip = 0 } = {}) {
  return jest.fn((url) => {
    if (url.includes('nominatim')) {
      return Promise.resolve({ ok: true, json: async () => ({ display_name: location }) });
    }
    if (url.includes('open-meteo')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          hourly: {
            time: ['2026-05-20T13:00'],
            temperature_2m: [temp],
            precipitation: [precip],
          },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

test('flushPendingBackfills fills missing location and weather from lat/lon', async () => {
  global.fetch = mockBackfillFetch();
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: 42.36, longitude: -71.06,
    location: '', ambientTemp: null, precipitation: false,
  });

  await flushPendingBackfills();

  const updated = loadSamples()[0];
  expect(updated.location).toBe('Cornell, Tompkins County, NY, USA');
  expect(updated.ambientTemp).toBe(18.5);
  expect(updated.precipitation).toBe(false);
});

test('flushPendingBackfills re-enqueues backfilled sample for sheet upsert', async () => {
  global.fetch = mockBackfillFetch();
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: 42.36, longitude: -71.06,
    location: '', ambientTemp: null,
  });

  await flushPendingBackfills();

  const q = getQueue();
  expect(q).toHaveLength(1);
  expect(q[0].id).toBe('uuid-1');
  expect(q[0].action).toBe('upsertRow');
  expect(q[0].location).toBe('Cornell, Tompkins County, NY, USA');
});

test('flushPendingBackfills skips samples that already have location and weather', async () => {
  global.fetch = jest.fn();
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: 42.36, longitude: -71.06,
    location: 'Already here', ambientTemp: 20, precipitation: false,
  });

  await flushPendingBackfills();

  expect(global.fetch).not.toHaveBeenCalled();
  expect(getQueue()).toHaveLength(0);
});

test('flushPendingBackfills skips samples missing lat/lon', async () => {
  global.fetch = jest.fn();
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: null, longitude: null,
    location: '', ambientTemp: null,
  });

  await flushPendingBackfills();

  expect(global.fetch).not.toHaveBeenCalled();
});

test('flushPendingBackfills preserves user-entered ambientTemp', async () => {
  global.fetch = mockBackfillFetch({ temp: 99 });
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: 42.36, longitude: -71.06,
    location: '',
    ambientTemp: 22.0,  // user entered manually
    precipitation: true,
  });

  await flushPendingBackfills();

  const updated = loadSamples()[0];
  expect(updated.ambientTemp).toBe(22.0);
  expect(updated.precipitation).toBe(true);
  expect(updated.location).toBe('Cornell, Tompkins County, NY, USA');
});

test('flushPendingBackfills leaves sample untouched if both APIs fail', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  saveSample({
    id: 'uuid-1', sampleId: 'NY-YJ-1_U_SL',
    date: '20/05/2026', time: '13:00',
    latitude: 42.36, longitude: -71.06,
    location: '', ambientTemp: null,
  });

  await flushPendingBackfills();

  const updated = loadSamples()[0];
  expect(updated.location).toBe('');
  expect(updated.ambientTemp).toBeNull();
  expect(getQueue()).toHaveLength(0);
});
