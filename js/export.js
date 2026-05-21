const HEADERS = [
  'SAMPLE-ID', 'DATE', 'TIME (24H)', 'COLLECTOR(S)', 'LOCATION',
  'LATITUDE', 'LONGITUDE', 'AMBIENT TEMPERATURE (°C)', 'PRECIPITATION',
  'NOTES', 'WATER TEMPERATURE (°C)', 'WATER BODY DESCRIPTION',
  'ENVIRONMENT/SURFACE DESCRIPTION', 'SURFACE TYPE', 'SURFACE TYPE (OTHER)',
  'CRACKS/CREVICES', 'HIGH TRAFFIC AREA', 'PHOTOS',
];

function csvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

export function samplesToCsv(samples) {
  const rows = [HEADERS.join(',')];
  for (const s of samples) {
    const row = [
      s.sampleId, s.date, s.time, s.collectors, s.location,
      s.latitude ?? '', s.longitude ?? '',
      s.ambientTemp ?? '', s.precipitation ? 'Yes' : 'No',
      s.notes || '',
      s.waterTemp ?? '', s.waterBodyDescription || '',
      s.surfaceDescription || '', s.surfaceType || '', s.surfaceTypeOther || '',
      s.cracksAndCrevices != null ? (s.cracksAndCrevices ? 'Yes' : 'No') : '',
      s.highTrafficArea != null ? (s.highTrafficArea ? 'Yes' : 'No') : '',
      s.photosDriveLink || '',
    ];
    rows.push(row.map(csvField).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Uses no-cors because Apps Script web apps redirect to script.googleusercontent.com,
// and the redirected response often fails CORS even when the server ran successfully.
// We can't read the response body, so a resolved fetch is treated as success; an actual
// network failure (offline, DNS) still rejects and is surfaced to the user.
export async function sendEmail(gasUrl, { toEmail, collectorName, state, initials, date, csvContent }) {
  await fetch(gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'sendEmail',
      toEmail,
      collectorName,
      tripLabel: `${state}-${initials}-${date}`,
      csvContent,
    }),
  });
}
