import { fetchWeather } from '../js/weather.js';

beforeEach(() => { global.fetch = jest.fn(); });

test('returns temperature and precipitation=false when 0mm', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      current: { temperature_2m: 22.5, precipitation: 0 },
    }),
  });
  const result = await fetchWeather(40.7, -74.0);
  expect(result).toEqual({ temperature: 22.5, precipitation: false });
});

test('returns precipitation=true when precipitation > 0', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      current: { temperature_2m: 18.0, precipitation: 1.2 },
    }),
  });
  const result = await fetchWeather(40.7, -74.0);
  expect(result.precipitation).toBe(true);
});

test('throws on HTTP error', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 500 });
  await expect(fetchWeather(0, 0)).rejects.toThrow();
});
