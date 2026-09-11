import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeEntry, newClientId, dueEntries, abandonedEntries, withoutEntry, withAttempt,
  looksAlreadyLogged, isPermanent, MAX_AGE_MS, MAX_ATTEMPTS,
} from '../src/lib/pendingQueue.js';

const payload = (id = '7', minutes = 45) => ({
  p_workout_id: id, p_workout_name: 'Push', p_minutes: minutes,
  p_volume_kg: 4200, p_completion: 1, p_tz: 'Europe/Bucharest', p_exercises: [],
});

test('client ids are unique', () => {
  const ids = new Set(Array.from({ length: 500 }, newClientId));
  assert.equal(ids.size, 500);
});

test('a new entry starts unsent and stamped', () => {
  const e = makeEntry(payload(), 1000);
  assert.equal(e.attempts, 0);
  assert.equal(e.queued_at, 1000);
  assert.deepEqual(e.payload, payload());
  assert.ok(e.client_id);
});

test('sessions replay oldest first', () => {
  // The streak and the split cursor both read the sequence, so order matters.
  const queue = [makeEntry(payload('c'), 300), makeEntry(payload('a'), 100), makeEntry(payload('b'), 200)];
  assert.deepEqual(dueEntries(queue, 400).map((e) => e.payload.p_workout_id), ['a', 'b', 'c']);
});

test('entries too old or tried too often stop being due', () => {
  const now = 1_000_000_000;
  const fresh = makeEntry(payload('fresh'), now - 1000);
  const ancient = makeEntry(payload('old'), now - MAX_AGE_MS - 1);
  const exhausted = { ...makeEntry(payload('done'), now - 1000), attempts: MAX_ATTEMPTS };

  const due = dueEntries([fresh, ancient, exhausted], now);
  assert.deepEqual(due.map((e) => e.payload.p_workout_id), ['fresh']);

  const gone = abandonedEntries([fresh, ancient, exhausted], now);
  assert.deepEqual(gone.map((e) => e.payload.p_workout_id).sort(), ['done', 'old']);
});

test('a queue of junk does not crash the flush', () => {
  assert.deepEqual(dueEntries([null, undefined, {}, { payload: null }], 1), []);
  assert.deepEqual(dueEntries(null), []);
  assert.deepEqual(abandonedEntries(undefined), []);
});

test('removing and counting attempts leave the rest alone', () => {
  const a = makeEntry(payload('a'), 100);
  const b = makeEntry(payload('b'), 200);

  assert.deepEqual(withoutEntry([a, b], a.client_id).map((e) => e.client_id), [b.client_id]);
  assert.deepEqual(withoutEntry([a, b], 'nope').length, 2);

  const tried = withAttempt([a, b], b.client_id, 'Network request failed');
  assert.equal(tried[0].attempts, 0);
  assert.equal(tried[1].attempts, 1);
  assert.equal(tried[1].last_error, 'Network request failed');
  assert.equal(withAttempt(tried, b.client_id)[1].attempts, 2);
});

test('a session already on the server is recognised', () => {
  // The window this closes: the write landed and the response was lost.
  const entry = makeEntry(payload('7', 45), Date.parse('2026-01-05T10:00:00Z'));
  const rows = [{ workout_id: '7', duration_minutes: 45, completed_at: '2026-01-05T10:00:30Z' }];

  assert.equal(looksAlreadyLogged(entry, rows), true);
});

test('a minute of rounding slack is allowed, more is not', () => {
  const entry = makeEntry(payload('7', 45), Date.parse('2026-01-05T10:00:00Z'));
  const at = '2026-01-05T10:00:30Z';

  assert.equal(looksAlreadyLogged(entry, [{ workout_id: '7', duration_minutes: 46, completed_at: at }]), true);
  assert.equal(looksAlreadyLogged(entry, [{ workout_id: '7', duration_minutes: 44, completed_at: at }]), true);
  assert.equal(looksAlreadyLogged(entry, [{ workout_id: '7', duration_minutes: 52, completed_at: at }]), false);
});

test('a different workout, or one logged before this session, is not a duplicate', () => {
  const entry = makeEntry(payload('7', 45), Date.parse('2026-01-05T10:00:00Z'));

  assert.equal(
    looksAlreadyLogged(entry, [{ workout_id: '9', duration_minutes: 45, completed_at: '2026-01-05T10:00:30Z' }]),
    false, 'another workout of the same length');

  assert.equal(
    looksAlreadyLogged(entry, [{ workout_id: '7', duration_minutes: 45, completed_at: '2026-01-04T10:00:00Z' }]),
    false, 'the same session yesterday is history, not this one');
});

test('ids compare as text, so 7 and "7" are the same workout', () => {
  const entry = makeEntry({ ...payload(), p_workout_id: 7 }, Date.parse('2026-01-05T10:00:00Z'));
  assert.equal(
    looksAlreadyLogged(entry, [{ workout_id: '7', duration_minutes: 45, completed_at: '2026-01-05T10:01:00Z' }]),
    true);
});

test('an empty or unreadable completion list is never a duplicate', () => {
  const entry = makeEntry(payload(), Date.parse('2026-01-05T10:00:00Z'));
  assert.equal(looksAlreadyLogged(entry, []), false);
  assert.equal(looksAlreadyLogged(entry, null), false);
  assert.equal(looksAlreadyLogged(entry, [{ completed_at: 'nonsense' }]), false);
});

test('only hopeless failures are permanent', () => {
  assert.equal(isPermanent('new row violates row-level security policy for table'), true);
  assert.equal(isPermanent('permission denied for function complete_workout'), true);
  assert.equal(isPermanent('invalid input syntax for type integer'), true);

  // Everything a bad signal produces must stay retryable, or the queue throws
  // away the sessions it exists to protect.
  assert.equal(isPermanent('Network request failed'), false);
  assert.equal(isPermanent('TypeError: Failed to fetch'), false);
  assert.equal(isPermanent('timeout'), false);
  assert.equal(isPermanent('503 Service Unavailable'), false);
  assert.equal(isPermanent(''), false);
  assert.equal(isPermanent(null), false);
});
