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
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
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
  return rows.join('\r\n');
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

export async function sendEmail(publicKey, serviceId, templateId, { toEmail, collectorName, state, initials, date, csvContent }) {
  await emailjs.send(serviceId, templateId, {
    to_email: toEmail,
    collector_name: collectorName,
    trip_label: `${state}-${initials}-${date}`,
    csv_content: csvContent,
  }, { publicKey });
}
