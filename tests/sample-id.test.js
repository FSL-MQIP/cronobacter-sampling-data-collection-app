import { generateSampleId } from '../js/sample-id.js';

test('generates soil ID', () => {
  expect(generateSampleId('NY', 'YJ', 3, 'soil')).toBe('NY-YJ-3_U_SL');
});

test('generates swab ID', () => {
  expect(generateSampleId('NY', 'YJ', 2, 'swab')).toBe('NY-YJ-2_U_SG');
});

test('generates water ID', () => {
  expect(generateSampleId('TX', 'KH', 1, 'water')).toBe('TX-KH-1_U_W');
});

test('throws on unknown type', () => {
  expect(() => generateSampleId('NY', 'YJ', 1, 'invalid')).toThrow();
});
