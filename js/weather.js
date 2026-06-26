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

// Looks up the weather at the moment a sample was collected. Used for backfill when
// the sample was created offline and the live `fetchWeather` call never happened.
//
// `dmyDate` is "DD/MM/YYYY" (the format we store on the sample); `hhmm` is "HH:MM".
// We ask Open-Meteo for hourly values keyed to that local date in the sample's
// timezone (so the index matches `HH:00` regardless of UTC offset).
export async function fetchHistoricalWeather(lat, lon, dmyDate, hhmm) {
  if (lat == null || lon == null) throw new Error('fetchHistoricalWeather: lat/lon required');
  const [d, m, y] = dmyDate.split('/');
  const iso = `${y}-${m}-${d}`;
  const hour = hhmm.slice(0, 2);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&start_date=${iso}&end_date=${iso}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  const targetPrefix = `${iso}T${hour}:00`;
  const idx = data.hourly.time.findIndex(t => t === targetPrefix);
  if (idx === -1) throw new Error(`Open-Meteo: hour ${hour}:00 not in response`);
  return {
    temperature: data.hourly.temperature_2m[idx],
    precipitation: data.hourly.precipitation[idx] > 0,
  };
}
