import { savePhoto, getPhotosForSample, deletePhoto } from './photos-db.js';

let _pendingPhotos = [];   // { id, blob, label, objectUrl } — held in memory until form saved
let _abortController = null;

export function initPhotosUI(sampleId, isSwab) {
  // Revoke old object URLs and reset state
  _pendingPhotos.forEach(p => URL.revokeObjectURL(p.objectUrl));
  _pendingPhotos = [];

  // Cancel all event listeners from previous initPhotosUI call
  if (_abortController) _abortController.abort();
  _abortController = new AbortController();
  const signal = _abortController.signal;

  const addBtn = document.getElementById('btn-add-photo');
  const fileInput = document.getElementById('photo-input');
  const swabHint = document.getElementById('swab-photo-hint');
  const thumbsDiv = document.getElementById('photo-thumbnails');

  thumbsDiv.innerHTML = '';
  swabHint.classList.toggle('hidden', !isSwab);

  // Load existing photos for edit mode
  if (sampleId) {
    getPhotosForSample(sampleId).then(photos => {
      photos.forEach(p => {
        const url = URL.createObjectURL(p.blob);
        _pendingPhotos.push({ id: p.id, blob: p.blob, label: p.label, objectUrl: url, existing: true, uploaded: p.uploaded });
        addThumb(thumbsDiv, p.id, url, p.label);
      });
    });
  }

  addBtn.addEventListener('click', () => {
    fileInput.click();
  }, { signal });

  fileInput.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(file => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const url = URL.createObjectURL(file);
      _pendingPhotos.push({ id, blob: file, label: '', objectUrl: url });
      addThumb(thumbsDiv, id, url, '');
    });
    fileInput.value = '';
  }, { signal });
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
    const photo = _pendingPhotos.find(p => p.id === id);
    if (photo?.objectUrl) URL.revokeObjectURL(photo.objectUrl);
    _pendingPhotos = _pendingPhotos.filter(p => p.id !== id);
    if (photo?.existing) deletePhoto(id).catch(() => {});
    wrap.remove();
  });
  wrap.appendChild(img);
  wrap.appendChild(del);
  container.appendChild(wrap);
}

export async function persistPendingPhotos(sampleId) {
  for (const p of _pendingPhotos) {
    if (!p.existing) {
      await savePhoto(sampleId, p.id, p.blob, p.label);
    }
    URL.revokeObjectURL(p.objectUrl);
  }
  _pendingPhotos = [];
}

export function getPendingPhotoCount() {
  return _pendingPhotos.length;
}
