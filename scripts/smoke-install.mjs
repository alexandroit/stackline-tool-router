import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.platform === 'win32'
  ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  : null;
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const expectedTarball = `${packageJson.name.replace(/^@/, '').replace(/\//g, '-')}-${packageJson.version}.tgz`;
const work = await mkdtemp(path.join(os.tmpdir(), 'stackline-tool-router-install-'));

try {
  const tarball = process.argv[2]
    ? await resolveTarball(process.argv[2], expectedTarball)
    : await createTarball(path.join(work, 'artifact'));
  const directory = path.join(work, 'consumer');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: { '@stackline/tool-router': `file:${tarball}` }
  }, null, 2)}\n`, 'utf8');
  runNpm(['install', '--ignore-scripts', '--no-fund'], directory);
  await writeFile(path.join(directory, 'smoke.cjs'), `'use strict';
const assert = require('assert');
const {createToolRouter} = require('@stackline/tool-router');
const tools = [{name: 'jira_create_ticket', description: 'Create a Jira ticket', inputSchema: {type: 'object'}}];
assert.strictEqual(createToolRouter(tools).select('new ticket')[0], tools[0]);
`, 'utf8');
  await writeFile(path.join(directory, 'smoke.mjs'), `import assert from 'assert';
import api, {createToolRouter} from '@stackline/tool-router';
const tools = [{name: 'drive_search_files', description: 'Search Google Drive files', inputSchema: {type: 'object'}}];
assert.strictEqual(createToolRouter(tools).select('find drive file')[0], tools[0]);
assert.strictEqual(api.createToolRouter, createToolRouter);
`, 'utf8');
  run(process.execPath, ['smoke.cjs'], directory);
  run(process.execPath, ['smoke.mjs'], directory);
  if (!process.env.SKIP_INSTALL_AUDIT) runNpm(['audit', '--omit=dev', '--audit-level=high'], directory);
  console.log(`${packageJson.name}@${packageJson.version} clean-install smoke passed on ${process.version}`);
} finally {
  if (!process.env.KEEP_INSTALL_TEST) await rm(work, { force: true, recursive: true });
}

async function resolveTarball(input, filename) {
  const resolved = path.resolve(input);
  const info = await stat(resolved);
  if (info.isFile()) return resolved;
  const entries = await readdir(resolved);
  if (!entries.includes(filename)) throw new Error(`Expected ${filename} in ${resolved}`);
  return path.join(resolved, filename);
}

async function createTarball(directory) {
  await mkdir(directory, { recursive: true });
  const output = runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory], root);
  const [{ filename }] = JSON.parse(output);
  return path.join(directory, filename);
}

function runNpm(args, cwd) {
  return npmCli ? run(process.execPath, [npmCli, ...args], cwd) : run('npm', args, cwd);
}

function run(command, args, cwd) {
  const env = { ...process.env, npm_config_loglevel: 'error' };
  delete env.npm_config_dry_run;
  delete env.NPM_CONFIG_DRY_RUN;
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}
