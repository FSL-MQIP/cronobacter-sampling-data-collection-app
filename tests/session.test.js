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

test('getNextNumber throws when no session exists', () => {
  expect(() => getNextNumber('soil')).toThrow('No active session');
});

test('getNextNumber throws on unknown type', () => {
  const session = { nextSoil: 3, nextSwab: 1, nextWater: 2, collectorName: '', initials: '', state: '', labEmail: '', gasUrl: '', startingSoil: 1, startingSwab: 1, startingWater: 1 };
  saveSession(session);
  expect(() => getNextNumber('unknown')).toThrow('Unknown sample type: unknown');
});
