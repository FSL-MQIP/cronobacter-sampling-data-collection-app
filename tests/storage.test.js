import { loadSamples, saveSample, deleteSample, clearAllSamples } from '../js/storage.js';

beforeEach(() => localStorage.clear());

const makeSample = (id, type) => ({
  id, type, sampleId: `NY-YJ-1_U_SL`, date: '20/05/2026', time: '10:00',
  collectors: 'YJ', location: '', latitude: null, longitude: null,
  ambientTemp: null, precipitation: false, notes: '',
  waterTemp: null, waterBodyDescription: '',
  surfaceDescription: '', surfaceType: '', surfaceTypeOther: '',
  cracksAndCrevices: null, highTrafficArea: null,
  backupAttempted: false, photosDriveLink: '',
});

test('loadSamples returns empty array initially', () => {
  expect(loadSamples()).toEqual([]);
});

test('saveSample appends new sample', () => {
  saveSample(makeSample('a', 'soil'));
  expect(loadSamples()).toHaveLength(1);
});

test('saveSample overwrites existing sample with same id', () => {
  saveSample(makeSample('a', 'soil'));
  const updated = { ...makeSample('a', 'soil'), notes: 'updated' };
  saveSample(updated);
  const samples = loadSamples();
  expect(samples).toHaveLength(1);
  expect(samples[0].notes).toBe('updated');
});

test('deleteSample removes by id', () => {
  saveSample(makeSample('a', 'soil'));
  saveSample(makeSample('b', 'soil'));
  deleteSample('a');
  const samples = loadSamples();
  expect(samples).toHaveLength(1);
  expect(samples[0].id).toBe('b');
});

test('clearAllSamples empties storage', () => {
  saveSample(makeSample('a', 'soil'));
  clearAllSamples();
  expect(loadSamples()).toEqual([]);
});
