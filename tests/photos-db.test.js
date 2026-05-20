import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { savePhoto, getPhotosForSample, deletePhoto, markPhotoUploaded, clearPhotosForSamples, _resetDbForTests } from '../js/photos-db.js';

beforeEach(() => {
  global.indexedDB = new IDBFactory();
  _resetDbForTests();
});

test('saves and retrieves photo for a sample', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', blob, '');
  const photos = await getPhotosForSample('NY-YJ-1_U_SL');
  expect(photos).toHaveLength(1);
  expect(photos[0].id).toBe('photo_001');
  expect(photos[0].uploaded).toBe(false);
});

test('deletePhoto removes the photo', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-2_U_SG', 'photo_002', blob, '');
  await deletePhoto('photo_002');
  const photos = await getPhotosForSample('NY-YJ-2_U_SG');
  expect(photos).toHaveLength(0);
});

test('markPhotoUploaded sets uploaded flag', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-3_U_W', 'photo_003', blob, '');
  await markPhotoUploaded('photo_003');
  const photos = await getPhotosForSample('NY-YJ-3_U_W');
  expect(photos[0].uploaded).toBe(true);
});

test('clearPhotosForSamples removes all photos for given sample IDs', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('KEEP_ME', 'photo_keep', blob, '');
  await savePhoto('REMOVE_ME', 'photo_del', blob, '');
  await clearPhotosForSamples(['REMOVE_ME']);
  expect(await getPhotosForSample('REMOVE_ME')).toHaveLength(0);
  expect(await getPhotosForSample('KEEP_ME')).toHaveLength(1);
});
