import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseCode, inviteUrl, codeFromUrl, inviteMessage } from '../src/lib/invites.js';

test('codes normalise to uppercase letters and digits', () => {
  assert.equal(normaliseCode(' k7mp-q2x '), 'K7MPQ2X');
  assert.equal(normaliseCode(null), '');
  assert.equal(normaliseCode('a'.repeat(40)).length, 12);
});

test('links round-trip through the parser', () => {
  assert.equal(inviteUrl('k7mpq2x'), 'sportify://invite/K7MPQ2X');
  assert.equal(codeFromUrl('sportify://invite/K7MPQ2X'), 'K7MPQ2X');
  assert.equal(codeFromUrl('sportify:///invite/k7mp-q2x?utm=1'), 'K7MPQ2X');
});

test('other links and short codes are ignored', () => {
  assert.equal(codeFromUrl('exp+sportify://expo-development-client/?url=x'), null);
  assert.equal(codeFromUrl('sportify://invite/AB'), null);
  assert.equal(codeFromUrl(undefined), null);
});

test('the message spells out the code and the link', () => {
  const text = inviteMessage('k7mpq2x', 'Victor');
  assert.match(text, /^Victor invited you/);
  assert.match(text, /code K7MPQ2X/);
  assert.match(text, /sportify:\/\/invite\/K7MPQ2X$/);
  assert.match(inviteMessage('K7MPQ2X'), /^You are invited/);
});
