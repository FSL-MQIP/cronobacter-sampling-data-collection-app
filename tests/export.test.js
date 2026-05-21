import { samplesToCsv } from '../js/export.js';

const soilSample = {
  id: '1', type: 'soil', sampleId: 'NY-YJ-1_U_SL',
  date: '20/05/2026', time: '10:30', collectors: 'Yeonjin Jung',
  location: '5th Ave, New York', latitude: 40.7128, longitude: -74.006,
  ambientTemp: 22.5, precipitation: false, notes: 'test note',
  waterTemp: null, waterBodyDescription: '',
  surfaceDescription: '', surfaceType: '', surfaceTypeOther: '',
  cracksAndCrevices: null, highTrafficArea: null,
  backupAttempted: true, photosDriveLink: 'https://drive.google.com/folder/abc',
};

test('CSV has correct headers', () => {
  const csv = samplesToCsv([soilSample]);
  const header = csv.split('\r\n')[0];
  expect(header).toBe(
    'SAMPLE-ID,DATE,TIME (24H),COLLECTOR(S),LOCATION,LATITUDE,LONGITUDE,' +
    'NEAR WATER BODY,AMBIENT TEMPERATURE (°C),PRECIPITATION,NOTES,' +
    'WATER TEMPERATURE (°C),WATER BODY DESCRIPTION,' +
    'ENVIRONMENT/SURFACE DESCRIPTION,SURFACE TYPE,SURFACE TYPE (OTHER),' +
    'CRACKS/CREVICES,HIGH TRAFFIC AREA,PHOTOS'
  );
});

test('nearWaterBody formats as "Yes (detail)" / "Yes" / "No" / empty', () => {
  const yesWithDetail = { ...soilSample, nearWaterBody: true, nearWaterBodyDetail: '~50 m from pond' };
  expect(samplesToCsv([yesWithDetail])).toContain('Yes (~50 m from pond)');

  const yesNoDetail = { ...soilSample, nearWaterBody: true, nearWaterBodyDetail: '' };
  expect(samplesToCsv([yesNoDetail])).toMatch(/,Yes,/);

  const no = { ...soilSample, nearWaterBody: false, nearWaterBodyDetail: '' };
  expect(samplesToCsv([no])).toMatch(/,No,/);

  // urban soil leaves it null — column is empty
  expect(samplesToCsv([soilSample])).toMatch(/,,/);
});

test('soil row has correct values and empty swab/water cols', () => {
  const csv = samplesToCsv([soilSample]);
  const row = csv.split('\r\n')[1];
  expect(row).toContain('NY-YJ-1_U_SL');
  expect(row).toContain('No');         // precipitation
  expect(row).toContain('test note');
  expect(row).toContain('https://drive.google.com/folder/abc');
});

test('precipitation Yes/No', () => {
  const wet = { ...soilSample, precipitation: true };
  const csv = samplesToCsv([wet]);
  expect(csv).toContain(',Yes,');
});

test('fields with commas are quoted', () => {
  const s = { ...soilSample, location: 'Building, 5th Ave' };
  const csv = samplesToCsv([s]);
  expect(csv).toContain('"Building, 5th Ave"');
});

test('swab-specific fields appear for swab rows', () => {
  const swab = {
    ...soilSample, type: 'swab', sampleId: 'NY-YJ-1_U_SG',
    surfaceDescription: 'park bench', surfaceType: 'Metal',
    cracksAndCrevices: true, highTrafficArea: false,
  };
  const csv = samplesToCsv([swab]);
  expect(csv).toContain('park bench');
  expect(csv).toContain('Metal');
  expect(csv).toContain(',Yes,');  // cracksAndCrevices
  expect(csv).toContain(',No');    // highTrafficArea
});
