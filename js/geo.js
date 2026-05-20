export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { timeout: 10000 }
    );
  });
}

export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'CronobacterSamplingApp/1.0 (field-sampling-pwa)',
    },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  return data.display_name || '';
}
