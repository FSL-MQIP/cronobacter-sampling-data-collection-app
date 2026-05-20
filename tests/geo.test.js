import { jest } from '@jest/globals';
import { reverseGeocode, getCurrentPosition } from '../js/geo.js';

beforeEach(() => {
  global.fetch = jest.fn();
});

test('reverseGeocode returns display_name on success', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ display_name: '123 Main St, New York, NY, USA' }),
  });
  const result = await reverseGeocode(40.7128, -74.006);
  expect(result).toBe('123 Main St, New York, NY, USA');
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('nominatim.openstreetmap.org'),
    expect.any(Object)
  );
});

test('reverseGeocode throws on HTTP error', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 429 });
  await expect(reverseGeocode(0, 0)).rejects.toThrow();
});

test('reverseGeocode returns empty string if no display_name', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  const result = await reverseGeocode(0, 0);
  expect(result).toBe('');
});

test('getCurrentPosition resolves with lat/lon on success', async () => {
  global.navigator.geolocation = {
    getCurrentPosition: (success) => {
      success({ coords: { latitude: 40.7128, longitude: -74.006 } });
    },
  };
  const result = await getCurrentPosition();
  expect(result).toEqual({ lat: 40.7128, lon: -74.006 });
});

test('getCurrentPosition rejects when geolocation not supported', async () => {
  global.navigator.geolocation = undefined;
  await expect(getCurrentPosition()).rejects.toThrow('Geolocation not supported');
});
