import { generateSampleId } from '../js/sample-id.js';

test('defaults to urban mode', () => {
  expect(generateSampleId('NY', 'YJ', 3, 'soil')).toBe('NY-YJ-3_U_SL');
  expect(generateSampleId('NY', 'YJ', 2, 'swab')).toBe('NY-YJ-2_U_SG');
  expect(generateSampleId('TX', 'KH', 1, 'water')).toBe('TX-KH-1_U_W');
});

test('rural mode uses R prefix', () => {
  expect(generateSampleId('NY', 'YJ', 3, 'soil', 'rural')).toBe('NY-YJ-3_R_SL');
  expect(generateSampleId('TX', 'KH', 1, 'water', 'rural')).toBe('TX-KH-1_R_W');
});

test('natural mode uses N prefix', () => {
  expect(generateSampleId('ME', 'AS', 1, 'soil', 'natural')).toBe('ME-AS-1_N_SL');
  expect(generateSampleId('ME', 'AS', 1, 'water', 'natural')).toBe('ME-AS-1_N_W');
});

test('throws on unknown type', () => {
  expect(() => generateSampleId('NY', 'YJ', 1, 'invalid')).toThrow();
});

test('throws on unknown mode', () => {
  expect(() => generateSampleId('NY', 'YJ', 1, 'soil', 'suburban')).toThrow();
});
