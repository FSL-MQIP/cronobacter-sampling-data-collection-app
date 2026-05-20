export async function fetchWeather(lat, lon) {
  if (lat == null || lon == null) throw new Error('fetchWeather: lat/lon required');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  return {
    temperature: data.current.temperature_2m,
    precipitation: data.current.precipitation > 0,
  };
}
