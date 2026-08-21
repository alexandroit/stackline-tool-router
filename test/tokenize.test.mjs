import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeIdentifier, normalizeText, tokenize } from '../src/index.js';
import { boundedEditDistance, tokenTrigrams } from '../src/tokenize.js';

test('normalizes accents, identifiers, acronyms, and camel case', () => {
  assert.equal(normalizeText('Cr\u00e9erHTTPServer42'), 'creer http server42');
  assert.equal(normalizeIdentifier('GitHub.create-Issue'), 'githubcreateissue');
  assert.deepEqual(tokenize('createPullRequest v2'), ['create', 'pull', 'request', 'v2']);
  assert.deepEqual(tokenize('a I x'), []);
  assert.equal(normalizeText(42), '');
  assert.equal(normalizeIdentifier(null), '');
});

test('indexes adjacent CJK characters without depending on Intl.Segmenter', () => {
  const tokens = tokenize('\u641c\u7d22\u6587\u4ef6');
  assert.ok(tokens.includes('\u641c\u7d22\u6587\u4ef6'));
  assert.ok(tokens.includes('\u641c\u7d22'));
  assert.ok(tokens.includes('\u7d22\u6587'));
});

test('supports bounded fuzzy matching primitives', () => {
  assert.equal(boundedEditDistance('slak', 'slack', 1), 1);
  assert.equal(boundedEditDistance('ticket', 'planet', 2), 3);
  assert.equal(boundedEditDistance('a', 'abcdef', 1), 2);
  assert.equal(boundedEditDistance('', 'abc', 1), 2);
  assert.equal(boundedEditDistance('abc', '', 1), 2);
  assert.deepEqual(tokenTrigrams('ab'), ['  a', ' ab', 'ab ']);
  assert.deepEqual(tokenTrigrams(''), ['   ']);
});

test('validates tokenizer limits and truncates bounded words', () => {
  assert.throws(() => tokenize('hello', { maxTokenLength: 1 }), /maxTokenLength/);
  assert.throws(() => tokenize('hello', { maxTokenLength: 300 }), /maxTokenLength/);
  assert.deepEqual(tokenize('abcdefgh', { maxTokenLength: 4 }), ['abcd']);
});
