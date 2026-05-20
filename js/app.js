import { getSession, saveSession, deriveInitials, getNextNumber, clearSamplesFromSession } from './session.js';
import { generateSampleId } from './sample-id.js';
import { loadSamples, saveSample, deleteSample, clearAllSamples } from './storage.js';
import { getCurrentPosition, reverseGeocode } from './geo.js';
import { fetchWeather } from './weather.js';
import { attachVoiceButton } from './voice.js';
import { initPhotosUI, persistPendingPhotos, getPendingPhotos } from './photos-ui.js';
import { enqueueBackup, scheduleFlush, uploadPhotosToGas } from './backup.js';
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
let _micAbortController = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

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
    const collectorName = document.getElementById('collectorName').value.trim();
    if (!collectorName) {
      alert('Please enter a collector name.');
      return;
    }
    const soil = parseInt(document.getElementById('startingSoil').value, 10);
    const swab = parseInt(document.getElementById('startingSwab').value, 10);
    const water = parseInt(document.getElementById('startingWater').value, 10);
    const session = {
      collectorName,
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
      <div class="card-right">
        ${badge}
        <button class="btn-delete-sample" title="Delete sample">×</button>
      </div>
    `;
    card.querySelector('.btn-delete-sample').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Delete ${s.sampleId}?`)) {
        deleteSample(s.id);
        renderSampleList();
      }
    });
    card.addEventListener('click', () => openForm(s.type, s));
    container.appendChild(card);
  });

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
      await sendEmail(session.gasUrl, {
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
  document.getElementById('form-header-sub').textContent = 'New Sample';
  document.getElementById('display-sample-id').textContent = 'Select a Type';
  document.getElementById('type-selector').classList.remove('hidden');
  document.getElementById('sample-form').classList.add('hidden');
}

function openForm(type, existingSample = null) {
  currentType = type;
  editingId = existingSample ? existingSample.id : null;
  showView('view-form');
  const saveBtn = document.getElementById('btn-save-sample');
  saveBtn.disabled = false;
  saveBtn.textContent = existingSample ? 'Update Sample' : 'Save Sample';
  document.getElementById('type-selector').classList.add('hidden');
  document.getElementById('form-header-sub').textContent =
    `${type.charAt(0).toUpperCase() + type.slice(1)} Sample`;

  const form = document.getElementById('sample-form');
  form.classList.remove('hidden');

  document.getElementById('water-fields').classList.toggle('hidden', type !== 'water');
  document.getElementById('swab-fields').classList.toggle('hidden', type !== 'swab');
  document.getElementById('swab-photo-labels').classList.toggle('hidden', type !== 'swab');
  document.getElementById('notes-section').classList.toggle('hidden', type === 'swab');

  const session = getSession();

  if (existingSample) {
    fillFormFromSample(existingSample);
  } else {
    document.getElementById('sample-form').reset();
    const num = getNextNumber(type);
    const sampleId = generateSampleId(session.state, session.initials, num, type);
    document.getElementById('display-sample-id').textContent = sampleId;
    document.getElementById('f-date').value = todayString();
    document.getElementById('f-time').value = nowTimeString();
    document.getElementById('f-collectors').value = session.collectorName;
    autoPopulateGeoWeather();
  }

  initPhotosUI(existingSample?.sampleId || null, type === 'swab');
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
  if (_micAbortController) _micAbortController.abort();
  _micAbortController = new AbortController();
  document.querySelectorAll('.mic-btn').forEach(btn => {
    const target = btn.dataset.target;
    attachVoiceButton(btn, target);
  });
}

function wireFormButtons() {
  wireMicButtons();

  document.getElementById('btn-back').addEventListener('click', () => {
    showView('view-list');
    renderSampleList();
  });

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => openForm(btn.dataset.type));
  });

  document.getElementById('f-surfaceType').addEventListener('change', function () {
    document.getElementById('surface-type-other-wrap').classList.toggle('hidden', this.value !== 'Other');
  });

  document.getElementById('sample-form').addEventListener('submit', async e => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-sample');
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
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
      backupAttempted: editingId ? (loadSamples().find(s => s.id === editingId)?.backupAttempted ?? false) : false,
      photosDriveLink: editingId ? (loadSamples().find(s => s.id === editingId)?.photosDriveLink ?? '') : '',
    };

    const photosToUpload = getPendingPhotos(); // capture before persist clears them
    try { await persistPendingPhotos(sampleId); } catch { /* IndexedDB unavailable — skip local photo storage */ }
    saveSample(sample);

    // Upload photos to Drive and queue sheet backup — both best-effort, never block save
    if (session.gasUrl) {
      try {
        const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const folderPath = `Cronobacter Sampling/${session.state}_${session.initials}_${today}/${sampleId}`;
        const folderUrl = await uploadPhotosToGas(session.gasUrl, sampleId, photosToUpload, folderPath);
        if (folderUrl) {
          sample.photosDriveLink = folderUrl;
          saveSample(sample);
        }
      } catch { /* photo upload failed — Drive link stays blank */ }
      enqueueBackup({ ...sample, action: 'upsertRow' });
      scheduleFlush(session.gasUrl);
    }

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
    el.addEventListener('click', () => el.remove());
    document.getElementById('view-list').appendChild(el);
  }
  el.className = `status-msg ${type}`;
  el.textContent = msg + (type === 'error' ? ' (tap to dismiss)' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.remove(), type === 'error' ? 15000 : 4000);
}
