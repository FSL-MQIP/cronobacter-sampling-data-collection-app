const KEY = 'cronobacter_samples';

export function loadSamples() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    console.error('cronobacter_samples corrupt — resetting');
    localStorage.removeItem(KEY);
    return [];
  }
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
