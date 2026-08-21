import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('publishes a zero-runtime-dependency dual package with public metadata', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.name, '@stackline/tool-router');
  assert.match(packageJson.version, /^1\.\d+\.\d+$/);
  assert.equal(packageJson.license, 'MIT');
  assert.deepEqual(packageJson.dependencies, undefined);
  assert.equal(packageJson.sideEffects, false);
  assert.equal(packageJson.exports['.'].import.default, './dist/index.js');
  assert.equal(packageJson.exports['.'].require.default, './dist/index.cjs');
  assert.equal(packageJson.publishConfig.access, 'public');
});

test('keeps the browser global build free of Node runtime imports', async () => {
  const browser = await readFile(new URL('../dist/index.min.js', import.meta.url), 'utf8');
  assert.match(browser, /StacklineToolRouter/);
  assert.doesNotMatch(browser, /node:/);
  assert.doesNotMatch(browser, /require\(/);
});
