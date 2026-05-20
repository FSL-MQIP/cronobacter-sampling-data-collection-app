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
  if (!session) throw new Error('No active session');
  const counterKey = { soil: 'nextSoil', swab: 'nextSwab', water: 'nextWater' }[type];
  if (!counterKey) throw new Error(`Unknown sample type: ${type}`);
  const num = session[counterKey];
  session[counterKey] = num + 1;
  saveSession(session);
  return num;
}

export function updateCounters(type, value) {
  const session = getSession();
  if (!session) throw new Error('No active session');
  const counterKey = { soil: 'nextSoil', swab: 'nextSwab', water: 'nextWater' }[type];
  if (!counterKey) throw new Error(`Unknown sample type: ${type}`);
  session[counterKey] = value;
  saveSession(session);
}

export function clearSamplesFromSession() {
  const session = getSession();
  if (!session) return;
  session.nextSoil = session.startingSoil;
  session.nextSwab = session.startingSwab;
  session.nextWater = session.startingWater;
  saveSession(session);
}
