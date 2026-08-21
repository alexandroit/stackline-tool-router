import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';

import esmDefault, * as esm from '../dist/index.js';

const require = createRequire(import.meta.url);
const commonjs = require('../dist/index.cjs');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(Object.keys(packageJson.dependencies || {}).length, 0);
assert.equal(typeof commonjs.createToolRouter, 'function');
assert.equal(typeof commonjs.createToolSearch, 'function');
assert.equal(typeof commonjs.normalizeTool, 'function');
assert.equal(commonjs.default.createToolRouter, commonjs.createToolRouter);
assert.equal(esmDefault.createToolRouter, esm.createToolRouter);

const tools = [
  { name: 'github_create_issue', description: 'Create a GitHub issue', inputSchema: { type: 'object' } },
  { name: 'slack_send_message', description: 'Send a Slack message', inputSchema: { type: 'object' } }
];
assert.equal(commonjs.createToolRouter(tools).select('open issue')[0], tools[0]);
assert.equal(esm.createToolRouter(tools).select('message in Slack')[0], tools[1]);

for (const file of [
  'index.cjs',
  'index.cjs.map',
  'index.d.cts',
  'index.d.mts',
  'index.d.ts',
  'index.js',
  'index.js.map',
  'index.min.js',
  'index.min.js.map'
]) {
  await access(new URL(`../dist/${file}`, import.meta.url));
}

const minified = await stat(new URL('../dist/index.min.js', import.meta.url));
assert.ok(minified.size < 35_000, `minified bundle is ${minified.size} bytes`);

console.log(JSON.stringify({
  browserBytes: minified.size,
  cjs: true,
  esm: true,
  runtimeDependencies: 0,
  version: packageJson.version
}));
