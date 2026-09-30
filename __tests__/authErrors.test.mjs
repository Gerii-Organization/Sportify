import test from 'node:test';
import assert from 'node:assert/strict';
import { authErrorMessage } from '../src/lib/authErrors.js';

test('a known code gets its own message', () => {
  const out = authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' });
  assert.equal(out.title, 'Wrong email or password');
});

test('an existing account points to logging in', () => {
  assert.equal(authErrorMessage({ code: 'user_already_exists' }).action, 'login');
  assert.equal(authErrorMessage({ message: 'User already registered' }).action, 'login');
});

test('a request that never arrived reads as a connection problem', () => {
  assert.equal(authErrorMessage({ name: 'AuthRetryableFetchError', message: '' }).title, 'No connection');
  assert.equal(authErrorMessage({ message: 'TypeError: Network request failed' }).title, 'No connection');
});

test('anything else falls back without leaking the raw text', () => {
  const out = authErrorMessage({ code: 'something_new', message: 'relation "x" does not exist' });
  assert.equal(out.title, 'Something went wrong');
  assert.ok(!out.message.includes('relation'));
  assert.equal(authErrorMessage(null).title, 'Something went wrong');
});
