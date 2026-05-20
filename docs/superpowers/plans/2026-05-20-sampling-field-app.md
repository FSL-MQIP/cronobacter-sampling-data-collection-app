# Cronobacter Sampling Field App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that replaces paper datasheets for Cronobacter field sampling, with offline persistence, GPS/weather auto-fill, photo capture, silent GAS backup, and CSV email export.

**Architecture:** Single-page app with three views (session setup, sample list, sample form) shown/hidden via CSS. All JS is ES modules loaded via `<script type="module">`. No build step — files are served statically and cached by a service worker. Tests run via Jest + jsdom (dev-only, not part of the app bundle).

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), localStorage + IndexedDB, Browser Geolocation API, Nominatim, Open-Meteo, Web Speech API, Google Apps Script, EmailJS, GitHub Pages or Netlify.

---

## File Structure

```
/
├── index.html           # App shell: all three views, EmailJS script tag
├── manifest.json        # PWA manifest (name, icons, display: standalone)
├── sw.js                # Service worker: cache-first offline strategy
├── css/
│   └── styles.css       # Mobile-first styles
├── js/
│   ├── app.js           # Entry point: view routing, event wiring, init
│   ├── sample-id.js     # Pure fn: generate sample ID string
│   ├── session.js       # Session read/write (localStorage), derive initials
│   ├── storage.js       # Sample CRUD (localStorage)
│   ├── geo.js           # GPS + Nominatim reverse geocoding
│   ├── weather.js       # Open-Meteo fetch → { temperature, precipitation }
│   ├── voice.js         # Web Speech API wrapper
│   ├── photos-db.js     # IndexedDB CRUD for photo blobs
│   ├── photos-ui.js     # Photo capture button + thumbnail grid UI
│   ├── backup.js        # GAS POST + offline queue
│   └── export.js        # samplesToCsv() + downloadCsv() + EmailJS send
├── package.json         # Jest dev deps only
├── jest.config.js       # Jest + jsdom config
└── tests/
    ├── sample-id.test.js
    ├── session.test.js
    ├── storage.test.js
    ├── geo.test.js
    ├── weather.test.js
    ├── photos-db.test.js
    ├── backup.test.js
    └── export.test.js
```

---

## Data Models

**Sample** (stored in localStorage as JSON array under key `cronobacter_samples`):
```js
{
  id: string,                  // crypto.randomUUID()
  type: 'soil' | 'swab' | 'water',
  sampleId: string,            // e.g. 'NY-YJ-3_U_SL'
  date: string,                // 'dd/mm/yyyy'
  time: string,                // 'HH:MM' 24h
  collectors: string,
  location: string,
  latitude: number | null,
  longitude: number | null,
  ambientTemp: number | null,
  precipitation: boolean,
  notes: string,
  waterTemp: number | null,         // water only
  waterBodyDescription: string,     // water only
  surfaceDescription: string,       // swab only
  surfaceType: string,              // swab only
  surfaceTypeOther: string,         // swab only
  cracksAndCrevices: boolean | null,// swab only
  highTrafficArea: boolean | null,  // swab only
  backupAttempted: boolean,
  photosDriveLink: string,
}
```

**Session** (stored under key `cronobacter_session`):
```js
{
  collectorName: string,
  initials: string,
  state: string,
  labEmail: string,   // default: 'kah357@cornell.edu'
  gasUrl: string,
  startingSoil: number,
  startingSwab: number,
  startingWater: number,
  nextSoil: number,
  nextSwab: number,
  nextWater: number,
}
```

**Photo** (IndexedDB, store name `photos`):
```js
{
  id: string,         // `${sampleId}_${Date.now()}`
  sampleId: string,
  blob: Blob,
  label: string,      // optional, swab only
  uploaded: boolean,
}
```

---

## Task 1: Project scaffold + testing setup

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `sw.js`
- Create: `css/styles.css`
- Create: `package.json`
- Create: `jest.config.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `jest.config.js`**

```js
export default {
  testEnvironment: 'jsdom',
  transform: {},
};
```

- [ ] **Step 3: Install dev deps**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "name": "Cronobacter Sampling",
  "short_name": "CronoSample",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2d6a4f",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Note: add any 192×512 PNG as `icon-192.png` and `icon-512.png` in the root (placeholder images are fine initially).

- [ ] **Step 5: Create `sw.js`**

```js
const CACHE = 'crono-v1';
const SHELL = [
  '/', '/index.html', '/css/styles.css',
  '/js/app.js', '/js/sample-id.js', '/js/session.js', '/js/storage.js',
  '/js/geo.js', '/js/weather.js', '/js/voice.js',
  '/js/photos-db.js', '/js/photos-ui.js', '/js/backup.js', '/js/export.js',
  '/manifest.json',
];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
);

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
```

- [ ] **Step 6: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cronobacter Sampling</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>

  <!-- View: Session Setup -->
  <div id="view-session" class="view">
    <h1>Session Setup</h1>
    <form id="session-form">
      <label>Collector full name
        <input type="text" id="collectorName" required>
      </label>
      <label>Initials
        <input type="text" id="initials" required maxlength="6">
      </label>
      <label>State (2-letter code)
        <input type="text" id="state" required maxlength="2">
      </label>
      <label>Lab email
        <input type="email" id="labEmail" value="kah357@cornell.edu" required>
      </label>
      <label>GAS Script URL
        <input type="url" id="gasUrl" placeholder="https://script.google.com/macros/s/...">
      </label>
      <label>Starting # — Soil
        <input type="number" id="startingSoil" value="1" min="1" required>
      </label>
      <label>Starting # — Swab
        <input type="number" id="startingSwab" value="1" min="1" required>
      </label>
      <label>Starting # — Water
        <input type="number" id="startingWater" value="1" min="1" required>
      </label>
      <button type="submit">Start Session</button>
    </form>
  </div>

  <!-- View: Sample List -->
  <div id="view-list" class="view hidden">
    <h1>Samples</h1>
    <div id="sample-list"></div>
    <button id="btn-new-sample">+ New Sample</button>
    <hr>
    <button id="btn-download-csv">Download CSV</button>
    <button id="btn-send-email" disabled>Send to Lab</button>
    <button id="btn-clear-session" class="danger hidden">Clear Session</button>
    <button id="btn-edit-session">Edit Session Setup</button>
  </div>

  <!-- View: Sample Form -->
  <div id="view-form" class="view hidden">
    <h1 id="form-title">New Sample</h1>
    <!-- Type selector (shown only for new samples) -->
    <div id="type-selector">
      <button class="type-btn" data-type="soil">Soil</button>
      <button class="type-btn" data-type="swab">Swab</button>
      <button class="type-btn" data-type="water">Water</button>
    </div>
    <!-- Shared fields -->
    <form id="sample-form" class="hidden">
      <p><strong>Sample ID:</strong> <span id="display-sample-id"></span></p>
      <label>Date <input type="date" id="f-date" required></label>
      <label>Time (24h) <input type="time" id="f-time" required></label>
      <label>Collector(s) <input type="text" id="f-collectors" required></label>
      <label>Location <input type="text" id="f-location"></label>
      <label>Latitude <input type="number" id="f-lat" step="any"></label>
      <label>Longitude <input type="number" id="f-lon" step="any"></label>
      <label>Ambient temp (°C) <input type="number" id="f-ambientTemp" step="0.1"></label>
      <label>Precipitation
        <select id="f-precipitation">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </label>
      <label>Notes
        <textarea id="f-notes"></textarea>
        <button type="button" class="mic-btn" data-target="f-notes">🎤</button>
      </label>

      <!-- Water-only fields -->
      <div id="water-fields" class="hidden">
        <label>Water temp (°C) <input type="number" id="f-waterTemp" step="0.1"></label>
        <label>Water body description
          <textarea id="f-waterBodyDescription"></textarea>
          <button type="button" class="mic-btn" data-target="f-waterBodyDescription">🎤</button>
        </label>
      </div>

      <!-- Swab-only fields -->
      <div id="swab-fields" class="hidden">
        <label>Environment/surface description
          <textarea id="f-surfaceDescription"></textarea>
          <button type="button" class="mic-btn" data-target="f-surfaceDescription">🎤</button>
        </label>
        <label>Surface type
          <select id="f-surfaceType">
            <option value="">-- select --</option>
            <option value="Metal">Metal</option>
            <option value="Brick">Brick</option>
            <option value="Wood">Wood</option>
            <option value="Concrete">Concrete</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <div id="surface-type-other-wrap" class="hidden">
          <label>Specify surface type
            <input type="text" id="f-surfaceTypeOther">
          </label>
        </div>
        <label>Cracks/crevices
          <select id="f-cracksAndCrevices">
            <option value="">-- select --</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label>High traffic area
          <select id="f-highTrafficArea">
            <option value="">-- select --</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <!-- Photos -->
      <div id="photos-section">
        <h3>Photos</h3>
        <!-- Swab-only suggested labels injected here by photos-ui.js -->
        <div id="swab-photo-labels" class="hidden">
          <button type="button" class="label-btn" data-label="Surface being swabbed">Surface being swabbed</button>
          <button type="button" class="label-btn" data-label="Surrounding environment">Surrounding environment</button>
          <button type="button" class="label-btn" data-label="Labeled sample bag">Labeled sample bag</button>
        </div>
        <button type="button" id="btn-add-photo">Add Photo</button>
        <input type="file" id="photo-input" accept="image/*" capture="environment" multiple class="hidden">
        <div id="photo-thumbnails"></div>
      </div>

      <button type="submit" id="btn-save-sample">Save Sample</button>
      <button type="button" id="btn-cancel-form">Cancel</button>
    </form>
  </div>

  <script type="module" src="/js/app.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
</body>
</html>
```

- [ ] **Step 7: Create `css/styles.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  background: #f5f5f5;
  color: #222;
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

h1 { font-size: 1.4rem; margin-bottom: 1rem; color: #2d6a4f; }
h3 { font-size: 1rem; margin: 1rem 0 0.5rem; }

.hidden { display: none !important; }
.view { padding-bottom: 2rem; }

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
}

input, textarea, select {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
  background: #fff;
}

textarea { min-height: 70px; resize: vertical; }

button {
  display: inline-block;
  padding: 0.7rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: #2d6a4f;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  margin: 0.25rem 0.25rem 0.25rem 0;
}

button:disabled { background: #aaa; cursor: default; }
button.danger { background: #c0392b; }
button.secondary { background: #555; }
button.type-btn { background: #e0e0e0; color: #222; font-size: 1.1rem; padding: 1rem 1.5rem; }
button.type-btn.active { background: #2d6a4f; color: #fff; }
button.mic-btn { background: none; color: #2d6a4f; border: 1px solid #2d6a4f; padding: 0.4rem 0.7rem; font-size: 0.85rem; margin-top: 0.25rem; }
button.label-btn { background: #e8f4f0; color: #2d6a4f; border: 1px solid #2d6a4f; font-size: 0.85rem; padding: 0.4rem 0.7rem; }

#type-selector { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }

.sample-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
}
.sample-card:hover { border-color: #2d6a4f; }
.sample-card .sample-id { font-weight: 700; color: #2d6a4f; }
.sample-card .sample-meta { font-size: 0.8rem; color: #666; margin-top: 0.25rem; }
.sample-card .backup-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; }
.sample-card .backup-dot.sent { background: #27ae60; }
.sample-card .backup-dot.pending { background: #e67e22; }

#photo-thumbnails { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.thumb-wrap { position: relative; width: 80px; height: 80px; }
.thumb-wrap img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.thumb-wrap .delete-photo { position: absolute; top: -4px; right: -4px; background: #c0392b; color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; }

#btn-new-sample { font-size: 1.1rem; width: 100%; margin-bottom: 1rem; }

.status-msg { padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; }
.status-msg.success { background: #d4edda; color: #155724; }
.status-msg.error { background: #f8d7da; color: #721c24; }
```

- [ ] **Step 8: Commit scaffold**

```bash
git init
git add index.html manifest.json sw.js css/styles.css package.json jest.config.js
git commit -m "feat: project scaffold, PWA shell, testing setup"
```

---

## Task 2: Sample ID generation (TDD)

**Files:**
- Create: `js/sample-id.js`
- Create: `tests/sample-id.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sample-id.test.js`:
```js
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
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/sample-id.test.js
```
Expected: FAIL — "Cannot find module '../js/sample-id.js'"

- [ ] **Step 3: Implement `js/sample-id.js`**

```js
const TYPE_CODES = { soil: 'U_SL', swab: 'U_SG', water: 'U_W' };

export function generateSampleId(state, initials, number, type) {
  const code = TYPE_CODES[type];
  if (!code) throw new Error(`Unknown sample type: ${type}`);
  return `${state}-${initials}-${number}_${code}`;
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/sample-id.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/sample-id.js tests/sample-id.test.js
git commit -m "feat: sample ID generation with tests"
```

---

## Task 3: Session storage module (TDD)

**Files:**
- Create: `js/session.js`
- Create: `tests/session.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/session.test.js`:
```js
import { deriveInitials, saveSession, getSession, updateCounters, getNextNumber } from '../js/session.js';

beforeEach(() => localStorage.clear());

test('deriveInitials from full name', () => {
  expect(deriveInitials('Yeonjin Jung')).toBe('YJ');
  expect(deriveInitials('Katherine Hartmann')).toBe('KH');
  expect(deriveInitials('Mary Jane Watson')).toBe('MJW');
});

test('saves and retrieves session', () => {
  const session = { collectorName: 'Yeonjin Jung', initials: 'YJ', state: 'NY', labEmail: 'kah357@cornell.edu', gasUrl: '', startingSoil: 1, startingSwab: 1, startingWater: 1, nextSoil: 1, nextSwab: 1, nextWater: 1 };
  saveSession(session);
  expect(getSession()).toEqual(session);
});

test('getSession returns null when nothing saved', () => {
  expect(getSession()).toBeNull();
});

test('getNextNumber returns correct counter and increments', () => {
  const session = { nextSoil: 3, nextSwab: 1, nextWater: 2, collectorName: '', initials: '', state: '', labEmail: '', gasUrl: '', startingSoil: 1, startingSwab: 1, startingWater: 1 };
  saveSession(session);
  expect(getNextNumber('soil')).toBe(3);
  expect(getSession().nextSoil).toBe(4);
  expect(getNextNumber('water')).toBe(2);
  expect(getSession().nextWater).toBe(3);
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/session.test.js
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `js/session.js`**

```js
const KEY = 'cronobacter_session';

export function deriveInitials(fullName) {
  return fullName.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('');
}

export function getSession() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function getNextNumber(type) {
  const session = getSession();
  const counterKey = type === 'soil' ? 'nextSoil' : type === 'swab' ? 'nextSwab' : 'nextWater';
  const num = session[counterKey];
  session[counterKey] = num + 1;
  saveSession(session);
  return num;
}

export function clearSamplesFromSession() {
  const session = getSession();
  if (!session) return;
  session.nextSoil = session.startingSoil;
  session.nextSwab = session.startingSwab;
  session.nextWater = session.startingWater;
  saveSession(session);
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/session.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/session.js tests/session.test.js
git commit -m "feat: session storage module with tests"
```

---

## Task 4: Sample data storage module (TDD)

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/storage.test.js`:
```js
import { loadSamples, saveSample, deleteSample, clearAllSamples } from '../js/storage.js';

beforeEach(() => localStorage.clear());

const makeSample = (id, type) => ({
  id, type, sampleId: `NY-YJ-1_U_SL`, date: '20/05/2026', time: '10:00',
  collectors: 'YJ', location: '', latitude: null, longitude: null,
  ambientTemp: null, precipitation: false, notes: '',
  waterTemp: null, waterBodyDescription: '',
  surfaceDescription: '', surfaceType: '', surfaceTypeOther: '',
  cracksAndCrevices: null, highTrafficArea: null,
  backupAttempted: false, photosDriveLink: '',
});

test('loadSamples returns empty array initially', () => {
  expect(loadSamples()).toEqual([]);
});

test('saveSample appends new sample', () => {
  saveSample(makeSample('a', 'soil'));
  expect(loadSamples()).toHaveLength(1);
});

test('saveSample overwrites existing sample with same id', () => {
  saveSample(makeSample('a', 'soil'));
  const updated = { ...makeSample('a', 'soil'), notes: 'updated' };
  saveSample(updated);
  const samples = loadSamples();
  expect(samples).toHaveLength(1);
  expect(samples[0].notes).toBe('updated');
});

test('deleteSample removes by id', () => {
  saveSample(makeSample('a', 'soil'));
  saveSample(makeSample('b', 'soil'));
  deleteSample('a');
  const samples = loadSamples();
  expect(samples).toHaveLength(1);
  expect(samples[0].id).toBe('b');
});

test('clearAllSamples empties storage', () => {
  saveSample(makeSample('a', 'soil'));
  clearAllSamples();
  expect(loadSamples()).toEqual([]);
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/storage.test.js
```

- [ ] **Step 3: Implement `js/storage.js`**

```js
const KEY = 'cronobacter_samples';

export function loadSamples() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSample(sample) {
  const samples = loadSamples();
  const idx = samples.findIndex(s => s.id === sample.id);
  if (idx >= 0) samples[idx] = sample;
  else samples.push(sample);
  localStorage.setItem(KEY, JSON.stringify(samples));
}

export function deleteSample(id) {
  const samples = loadSamples().filter(s => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(samples));
}

export function clearAllSamples() {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/storage.test.js
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: sample localStorage CRUD with tests"
```

---

## Task 5: GPS + reverse geocoding module (TDD)

**Files:**
- Create: `js/geo.js`
- Create: `tests/geo.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/geo.test.js`:
```js
import { reverseGeocode } from '../js/geo.js';

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
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/geo.test.js
```

- [ ] **Step 3: Implement `js/geo.js`**

```js
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
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  return data.display_name || '';
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/geo.test.js
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/geo.js tests/geo.test.js
git commit -m "feat: GPS and reverse geocoding module with tests"
```

---

## Task 6: Weather module (TDD)

**Files:**
- Create: `js/weather.js`
- Create: `tests/weather.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/weather.test.js`:
```js
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
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/weather.test.js
```

- [ ] **Step 3: Implement `js/weather.js`**

```js
export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();
  return {
    temperature: data.current.temperature_2m,
    precipitation: data.current.precipitation > 0,
  };
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/weather.test.js
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/weather.js tests/weather.test.js
git commit -m "feat: weather module with tests"
```

---

## Task 7: Photo storage — IndexedDB (TDD)

**Files:**
- Create: `js/photos-db.js`
- Create: `tests/photos-db.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/photos-db.test.js`:
```js
import 'fake-indexeddb/auto';
import { savePhoto, getPhotosForSample, deletePhoto, markPhotoUploaded, clearPhotosForSamples } from '../js/photos-db.js';

test('saves and retrieves photo for a sample', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-1_U_SL', 'photo_001', blob, '');
  const photos = await getPhotosForSample('NY-YJ-1_U_SL');
  expect(photos).toHaveLength(1);
  expect(photos[0].id).toBe('photo_001');
  expect(photos[0].uploaded).toBe(false);
});

test('deletePhoto removes the photo', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-2_U_SG', 'photo_002', blob, '');
  await deletePhoto('photo_002');
  const photos = await getPhotosForSample('NY-YJ-2_U_SG');
  expect(photos).toHaveLength(0);
});

test('markPhotoUploaded sets uploaded flag', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('NY-YJ-3_U_W', 'photo_003', blob, '');
  await markPhotoUploaded('photo_003');
  const photos = await getPhotosForSample('NY-YJ-3_U_W');
  expect(photos[0].uploaded).toBe(true);
});

test('clearPhotosForSamples removes all photos for given sample IDs', async () => {
  const blob = new Blob(['fake'], { type: 'image/jpeg' });
  await savePhoto('KEEP_ME', 'photo_keep', blob, '');
  await savePhoto('REMOVE_ME', 'photo_del', blob, '');
  await clearPhotosForSamples(['REMOVE_ME']);
  expect(await getPhotosForSample('REMOVE_ME')).toHaveLength(0);
  expect(await getPhotosForSample('KEEP_ME')).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/photos-db.test.js
```

- [ ] **Step 3: Implement `js/photos-db.js`**

```js
const DB_NAME = 'cronobacter_photos';
const STORE = 'photos';
let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

export async function savePhoto(sampleId, photoId, blob, label) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: photoId, sampleId, blob, label, uploaded: false });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

export async function getPhotosForSample(sampleId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.filter(p => p.sampleId === sampleId));
    req.onerror = e => reject(e.target.error);
  });
}

export async function deletePhoto(photoId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(photoId);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

export async function markPhotoUploaded(photoId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(photoId);
    req.onsuccess = () => {
      const photo = req.result;
      if (photo) { photo.uploaded = true; store.put(photo); }
      tx.oncomplete = resolve;
    };
    tx.onerror = e => reject(e.target.error);
  });
}

export async function clearPhotosForSamples(sampleIds) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      req.result.filter(p => sampleIds.includes(p.sampleId)).forEach(p => store.delete(p.id));
      tx.oncomplete = resolve;
    };
    tx.onerror = e => reject(e.target.error);
  });
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/photos-db.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/photos-db.js tests/photos-db.test.js
git commit -m "feat: photo IndexedDB storage with tests"
```

---

## Task 8: Background backup module (TDD)

**Files:**
- Create: `js/backup.js`
- Create: `tests/backup.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/backup.test.js`:
```js
import { enqueueBackup, getQueue, dequeue, flushQueue } from '../js/backup.js';

beforeEach(() => localStorage.clear());

test('enqueueBackup adds entry to queue', () => {
  enqueueBackup({ id: 'sample-1', type: 'soil' });
  expect(getQueue()).toHaveLength(1);
});

test('dequeue removes entry by id', () => {
  enqueueBackup({ id: 'sample-1', type: 'soil' });
  enqueueBackup({ id: 'sample-2', type: 'water' });
  dequeue('sample-1');
  const q = getQueue();
  expect(q).toHaveLength(1);
  expect(q[0].id).toBe('sample-2');
});

test('flushQueue posts each entry and clears on success', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, type: 'opaque' });
  enqueueBackup({ id: 'a', type: 'soil' });
  enqueueBackup({ id: 'b', type: 'water' });
  await flushQueue('https://example.com/gas');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(getQueue()).toHaveLength(0);
});

test('flushQueue stops on fetch error and keeps remaining items', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('network'));
  enqueueBackup({ id: 'a', type: 'soil' });
  await flushQueue('https://example.com/gas');
  expect(getQueue()).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/backup.test.js
```

- [ ] **Step 3: Implement `js/backup.js`**

Note: GAS web apps don't support CORS, so fetch uses `mode: 'no-cors'`. The response is always
opaque (status 0). We treat any resolved fetch as success and log errors on network failure.

```js
const QUEUE_KEY = 'cronobacter_backup_queue';

export function getQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function enqueueBackup(entry) {
  const q = getQueue();
  q.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function dequeue(id) {
  const q = getQueue().filter(e => e.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue(gasUrl) {
  if (!gasUrl) return;
  for (const entry of getQueue()) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      dequeue(entry.id);
    } catch {
      break;
    }
  }
}

export function scheduleFlush(gasUrl) {
  if (navigator.onLine) flushQueue(gasUrl);
  window.addEventListener('online', () => flushQueue(gasUrl), { once: true });
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/backup.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/backup.js tests/backup.test.js
git commit -m "feat: GAS backup queue with tests"
```

---

## Task 9: CSV export module (TDD)

**Files:**
- Create: `js/export.js`
- Create: `tests/export.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/export.test.js`:
```js
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
    'AMBIENT TEMPERATURE (°C),PRECIPITATION,NOTES,' +
    'WATER TEMPERATURE (°C),WATER BODY DESCRIPTION,' +
    'ENVIRONMENT/SURFACE DESCRIPTION,SURFACE TYPE,SURFACE TYPE (OTHER),' +
    'CRACKS/CREVICES,HIGH TRAFFIC AREA,PHOTOS'
  );
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
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- tests/export.test.js
```

- [ ] **Step 3: Implement `js/export.js`**

```js
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
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- tests/export.test.js
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/export.js tests/export.test.js
git commit -m "feat: CSV export module with tests"
```

---

## Task 10: Voice input module

**Files:**
- Create: `js/voice.js`

No unit tests (browser API; tested manually in Task 18).

- [ ] **Step 1: Implement `js/voice.js`**

```js
export function attachVoiceButton(micBtn, targetId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  let recognition = null;
  let recording = false;

  micBtn.addEventListener('click', () => {
    if (recording) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      recording = true;
      micBtn.textContent = '⏹ Stop';
    };
    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      const field = document.getElementById(targetId);
      if (field) field.value += (field.value ? ' ' : '') + transcript;
    };
    recognition.onend = () => {
      recording = false;
      micBtn.textContent = '🎤';
    };
    recognition.onerror = () => {
      recording = false;
      micBtn.textContent = '🎤';
    };
    recognition.start();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/voice.js
git commit -m "feat: voice input module"
```

---

## Task 11: Photo capture UI module

**Files:**
- Create: `js/photos-ui.js`

- [ ] **Step 1: Implement `js/photos-ui.js`**

```js
import { savePhoto, getPhotosForSample, deletePhoto } from './photos-db.js';

let _pendingPhotos = [];   // { id, blob, label, objectUrl } — held in memory until form saved
let _pendingLabel = '';    // label set by tapping a label-btn before Add Photo

export function initPhotosUI(sampleId, isSwab) {
  _pendingPhotos = [];
  _pendingLabel = '';

  const addBtn = document.getElementById('btn-add-photo');
  const fileInput = document.getElementById('photo-input');
  const labelWrap = document.getElementById('swab-photo-labels');
  const thumbsDiv = document.getElementById('photo-thumbnails');

  thumbsDiv.innerHTML = '';
  labelWrap.classList.toggle('hidden', !isSwab);

  // Load existing photos for edit mode
  if (sampleId) {
    getPhotosForSample(sampleId).then(photos => {
      photos.forEach(p => {
        const url = URL.createObjectURL(p.blob);
        _pendingPhotos.push({ id: p.id, blob: p.blob, label: p.label, objectUrl: url, existing: true });
        addThumb(thumbsDiv, p.id, url, p.label);
      });
    });
  }

  // Label shortcuts (swab only)
  document.querySelectorAll('.label-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _pendingLabel = btn.dataset.label;
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 1000);
      fileInput.click();
    });
  });

  addBtn.addEventListener('click', () => {
    _pendingLabel = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(file => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = URL.createObjectURL(file);
      _pendingPhotos.push({ id, blob: file, label: _pendingLabel, objectUrl: url });
      addThumb(thumbsDiv, id, url, _pendingLabel);
    });
    fileInput.value = '';
  });
}

function addThumb(container, id, url, label) {
  const wrap = document.createElement('div');
  wrap.className = 'thumb-wrap';
  wrap.dataset.photoId = id;
  const img = document.createElement('img');
  img.src = url;
  img.alt = label || 'photo';
  const del = document.createElement('button');
  del.className = 'delete-photo';
  del.textContent = '×';
  del.addEventListener('click', () => {
    _pendingPhotos = _pendingPhotos.filter(p => p.id !== id);
    deletePhoto(id).catch(() => {});
    wrap.remove();
  });
  wrap.appendChild(img);
  wrap.appendChild(del);
  container.appendChild(wrap);
}

export async function persistPendingPhotos(sampleId) {
  for (const p of _pendingPhotos) {
    await savePhoto(sampleId, p.id, p.blob, p.label);
  }
  _pendingPhotos = [];
}

export function getPendingPhotoCount() {
  return _pendingPhotos.length;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/photos-ui.js
git commit -m "feat: photo capture UI module"
```

---

## Task 12: App entry point — session setup + routing

**Files:**
- Create: `js/app.js`

- [ ] **Step 1: Implement `js/app.js`** (session setup + view routing)

```js
import { getSession, saveSession, deriveInitials, getNextNumber, clearSamplesFromSession } from './session.js';
import { generateSampleId } from './sample-id.js';
import { loadSamples, saveSample, clearAllSamples } from './storage.js';
import { getCurrentPosition, reverseGeocode } from './geo.js';
import { fetchWeather } from './weather.js';
import { attachVoiceButton } from './voice.js';
import { initPhotosUI, persistPendingPhotos } from './photos-ui.js';
import { enqueueBackup, scheduleFlush } from './backup.js';
import { samplesToCsv, downloadCsv, sendEmail } from './export.js';
import { clearPhotosForSamples } from './photos-db.js';

// ── View routing ──────────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentType = null;
let editingId = null;   // null = new sample; string = editing existing

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

  const session = getSession();
  if (!session || !session.collectorName) {
    showView('view-session');
    prefillSessionForm(null);
  } else {
    showView('view-list');
    renderSampleList();
  }

  wireSessionForm();
  wireListButtons();
  wireFormButtons();
});

// ── Session Setup ─────────────────────────────────────────────────────────────
function prefillSessionForm(session) {
  if (!session) return;
  document.getElementById('collectorName').value = session.collectorName || '';
  document.getElementById('initials').value = session.initials || '';
  document.getElementById('state').value = session.state || '';
  document.getElementById('labEmail').value = session.labEmail || 'kah357@cornell.edu';
  document.getElementById('gasUrl').value = session.gasUrl || '';
  document.getElementById('startingSoil').value = session.startingSoil ?? 1;
  document.getElementById('startingSwab').value = session.startingSwab ?? 1;
  document.getElementById('startingWater').value = session.startingWater ?? 1;
}

function wireSessionForm() {
  const nameInput = document.getElementById('collectorName');
  nameInput.addEventListener('input', () => {
    const initialsInput = document.getElementById('initials');
    if (!initialsInput._manuallyEdited) {
      initialsInput.value = deriveInitials(nameInput.value);
    }
  });
  document.getElementById('initials').addEventListener('input', function () {
    this._manuallyEdited = true;
  });

  // Auto-detect state from GPS when session form is shown
  const stateInput = document.getElementById('state');
  if (!stateInput.value) {
    getCurrentPosition()
      .then(({ lat, lon }) => reverseGeocode(lat, lon))
      .then(locationStr => {
        const match = locationStr.match(/\b([A-Z]{2})\s*,\s*USA/i);
        if (match && !stateInput.value) stateInput.value = match[1].toUpperCase();
      })
      .catch(() => { /* leave blank for manual entry */ });
  }

  document.getElementById('session-form').addEventListener('submit', e => {
    e.preventDefault();
    const soil = parseInt(document.getElementById('startingSoil').value, 10);
    const swab = parseInt(document.getElementById('startingSwab').value, 10);
    const water = parseInt(document.getElementById('startingWater').value, 10);
    const session = {
      collectorName: document.getElementById('collectorName').value.trim(),
      initials: document.getElementById('initials').value.trim().toUpperCase(),
      state: document.getElementById('state').value.trim().toUpperCase(),
      labEmail: document.getElementById('labEmail').value.trim(),
      gasUrl: document.getElementById('gasUrl').value.trim(),
      startingSoil: soil, startingSwab: swab, startingWater: water,
      nextSoil: soil, nextSwab: swab, nextWater: water,
    };
    saveSession(session);
    showView('view-list');
    renderSampleList();
  });
}

// ── Sample List ───────────────────────────────────────────────────────────────
function renderSampleList() {
  const samples = loadSamples();
  const container = document.getElementById('sample-list');
  container.innerHTML = '';

  if (samples.length === 0) {
    container.innerHTML = '<p style="color:#666">No samples yet. Tap + New Sample.</p>';
  }

  samples.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sample-card';
    const dot = s.backupAttempted
      ? '<span class="backup-dot sent" title="Backup sent"></span>'
      : '<span class="backup-dot pending" title="Backup pending"></span>';
    card.innerHTML = `
      <div class="sample-id">${s.sampleId} ${dot}</div>
      <div class="sample-meta">${s.date} ${s.time} · ${s.location || 'No location'}</div>
    `;
    card.addEventListener('click', () => openForm(s.type, s));
    container.appendChild(card);
  });

  const session = getSession();
  const sendBtn = document.getElementById('btn-send-email');
  sendBtn.disabled = !navigator.onLine;

  const allBacked = samples.length > 0 && samples.every(s => s.backupAttempted);
  document.getElementById('btn-clear-session').classList.toggle('hidden', !allBacked);
}

function wireListButtons() {
  document.getElementById('btn-new-sample').addEventListener('click', () => {
    openTypeSelector();
  });

  document.getElementById('btn-edit-session').addEventListener('click', () => {
    prefillSessionForm(getSession());
    showView('view-session');
  });

  document.getElementById('btn-download-csv').addEventListener('click', () => {
    const samples = loadSamples();
    const session = getSession();
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const csv = samplesToCsv(samples);
    downloadCsv(csv, `samples_${session.state}_${session.initials}_${today}.csv`);
  });

  document.getElementById('btn-send-email').addEventListener('click', async () => {
    const samples = loadSamples();
    const session = getSession();
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const csv = samplesToCsv(samples);
    const btn = document.getElementById('btn-send-email');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      // EmailJS must be initialized: call emailjs.init() with your public key once before send
      // Replace EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID with real values
      await sendEmail('EMAILJS_PUBLIC_KEY', 'EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', {
        toEmail: session.labEmail,
        collectorName: session.collectorName,
        state: session.state,
        initials: session.initials,
        date: today,
        csvContent: csv,
      });
      showStatus('Email sent!', 'success');
      document.getElementById('btn-clear-session').classList.remove('hidden');
    } catch (err) {
      showStatus(`Send failed: ${err.message}`, 'error');
    } finally {
      btn.textContent = 'Send to Lab';
      btn.disabled = !navigator.onLine;
    }
  });

  document.getElementById('btn-clear-session').addEventListener('click', async () => {
    const confirmed = confirm(
      'Clear all local sample data? Make sure you have sent the email or downloaded the CSV first.\n\n' +
      'Backup was attempted for all samples, but confirm receipt in the lab\'s Google Sheet if unsure.'
    );
    if (!confirmed) return;
    const samples = loadSamples();
    await clearPhotosForSamples(samples.map(s => s.sampleId));
    clearAllSamples();
    clearSamplesFromSession();
    renderSampleList();
  });
}

// ── Sample Form ───────────────────────────────────────────────────────────────
function openTypeSelector() {
  editingId = null;
  currentType = null;
  showView('view-form');
  document.getElementById('form-title').textContent = 'New Sample — Select Type';
  document.getElementById('type-selector').classList.remove('hidden');
  document.getElementById('sample-form').classList.add('hidden');
}

function openForm(type, existingSample = null) {
  currentType = type;
  editingId = existingSample ? existingSample.id : null;
  showView('view-form');
  document.getElementById('type-selector').classList.add('hidden');
  document.getElementById('form-title').textContent = existingSample ? `Edit ${type}` : `New ${type}`;

  const form = document.getElementById('sample-form');
  form.classList.remove('hidden');

  document.getElementById('water-fields').classList.toggle('hidden', type !== 'water');
  document.getElementById('swab-fields').classList.toggle('hidden', type !== 'swab');
  document.getElementById('swab-photo-labels').classList.toggle('hidden', type !== 'swab');
  const notesLabel = document.querySelector('label[for="f-notes"]');
  if (notesLabel) notesLabel.closest('label').classList.toggle('hidden', type === 'swab');

  const session = getSession();

  if (existingSample) {
    fillFormFromSample(existingSample);
  } else {
    const num = getNextNumber(type);
    const sampleId = generateSampleId(session.state, session.initials, num, type);
    document.getElementById('display-sample-id').textContent = sampleId;
    document.getElementById('f-date').value = todayString();
    document.getElementById('f-time').value = nowTimeString();
    document.getElementById('f-collectors').value = session.collectorName;
    autoPopulateGeoWeather();
  }

  initPhotosUI(existingSample?.sampleId || null, type === 'swab');
  wireMicButtons();
}

function fillFormFromSample(s) {
  document.getElementById('display-sample-id').textContent = s.sampleId;
  document.getElementById('f-date').value = dmyToInputDate(s.date);
  document.getElementById('f-time').value = s.time;
  document.getElementById('f-collectors').value = s.collectors;
  document.getElementById('f-location').value = s.location;
  document.getElementById('f-lat').value = s.latitude ?? '';
  document.getElementById('f-lon').value = s.longitude ?? '';
  document.getElementById('f-ambientTemp').value = s.ambientTemp ?? '';
  document.getElementById('f-precipitation').value = String(s.precipitation);
  document.getElementById('f-notes').value = s.notes || '';
  if (s.type === 'water') {
    document.getElementById('f-waterTemp').value = s.waterTemp ?? '';
    document.getElementById('f-waterBodyDescription').value = s.waterBodyDescription || '';
  }
  if (s.type === 'swab') {
    document.getElementById('f-surfaceDescription').value = s.surfaceDescription || '';
    document.getElementById('f-surfaceType').value = s.surfaceType || '';
    document.getElementById('f-surfaceTypeOther').value = s.surfaceTypeOther || '';
    document.getElementById('surface-type-other-wrap').classList.toggle('hidden', s.surfaceType !== 'Other');
    document.getElementById('f-cracksAndCrevices').value = s.cracksAndCrevices != null ? String(s.cracksAndCrevices) : '';
    document.getElementById('f-highTrafficArea').value = s.highTrafficArea != null ? String(s.highTrafficArea) : '';
  }
}

async function autoPopulateGeoWeather() {
  try {
    const { lat, lon } = await getCurrentPosition();
    document.getElementById('f-lat').value = lat;
    document.getElementById('f-lon').value = lon;
    try {
      const location = await reverseGeocode(lat, lon);
      document.getElementById('f-location').value = location;
    } catch { /* leave blank */ }
    try {
      const { temperature, precipitation } = await fetchWeather(lat, lon);
      document.getElementById('f-ambientTemp').value = temperature;
      document.getElementById('f-precipitation').value = String(precipitation);
    } catch { /* leave blank */ }
  } catch { /* GPS unavailable — fields left blank */ }
}

function wireMicButtons() {
  document.querySelectorAll('.mic-btn').forEach(btn => {
    const target = btn.dataset.target;
    attachVoiceButton(btn, target);
  });
}

function wireFormButtons() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => openForm(btn.dataset.type));
  });

  document.getElementById('f-surfaceType').addEventListener('change', function () {
    document.getElementById('surface-type-other-wrap').classList.toggle('hidden', this.value !== 'Other');
  });

  document.getElementById('sample-form').addEventListener('submit', async e => {
    e.preventDefault();
    const session = getSession();
    const sampleId = document.getElementById('display-sample-id').textContent;

    const sample = {
      id: editingId || crypto.randomUUID(),
      type: currentType,
      sampleId,
      date: inputDateToDmy(document.getElementById('f-date').value),
      time: document.getElementById('f-time').value,
      collectors: document.getElementById('f-collectors').value.trim(),
      location: document.getElementById('f-location').value.trim(),
      latitude: parseFloatOrNull(document.getElementById('f-lat').value),
      longitude: parseFloatOrNull(document.getElementById('f-lon').value),
      ambientTemp: parseFloatOrNull(document.getElementById('f-ambientTemp').value),
      precipitation: document.getElementById('f-precipitation').value === 'true',
      notes: document.getElementById('f-notes').value.trim(),
      waterTemp: currentType === 'water' ? parseFloatOrNull(document.getElementById('f-waterTemp').value) : null,
      waterBodyDescription: currentType === 'water' ? document.getElementById('f-waterBodyDescription').value.trim() : '',
      surfaceDescription: currentType === 'swab' ? document.getElementById('f-surfaceDescription').value.trim() : '',
      surfaceType: currentType === 'swab' ? document.getElementById('f-surfaceType').value : '',
      surfaceTypeOther: currentType === 'swab' ? document.getElementById('f-surfaceTypeOther').value.trim() : '',
      cracksAndCrevices: currentType === 'swab' ? parseTriState(document.getElementById('f-cracksAndCrevices').value) : null,
      highTrafficArea: currentType === 'swab' ? parseTriState(document.getElementById('f-highTrafficArea').value) : null,
      backupAttempted: false,
      photosDriveLink: '',
    };

    await persistPendingPhotos(sampleId);
    saveSample(sample);
    enqueueBackup(sample);
    scheduleFlush(session.gasUrl);

    showView('view-list');
    renderSampleList();
  });

  document.getElementById('btn-cancel-form').addEventListener('click', () => {
    showView('view-list');
    renderSampleList();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeString() {
  return new Date().toTimeString().slice(0, 5);
}

function inputDateToDmy(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function dmyToInputDate(dmy) {
  if (!dmy) return '';
  const [d, m, y] = dmy.split('/');
  return `${y}-${m}-${d}`;
}

function parseFloatOrNull(val) {
  const f = parseFloat(val);
  return isNaN(f) ? null : f;
}

function parseTriState(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return null;
}

function showStatus(msg, type) {
  let el = document.getElementById('status-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'status-msg';
    document.getElementById('view-list').appendChild(el);
  }
  el.className = `status-msg ${type}`;
  el.textContent = msg;
  setTimeout(() => el.remove(), 4000);
}
```

- [ ] **Step 2: Run all tests to confirm nothing broken**

```bash
npm test
```
Expected: All previous tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: app routing, session setup, sample form, list view"
```

---

## Task 13: Photo upload to Google Drive via GAS

**Files:**
- Modify: `js/backup.js`
- Modify: `js/app.js` (call uploadPhotosForSample after saving)

> GAS doesn't set CORS headers, so Drive responses are opaque. We read the response
> optimistically: if the fetch resolves without network error, we treat it as success.
> The collector sees photos in Drive; the CSV Photos column contains the Drive folder URL
> only if the GAS returns it. To work around the CORS/opaque limitation, the GAS script
> returns the folder URL in a way that's readable by setting `Access-Control-Allow-Origin: *`
> via `ContentService`. Test this — in practice GAS does echo CORS headers on the redirect
> destination when deployed as "Anyone". If CORS still fails, the Photos column is left blank
> and the lab navigates to Drive manually using the folder path convention.

- [ ] **Step 1: Add `uploadPhotosToGas` to `js/backup.js`**

Add this function to the existing `js/backup.js`:

```js
export async function uploadPhotosToGas(gasUrl, sampleId, photos, folderPath) {
  if (!gasUrl || photos.length === 0) return null;
  let folderLink = null;
  for (const photo of photos) {
    const base64 = await blobToBase64(photo.blob);
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadPhoto',
          sampleId,
          photoId: photo.id,
          filename: `${photo.id}.jpg`,
          mimeType: photo.blob.type || 'image/jpeg',
          data: base64,
          folderPath,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.folderUrl) folderLink = json.folderUrl;
      }
    } catch {
      // CORS blocked or network error — best effort, continue to next photo
    }
  }
  return folderLink;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 2: Call photo upload after saving a sample in `js/app.js`**

In the `sample-form` submit handler in `app.js`, after `persistPendingPhotos(sampleId)` and `saveSample(sample)`, add:

```js
// Upload photos to Drive (best effort — if CORS fails, Photos column stays blank)
if (session.gasUrl) {
  const { getPhotosForSample } = await import('./photos-db.js');
  const photos = await getPhotosForSample(sampleId);
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const folderPath = `Cronobacter Sampling/${session.state}_${session.initials}_${today}/${sampleId}`;
  const folderUrl = await uploadPhotosToGas(session.gasUrl, sampleId, photos, folderPath);
  if (folderUrl) {
    sample.photosDriveLink = folderUrl;
    saveSample(sample);
  }
}
```

Also add `uploadPhotosToGas` to the import from `./backup.js` at the top of `app.js`:
```js
import { enqueueBackup, scheduleFlush, uploadPhotosToGas } from './backup.js';
```

- [ ] **Step 3: Update GAS script to handle photo uploads**

In the GAS editor, replace the existing script with this combined version (handles both data rows and photo uploads):

```js
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'uploadPhoto') return handlePhotoUpload(data);
    return handleDataRow(data);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleDataRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Backup');
  if (!sheet) {
    sheet = ss.insertSheet('Backup');
    sheet.appendRow([
      'SAMPLE-ID','TYPE','DATE','TIME (24H)','COLLECTOR(S)','LOCATION',
      'LATITUDE','LONGITUDE','AMBIENT TEMPERATURE (°C)','PRECIPITATION',
      'NOTES','WATER TEMPERATURE (°C)','WATER BODY DESCRIPTION',
      'ENVIRONMENT/SURFACE DESCRIPTION','SURFACE TYPE','SURFACE TYPE (OTHER)',
      'CRACKS/CREVICES','HIGH TRAFFIC AREA','PHOTOS'
    ]);
  }
  sheet.appendRow([
    data.sampleId, data.type, data.date, data.time,
    data.collectors, data.location, data.latitude, data.longitude,
    data.ambientTemp, data.precipitation ? 'Yes' : 'No',
    data.notes || '',
    data.waterTemp != null ? data.waterTemp : '',
    data.waterBodyDescription || '',
    data.surfaceDescription || '',
    data.surfaceType || '', data.surfaceTypeOther || '',
    data.cracksAndCrevices != null ? (data.cracksAndCrevices ? 'Yes' : 'No') : '',
    data.highTrafficArea != null ? (data.highTrafficArea ? 'Yes' : 'No') : '',
    data.photosDriveLink || ''
  ]);
  return jsonResponse({ success: true });
}

function handlePhotoUpload(data) {
  const root = DriveApp.getRootFolder();
  const folder = getOrCreateFolder(root, data.folderPath);
  const blob = Utilities.newBlob(Utilities.base64Decode(data.data), data.mimeType, data.filename);
  folder.createFile(blob);
  const folderUrl = folder.getUrl();
  return jsonResponse({ success: true, folderUrl });
}

function getOrCreateFolder(parent, path) {
  const parts = path.split('/');
  let current = parent;
  for (const part of parts) {
    const existing = current.getFoldersByName(part);
    current = existing.hasNext() ? existing.next() : current.createFolder(part);
  }
  return current;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 4: Redeploy GAS**

In Apps Script, click **Deploy → Manage deployments → Edit (pencil icon) → New version → Deploy**.
Copy the new URL (it stays the same if you selected the existing deployment).

- [ ] **Step 5: Commit**

```bash
git add js/backup.js js/app.js
git commit -m "feat: photo upload to Google Drive via GAS"
```

---

## Task 14: Google Apps Script — initial deploy

This task is done **once by the lab** before collectors use the app. No code files to check in.

- [ ] **Step 1: Open Google Sheets**

Open the lab's Google Spreadsheet (or create a new one). Go to **Extensions → Apps Script**.

- [ ] **Step 2: Paste GAS code**

Delete any existing code and paste:

```js
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Backup');
    if (!sheet) {
      sheet = ss.insertSheet('Backup');
      sheet.appendRow([
        'SAMPLE-ID','TYPE','DATE','TIME (24H)','COLLECTOR(S)','LOCATION',
        'LATITUDE','LONGITUDE','AMBIENT TEMPERATURE (°C)','PRECIPITATION',
        'NOTES','WATER TEMPERATURE (°C)','WATER BODY DESCRIPTION',
        'ENVIRONMENT/SURFACE DESCRIPTION','SURFACE TYPE','SURFACE TYPE (OTHER)',
        'CRACKS/CREVICES','HIGH TRAFFIC AREA','PHOTOS'
      ]);
    }
    sheet.appendRow([
      data.sampleId, data.type, data.date, data.time,
      data.collectors, data.location, data.latitude, data.longitude,
      data.ambientTemp, data.precipitation ? 'Yes' : 'No',
      data.notes || '',
      data.waterTemp != null ? data.waterTemp : '',
      data.waterBodyDescription || '',
      data.surfaceDescription || '',
      data.surfaceType || '', data.surfaceTypeOther || '',
      data.cracksAndCrevices != null ? (data.cracksAndCrevices ? 'Yes' : 'No') : '',
      data.highTrafficArea != null ? (data.highTrafficArea ? 'Yes' : 'No') : '',
      data.photosDriveLink || ''
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

- [ ] **Step 3: Deploy as web app**

Click **Deploy → New deployment**:
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone**

Click **Deploy**. Copy the URL (looks like `https://script.google.com/macros/s/.../exec`).

- [ ] **Step 4: Paste URL into app**

Paste the URL into the **GAS Script URL** field in the app's Session Setup screen.

> Note: Because GAS web apps redirect requests and don't set CORS headers, the app POSTs with
> `mode: 'no-cors'` (fire-and-forget). The data reaches the sheet even though the response
> is opaque. Check the Backup sheet in Google Sheets to verify data is arriving.

---

## Task 15: EmailJS setup

This task is done **once** before the app is deployed to collectors.

- [ ] **Step 1: Create EmailJS account**

Sign up at [emailjs.com](https://www.emailjs.com). Free tier: 200 emails/month.

- [ ] **Step 2: Add an email service**

Dashboard → **Email Services → Add New Service**. Connect a Gmail account (the lab's, or a
shared lab sender). Note the **Service ID** (e.g. `service_abc123`).

- [ ] **Step 3: Create an email template**

Dashboard → **Email Templates → Create New Template**. Use this template:

```
To: {{to_email}}
Subject: Cronobacter Sampling Data — {{trip_label}}

Collector: {{collector_name}}

CSV data is pasted below. Copy the content between the lines and save as a .csv file,
or download it directly from the app using "Download CSV".

---
{{csv_content}}
---
```

Note the **Template ID** (e.g. `template_xyz789`).

- [ ] **Step 4: Get public key**

Dashboard → **Account → General**. Copy the **Public Key**.

- [ ] **Step 5: Replace placeholders in `js/app.js`**

In `js/app.js`, find the `sendEmail()` call and replace the three placeholder strings:

```js
await sendEmail('YOUR_PUBLIC_KEY', 'YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
```

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "config: add real EmailJS credentials"
```

---

## Task 16: Deploy to GitHub Pages

- [ ] **Step 1: Create GitHub repo and push**

```bash
git remote add origin https://github.com/YOUR_ORG/cronobacter-sampling.git
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

Repo → **Settings → Pages → Source: Deploy from branch → main → / (root)**. Save.

- [ ] **Step 3: Verify URL**

After ~1 minute, open `https://YOUR_ORG.github.io/cronobacter-sampling/` on a phone browser.
The app should load and prompt for session setup.

- [ ] **Step 4: Test "Add to Home Screen"**

On iPhone (Safari): tap **Share → Add to Home Screen**.
On Android (Chrome): tap **⋮ → Add to Home Screen**.

The app icon should appear. Opening it should launch in full-screen (standalone) mode.

---

## Task 17: End-to-end mobile test checklist

Run these tests on a real phone (not a browser emulator).

- [ ] **Offline persistence**
  1. Open app, complete session setup, enter one sample of each type.
  2. Turn off WiFi + cellular.
  3. Close browser tab completely.
  4. Reopen app — all three samples should still appear in the list.

- [ ] **GPS + weather auto-fill**
  1. Tap + New Sample → Soil.
  2. Allow location when prompted.
  3. Latitude, Longitude, Location, Ambient Temp, Precipitation should fill within ~5 seconds.

- [ ] **Voice input**
  1. Tap + New Sample → Soil.
  2. Tap the 🎤 button next to Notes.
  3. Allow microphone when prompted.
  4. Speak a sentence. Tap ⏹ Stop. Text should appear in the Notes field.

- [ ] **Photo capture — Soil**
  1. Tap + New Sample → Soil.
  2. Tap Add Photo. Camera opens (or photo picker on iOS if camera not supported).
  3. Take a photo. Thumbnail appears. No suggested label buttons visible.
  4. Save sample. Sample appears in list.

- [ ] **Photo capture — Swab**
  1. Tap + New Sample → Swab.
  2. Three label buttons visible: "Surface being swabbed", "Surrounding environment", "Labeled sample bag".
  3. Tap a label button → camera opens. Photo taken → thumbnail appears with label.
  4. Tap Add Photo (without label button) → free-form photo added.
  5. Delete one thumbnail — it disappears.

- [ ] **Edit saved sample**
  1. Tap any sample card in the list.
  2. Form reopens with all fields populated.
  3. Edit Notes field. Save. List shows updated entry.

- [ ] **Swab "Other" surface type**
  1. Tap + New Sample → Swab.
  2. Select Surface Type → Other.
  3. A text field appears for custom surface type.
  4. Enter text. Save. Download CSV — "SURFACE TYPE (OTHER)" column has the value.

- [ ] **CSV download**
  1. Tap Download CSV.
  2. File downloads to phone (or opens in share sheet on iOS).
  3. Open in a spreadsheet app — verify all column headers match spec exactly.
  4. Verify type-specific columns are blank for non-applicable rows.

- [ ] **Send to Lab email**
  1. Ensure WiFi is on.
  2. Tap Send to Lab.
  3. Wait for "Email sent!" confirmation.
  4. Check `kah357@cornell.edu` inbox — email arrives with CSV content in body.

- [ ] **Clear session**
  1. After all samples have `backupAttempted: true` (green dots), the Clear Session button appears.
  2. Tap Clear Session → confirm dialog.
  3. Sample list empties. Counter resets to starting numbers.

- [ ] **Background backup**
  1. Enter a sample while offline (WiFi off).
  2. Save it — orange dot (backup pending).
  3. Turn WiFi back on.
  4. Within seconds, dot turns green (backup sent).
  5. Check the Backup sheet in Google Sheets — row should appear.
