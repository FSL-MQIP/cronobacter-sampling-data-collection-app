import { fetchWeather, fetchHistoricalWeather } from '../js/weather.js';

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

test('fetchHistoricalWeather returns hourly value at sample time', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      hourly: {
        time: ['2026-05-20T12:00', '2026-05-20T13:00', '2026-05-20T14:00'],
        temperature_2m: [20, 22, 25],
        precipitation: [0, 0.5, 0],
      },
    }),
  });
  const result = await fetchHistoricalWeather(42.36, -71.06, '20/05/2026', '13:00');
  expect(result.temperature).toBe(22);
  expect(result.precipitation).toBe(true);
});

test('fetchHistoricalWeather rounds sample time down to the nearest hour', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      hourly: {
        time: ['2026-05-20T13:00', '2026-05-20T14:00'],
        temperature_2m: [22, 25],
        precipitation: [0, 0],
      },
    }),
  });
  const result = await fetchHistoricalWeather(42.36, -71.06, '20/05/2026', '13:45');
  expect(result.temperature).toBe(22);
});

test('fetchHistoricalWeather requests the sample date range from Open-Meteo', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      hourly: { time: ['2026-05-20T13:00'], temperature_2m: [22], precipitation: [0] },
    }),
  });
  await fetchHistoricalWeather(42.36, -71.06, '20/05/2026', '13:00');
  const url = global.fetch.mock.calls[0][0];
  expect(url).toContain('start_date=2026-05-20');
  expect(url).toContain('end_date=2026-05-20');
  expect(url).toContain('hourly=temperature_2m,precipitation');
});

test('fetchHistoricalWeather throws if requested hour is missing from response', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      hourly: { time: ['2026-05-20T13:00'], temperature_2m: [22], precipitation: [0] },
    }),
  });
  await expect(fetchHistoricalWeather(42.36, -71.06, '20/05/2026', '23:00')).rejects.toThrow();
});
