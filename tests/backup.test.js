import { jest } from '@jest/globals';
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
