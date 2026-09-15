import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, pluralCategory, languageForLocale } from '../src/i18n/translate.js';

const DICT = {
  ro: {
    Workouts: 'Antrenamente',
    'Hi {name}': 'Salut, {name}',
    '{count} day': { one: '{count} zi', few: '{count} zile', other: '{count} de zile' },
  },
};

test('English is the key and the fallback', () => {
  assert.equal(translate(DICT, 'en', 'Workouts'), 'Workouts');
  assert.equal(translate(DICT, 'ro', 'Workouts'), 'Antrenamente');
  assert.equal(translate(DICT, 'ro', 'Not translated yet'), 'Not translated yet');
});

test('placeholders fill in either language', () => {
  assert.equal(translate(DICT, 'ro', 'Hi {name}', { name: 'Victor' }), 'Salut, Victor');
  assert.equal(translate(DICT, 'en', 'Hi {name}', { name: 'Victor' }), 'Hi Victor');
  assert.equal(translate(DICT, 'en', 'Hi {name}'), 'Hi {name}');
});

test('Romanian plurals: one, few, and the "de" form', () => {
  assert.equal(translate(DICT, 'ro', '{count} day', { count: 1 }), '1 zi');
  assert.equal(translate(DICT, 'ro', '{count} day', { count: 5 }), '5 zile');
  assert.equal(translate(DICT, 'ro', '{count} day', { count: 20 }), '20 de zile');
  assert.equal(translate(DICT, 'ro', '{count} day', { count: 101 }), '101 zile');
  assert.equal(translate(DICT, 'ro', '{count} day', { count: 120 }), '120 de zile');
  assert.deepEqual([0, 1, 2, 19, 20, 100, 119].map((n) => pluralCategory(n, 'ro')), ['few', 'one', 'few', 'few', 'other', 'other', 'few']);
});

test('the phone locale picks the language', () => {
  assert.equal(languageForLocale('ro-RO'), 'ro');
  assert.equal(languageForLocale('ro_MD'), 'ro');
  assert.equal(languageForLocale('en-GB'), 'en');
  assert.equal(languageForLocale('de-DE'), 'en');
  assert.equal(languageForLocale(undefined), 'en');
});
