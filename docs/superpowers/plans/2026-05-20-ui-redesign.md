# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `index.html` and `css/styles.css` to a warm fieldbook theme with sticky headers, grouped form sections, color-coded sample cards, and "Recorded"/"Pending" badges.

**Architecture:** Full CSS replacement using CSS custom properties for the color palette. `index.html` restructured with `.view-header`, `.form-section`, and `.field-pair` components. Two targeted additions to `js/app.js` — dynamic list header title and back button wiring — plus updates to card HTML generation and form header updates.

**Tech Stack:** Vanilla HTML/CSS, no build step. Existing Jest test suite (`npm test`) must stay green throughout.

---

## File Map

| File | Change |
|---|---|
| `css/styles.css` | Full rewrite — new theme, CSS variables, all components |
| `index.html` | Restructure — add view headers, form-section wrappers, field-pairs, remove `h1#form-title` |
| `js/app.js` | Four targeted edits — `openTypeSelector`, `openForm`, `renderSampleList`, `wireFormButtons` |

---

### Task 1: Rewrite `css/styles.css`

**Files:**
- Modify: `css/styles.css`

- [ ] **Step 1: Replace the entire file with the new theme**

Replace all content of `css/styles.css` with:

```css
:root {
  --brown-dark:  #5c4033;
  --cream:       #f5e6c8;
  --cream-bg:    #fdf6e3;
  --cream-field: #f9f3e8;
  --border-warm: #d4b896;
  --text-dark:   #3e2723;
  --text-mid:    #795548;
  --soil-brown:  #A0522D;
  --swab-gold:   #B8860B;
  --water-blue:  #6B8FAB;
  --card-bg:     #fff8f0;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  background: var(--cream-bg);
  color: var(--text-dark);
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
}

.hidden { display: none !important; }
.view   { padding-bottom: 3rem; }

/* ── View Header ──────────────────────────────────────────────────────────── */
.view-header {
  position: sticky;
  top: 0;
  background: var(--brown-dark);
  color: var(--cream);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
  margin: -1rem -1rem 1.5rem;
}

.view-header-sub {
  font-size: 9px;
  letter-spacing: 1px;
  opacity: 0.75;
  text-transform: uppercase;
}

.view-header-title {
  font-weight: 900;
  font-size: 17px;
}

.btn-back {
  background: none;
  border: none;
  color: var(--cream);
  font-size: 22px;
  font-weight: 300;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

/* ── Form Sections ────────────────────────────────────────────────────────── */
.form-section-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-mid);
  margin-bottom: 6px;
}

.form-section-body {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  margin-bottom: 16px;
}

/* ── Field Pairs ──────────────────────────────────────────────────────────── */
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* ── Labels & Inputs ──────────────────────────────────────────────────────── */
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-mid);
  margin-bottom: 10px;
}

.form-section-body label:last-child,
.field-pair label { margin-bottom: 0; }

input, textarea, select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-warm);
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  background: var(--cream-field);
  color: var(--text-dark);
  text-transform: none;
  font-weight: normal;
  letter-spacing: normal;
}

textarea { min-height: 70px; resize: vertical; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
button {
  display: inline-block;
  padding: 0.85rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: var(--brown-dark);
  color: var(--cream);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
}

button:disabled { background: #c4a882; cursor: default; }
button.danger   { background: #c0392b; }

.btn-full {
  display: block;
  width: 100%;
  text-align: center;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 0.75rem;
}

.btn-secondary {
  background: none;
  color: var(--text-mid);
  border: none;
  font-size: 0.9rem;
  padding: 0.5rem;
  display: block;
  width: 100%;
  text-align: center;
  cursor: pointer;
}

.btn-outlined {
  background: var(--cream-bg);
  color: var(--brown-dark);
  border: 1.5px solid var(--brown-dark);
}

/* ── Type Selector ────────────────────────────────────────────────────────── */
#type-selector {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

button.type-btn {
  flex: 1;
  background: var(--card-bg);
  color: var(--text-dark);
  font-size: 1rem;
  font-weight: 700;
  padding: 1rem 0.5rem;
  border: 2px solid var(--border-warm);
  border-radius: 10px;
}
button.type-btn[data-type="soil"].active  { background: var(--soil-brown); color: #fff; border-color: var(--soil-brown); }
button.type-btn[data-type="swab"].active  { background: var(--swab-gold);  color: #fff; border-color: var(--swab-gold); }
button.type-btn[data-type="water"].active { background: var(--water-blue); color: #fff; border-color: var(--water-blue); }

/* ── Mic & Photo Label Buttons ────────────────────────────────────────────── */
button.mic-btn {
  background: none;
  color: var(--text-mid);
  border: 1px solid var(--border-warm);
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  margin-top: 4px;
  border-radius: 6px;
}

button.label-btn {
  background: var(--cream);
  color: var(--brown-dark);
  border: 1px solid var(--border-warm);
  font-size: 0.8rem;
  padding: 0.4rem 0.75rem;
  margin: 0 0.25rem 0.25rem 0;
}

/* ── Action Row ───────────────────────────────────────────────────────────── */
.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 0.75rem;
}

/* ── Sample Cards (rendered by JS) ───────────────────────────────────────── */
.sample-card {
  background: var(--card-bg);
  border-radius: 0 8px 8px 0;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 5px solid var(--border-warm);
}
.sample-card:hover { filter: brightness(0.97); }
.sample-card[data-type="soil"]  { border-left-color: var(--soil-brown); }
.sample-card[data-type="swab"]  { border-left-color: var(--swab-gold); }
.sample-card[data-type="water"] { border-left-color: var(--water-blue); }

.sample-card .sample-id   { font-weight: 800; color: var(--text-dark); font-size: 0.85rem; }
.sample-card .sample-type { font-size: 0.75rem; color: var(--text-mid); margin-top: 2px; text-transform: capitalize; }
.sample-card .sample-meta { font-size: 0.75rem; color: var(--text-mid); margin-top: 1px; }

.badge {
  font-size: 9px;
  font-weight: 800;
  border-radius: 4px;
  padding: 3px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.badge.recorded { background: var(--cream); color: var(--brown-dark); }
.badge.pending  { background: #fdebd0; color: #7D5A00; }

/* ── Session Card ─────────────────────────────────────────────────────────── */
.session-card {
  background: var(--card-bg);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

/* ── Photo Thumbnails ─────────────────────────────────────────────────────── */
#photo-thumbnails { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.thumb-wrap { position: relative; width: 80px; height: 80px; }
.thumb-wrap img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.thumb-wrap .delete-photo {
  position: absolute; top: -4px; right: -4px;
  background: #c0392b; color: #fff; border: none; border-radius: 50%;
  width: 20px; height: 20px; font-size: 0.7rem; cursor: pointer;
  padding: 0; display: flex; align-items: center; justify-content: center;
}

/* ── Status Message ───────────────────────────────────────────────────────── */
.status-msg { padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; }
.status-msg.success { background: #d4edda; color: #155724; }
.status-msg.error   { background: #f8d7da; color: #721c24; }
```

- [ ] **Step 2: Run the test suite to confirm no regressions**

```bash
cd /Users/yeonjinjung/Desktop/Cronobacter_sampling && npm test
```

Expected: all tests pass (39 tests, 0 failures). The CSS change has no effect on unit tests.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: fieldbook theme CSS with warm palette and new components"
```

---

### Task 2: Restructure `index.html`

**Files:**
- Modify: `index.html`

Key structural rules:
- Every `.view` gets a `.view-header` as its first child
- The form view's `.view-header-title` reuses `id="display-sample-id"` — JS already sets this to the sample ID and it now appears in the sticky header
- `h1#form-title` is removed (replaced by the sticky header)
- Form fields are wrapped in `.form-section` / `.form-section-body` divs
- Date+Time, Lat+Lon, Temp+Precipitation each get a `.field-pair` wrapper
- `#water-fields` and `#swab-fields` IDs move to their `.form-section` wrappers
- A new `id="notes-section"` wraps the notes section (JS toggles it for swab type)
- List view buttons restructured: `.btn-full` on New Sample, `.action-row` grid for CSV/Email, `.btn-secondary` for Edit Session

- [ ] **Step 1: Replace the entire file**

Replace all content of `index.html` with:

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
    <div class="view-header">
      <div class="view-header-text">
        <div class="view-header-sub">Cronobacter Sampling</div>
        <div class="view-header-title">Session Setup</div>
      </div>
    </div>
    <div class="session-card">
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
          <input type="url" id="gasUrl" value="https://script.google.com/macros/s/AKfycbzgbiz6z1Xogaf2Tgpn4bqC6NRa0LcjmxfWmYqXpgtSYixjAaMN1ZanMHaiT6Wd7QE8/exec">
        </label>
        <div class="field-pair">
          <label>Starting # — Soil
            <input type="number" id="startingSoil" value="1" min="1" required>
          </label>
          <label>Starting # — Swab
            <input type="number" id="startingSwab" value="1" min="1" required>
          </label>
        </div>
        <label>Starting # — Water
          <input type="number" id="startingWater" value="1" min="1" required>
        </label>
        <button type="submit" class="btn-full">Start Session</button>
      </form>
    </div>
  </div>

  <!-- View: Sample List -->
  <div id="view-list" class="view hidden">
    <div class="view-header">
      <div class="view-header-text">
        <div class="view-header-sub">Field Log</div>
        <div class="view-header-title" id="list-header-title"></div>
      </div>
    </div>
    <button id="btn-new-sample" class="btn-full">+ New Sample</button>
    <div id="sample-list"></div>
    <div class="action-row">
      <button id="btn-download-csv" class="btn-outlined">⬇ Download CSV</button>
      <button id="btn-send-email" disabled>✉ Send to Lab</button>
    </div>
    <button id="btn-clear-session" class="danger btn-full hidden">Clear Session</button>
    <button id="btn-edit-session" class="btn-secondary">Edit Session Setup</button>
  </div>

  <!-- View: Sample Form -->
  <div id="view-form" class="view hidden">
    <div class="view-header">
      <button class="btn-back" id="btn-back">←</button>
      <div class="view-header-text">
        <div class="view-header-sub" id="form-header-sub">New Sample</div>
        <div class="view-header-title" id="display-sample-id">Select a Type</div>
      </div>
    </div>

    <!-- Type selector (shown only for new samples) -->
    <div id="type-selector">
      <button class="type-btn" data-type="soil">Soil</button>
      <button class="type-btn" data-type="swab">Swab</button>
      <button class="type-btn" data-type="water">Water</button>
    </div>

    <!-- Sample form -->
    <form id="sample-form" class="hidden">

      <!-- Section 1: Location & Time -->
      <div class="form-section">
        <div class="form-section-label">📍 Location &amp; Time</div>
        <div class="form-section-body">
          <div class="field-pair">
            <label>Date <input type="date" id="f-date" required></label>
            <label>Time (24h) <input type="time" id="f-time" required></label>
          </div>
          <label>Collector(s) <input type="text" id="f-collectors" required></label>
          <label>Location <input type="text" id="f-location"></label>
          <div class="field-pair">
            <label>Latitude <input type="number" id="f-lat" step="any"></label>
            <label>Longitude <input type="number" id="f-lon" step="any"></label>
          </div>
        </div>
      </div>

      <!-- Section 2: Conditions -->
      <div class="form-section">
        <div class="form-section-label">🌤 Conditions</div>
        <div class="form-section-body">
          <div class="field-pair">
            <label>Ambient temp (°C) <input type="number" id="f-ambientTemp" step="0.1"></label>
            <label>Precipitation
              <select id="f-precipitation">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <!-- Section 3: Notes (hidden for swab) -->
      <div class="form-section" id="notes-section">
        <div class="form-section-label">📝 Notes</div>
        <div class="form-section-body">
          <label>Notes
            <textarea id="f-notes"></textarea>
            <button type="button" class="mic-btn" data-target="f-notes">🎤</button>
          </label>
        </div>
      </div>

      <!-- Section 4: Surface (swab only) -->
      <div class="form-section hidden" id="swab-fields">
        <div class="form-section-label">🪨 Surface</div>
        <div class="form-section-body">
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
          <div class="field-pair">
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
        </div>
      </div>

      <!-- Section 5: Water Body (water only) -->
      <div class="form-section hidden" id="water-fields">
        <div class="form-section-label">💧 Water Body</div>
        <div class="form-section-body">
          <label>Water temp (°C) <input type="number" id="f-waterTemp" step="0.1"></label>
          <label>Water body description
            <textarea id="f-waterBodyDescription"></textarea>
            <button type="button" class="mic-btn" data-target="f-waterBodyDescription">🎤</button>
          </label>
        </div>
      </div>

      <!-- Section 6: Photos -->
      <div class="form-section" id="photos-section">
        <div class="form-section-label">📷 Photos</div>
        <div class="form-section-body">
          <div id="swab-photo-labels" class="hidden">
            <button type="button" class="label-btn" data-label="Surface being swabbed">Surface being swabbed</button>
            <button type="button" class="label-btn" data-label="Surrounding environment">Surrounding environment</button>
            <button type="button" class="label-btn" data-label="Labeled sample bag">Labeled sample bag</button>
          </div>
          <button type="button" id="btn-add-photo">Add Photo</button>
          <input type="file" id="photo-input" accept="image/*" capture="environment" multiple class="hidden">
          <div id="photo-thumbnails"></div>
        </div>
      </div>

      <button type="submit" id="btn-save-sample" class="btn-full">Save Sample</button>
      <button type="button" id="btn-cancel-form" class="btn-secondary">Cancel</button>
    </form>
  </div>

  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Run the test suite**

```bash
npm test
```

Expected: all 39 tests pass. HTML changes don't affect unit tests since they test JS modules directly.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: restructure HTML for fieldbook theme — view headers, form sections, field pairs"
```

---

### Task 3: Update `js/app.js`

**Files:**
- Modify: `js/app.js`

Four targeted edits. Make them one at a time.

- [ ] **Step 1: Update `openTypeSelector()` to use the new header elements**

Find this block (around line 194):
```js
function openTypeSelector() {
  editingId = null;
  currentType = null;
  showView('view-form');
  document.getElementById('form-title').textContent = 'New Sample — Select Type';
  document.getElementById('type-selector').classList.remove('hidden');
  document.getElementById('sample-form').classList.add('hidden');
}
```

Replace with:
```js
function openTypeSelector() {
  editingId = null;
  currentType = null;
  showView('view-form');
  document.getElementById('form-header-sub').textContent = 'New Sample';
  document.getElementById('display-sample-id').textContent = 'Select a Type';
  document.getElementById('type-selector').classList.remove('hidden');
  document.getElementById('sample-form').classList.add('hidden');
}
```

- [ ] **Step 2: Update `openForm()` to use new header elements and fix notes visibility**

Find this block (around line 203):
```js
  document.getElementById('type-selector').classList.add('hidden');
  document.getElementById('form-title').textContent = existingSample ? `Edit ${type}` : `New ${type}`;

  const form = document.getElementById('sample-form');
  form.classList.remove('hidden');

  document.getElementById('water-fields').classList.toggle('hidden', type !== 'water');
  document.getElementById('swab-fields').classList.toggle('hidden', type !== 'swab');
  document.getElementById('swab-photo-labels').classList.toggle('hidden', type !== 'swab');
  const notesLabel = document.querySelector('label[for="f-notes"]');
  if (notesLabel) notesLabel.closest('label').classList.toggle('hidden', type === 'swab');
```

Replace with:
```js
  document.getElementById('type-selector').classList.add('hidden');
  document.getElementById('form-header-sub').textContent =
    `${type.charAt(0).toUpperCase() + type.slice(1)} Sample`;

  const form = document.getElementById('sample-form');
  form.classList.remove('hidden');

  document.getElementById('water-fields').classList.toggle('hidden', type !== 'water');
  document.getElementById('swab-fields').classList.toggle('hidden', type !== 'swab');
  document.getElementById('swab-photo-labels').classList.toggle('hidden', type !== 'swab');
  document.getElementById('notes-section').classList.toggle('hidden', type === 'swab');
```

- [ ] **Step 3: Update `renderSampleList()` to add trip label and new card HTML**

Find this block (around line 104):
```js
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
```

Replace with:
```js
function renderSampleList() {
  const samples = loadSamples();
  const container = document.getElementById('sample-list');
  container.innerHTML = '';

  const session = getSession();
  if (session) {
    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('list-header-title').textContent =
      `${session.state} · ${session.initials} · ${month}`;
  }

  if (samples.length === 0) {
    container.innerHTML = '<p style="color:var(--text-mid);padding:0.5rem 0">No samples yet. Tap + New Sample.</p>';
  }

  samples.forEach(s => {
    const card = document.createElement('div');
    card.className = 'sample-card';
    card.dataset.type = s.type;
    const badge = s.backupAttempted
      ? '<span class="badge recorded">✓ RECORDED</span>'
      : '<span class="badge pending">⏳ PENDING</span>';
    const typeLabel = s.type.charAt(0).toUpperCase() + s.type.slice(1);
    card.innerHTML = `
      <div>
        <div class="sample-id">${s.sampleId}</div>
        <div class="sample-type">${typeLabel}</div>
        <div class="sample-meta">${s.date} ${s.time} · ${s.location || 'No location'}</div>
      </div>
      ${badge}
    `;
    card.addEventListener('click', () => openForm(s.type, s));
    container.appendChild(card);
  });
```

- [ ] **Step 4: Wire the back button in `wireFormButtons()`**

Find the start of `wireFormButtons()` (around line 288):
```js
function wireFormButtons() {
  wireMicButtons();

  document.querySelectorAll('.type-btn').forEach(btn => {
```

Replace with:
```js
function wireFormButtons() {
  wireMicButtons();

  document.getElementById('btn-back').addEventListener('click', () => {
    showView('view-list');
    renderSampleList();
  });

  document.querySelectorAll('.type-btn').forEach(btn => {
```

- [ ] **Step 5: Run the test suite**

```bash
npm test
```

Expected: all 39 tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat: wire new view headers, back button, and Recorded/Pending card badges"
```

---

### Task 4: Manual Visual Verification

**Files:** none — manual testing only

Open the app in a browser (run `npx serve . -p 3000` or open `index.html` via live server) and verify each item:

- [ ] **Session setup view** — brown sticky header "Session Setup", form fields inside a warm cream card, full-width brown "Start Session" button

- [ ] **Sample list view — empty state** — header shows trip label e.g. "NY · YJ · May 2026", empty-state message visible, big "+ New Sample" button at top

- [ ] **Type selector** — three large tap-target buttons (Soil / Swab / Water), back arrow in header returns to list

- [ ] **New soil sample form** — header shows "Soil Sample" + sample ID; sections visible: Location & Time, Conditions, Notes, Photos; Surface and Water Body sections hidden; Date/Time side by side; Lat/Lon side by side; Temp/Precipitation side by side

- [ ] **New swab sample form** — Notes section hidden; Surface section visible; Cracks/crevices + High traffic area side by side; swab photo label buttons visible

- [ ] **New water sample form** — Water Body section visible with water temp + description; Notes section visible

- [ ] **Sample list with entries** — cards show color-coded left border (sienna for soil, dark gold for swab, dusty blue for water), warm cream card background, "✓ RECORDED" cream badge or "⏳ PENDING" amber badge, type label below sample ID

- [ ] **Sticky header** — scroll down a long form; header stays fixed at top

- [ ] **Save → back to list** — saving a sample returns to list view and the new card appears

- [ ] **Edit existing sample** — tap a card, form header shows correct type + ID, all fields populated

- [ ] **Run final test suite**

```bash
npm test
```

Expected: 39 tests, 0 failures.

- [ ] **Push to GitHub**

```bash
git push origin main
```
