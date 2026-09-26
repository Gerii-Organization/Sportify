import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthDate, ageOn, ageOf, birthDateError, splitBirthDate } from '../src/lib/birthday.js';

const on = (y, m, d) => new Date(y, m - 1, d, 12);

test('parseBirthDate accepts real dates and pads them', () => {
  assert.equal(parseBirthDate({ day: '5', month: '3', year: '1999' }), '1999-03-05');
  assert.equal(parseBirthDate({ day: '29', month: '2', year: '2004' }), '2004-02-29');
});

test('parseBirthDate refuses dates that do not exist', () => {
  assert.equal(parseBirthDate({ day: '31', month: '4', year: '1999' }), null);
  assert.equal(parseBirthDate({ day: '29', month: '2', year: '2003' }), null);
  assert.equal(parseBirthDate({ day: '1', month: '13', year: '1999' }), null);
  assert.equal(parseBirthDate({ day: '1', month: '1', year: '99' }), null);
  assert.equal(parseBirthDate({ day: '', month: '1', year: '1999' }), null);
});

test('age goes up on the birthday, not before', () => {
  assert.equal(ageOn('2000-09-22', on(2026, 9, 21)), 25);
  assert.equal(ageOn('2000-09-22', on(2026, 9, 22)), 26);
  assert.equal(ageOn('2000-12-31', on(2026, 1, 1)), 25);
});

test('a 29 February birthday counts from 1 March in a common year', () => {
  assert.equal(ageOn('2004-02-29', on(2027, 2, 28)), 22);
  assert.equal(ageOn('2004-02-29', on(2027, 3, 1)), 23);
});

test('ageOf prefers the birth date and falls back to the typed age', () => {
  assert.equal(ageOf({ birth_date: '2000-01-01', age: 19 }, on(2026, 6, 1)), 26);
  assert.equal(ageOf({ age: '31' }), 31);
  assert.equal(ageOf({}), null);
  assert.equal(ageOf(null), null);
});

test('birthDateError enforces the age limits', () => {
  const today = on(2026, 9, 22);
  assert.equal(birthDateError({ day: '22', month: '9', year: '2010' }, today), null);
  assert.match(birthDateError({ day: '23', month: '9', year: '2010' }, today), /16 or older/);
  assert.match(birthDateError({ day: '1', month: '1', year: '1900' }, today), /year/);
  assert.match(birthDateError({ day: '31', month: '2', year: '1990' }, today), /real date/);
});

test('splitBirthDate round-trips', () => {
  assert.deepEqual(splitBirthDate('1999-03-05'), { day: '05', month: '03', year: '1999' });
  assert.deepEqual(splitBirthDate(null), { day: '', month: '', year: '' });
  assert.equal(parseBirthDate(splitBirthDate('1999-03-05')), '1999-03-05');
});
