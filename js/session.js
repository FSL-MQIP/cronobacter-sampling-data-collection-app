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

export function updateCounters(type, value) {
  const session = getSession();
  if (!session) return;
  const counterKey = type === 'soil' ? 'nextSoil' : type === 'swab' ? 'nextSwab' : 'nextWater';
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
