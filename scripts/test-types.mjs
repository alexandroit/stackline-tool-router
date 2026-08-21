import { execFileSync } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = process.argv[2] || process.env.TYPESCRIPT_VERSION || packageJson.devDependencies.typescript;
const [major, minor = 0] = version.split('.').map(Number);
const work = await mkdtemp(path.join(os.tmpdir(), 'stackline-tool-router-types-'));
const packDirectory = path.join(work, 'pack');
const appDirectory = path.join(work, 'app');

try {
  try {
    await access(path.join(root, 'dist', 'index.d.ts'));
  } catch {
    run(process.execPath, ['scripts/build.mjs'], root);
  }
  await mkdir(packDirectory);
  await mkdir(appDirectory);
  const packOutput = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packDirectory], root);
  const [{ filename }] = JSON.parse(packOutput);
  run('npm', ['init', '--yes'], appDirectory);
  run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    `typescript@${version}`, path.join(packDirectory, filename)
  ], appDirectory);

  await writeFile(path.join(appDirectory, 'common.ts'), commonSource(), 'utf8');
  const files = ['common.ts'];
  if (major > 4 || (major === 4 && minor >= 7)) {
    await writeFile(path.join(appDirectory, 'module.mts'), moduleSource(), 'utf8');
    files.push('module.mts');
  }
  const modern = files.includes('module.mts');
  await writeFile(path.join(appDirectory, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      esModuleInterop: true,
      lib: ['ES2020'],
      module: modern ? 'Node16' : 'commonjs',
      moduleResolution: modern ? 'Node16' : 'node',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ES2018'
    },
    files
  }, null, 2)}\n`, 'utf8');
  run(path.join(appDirectory, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], appDirectory);
  console.log(`TypeScript ${version} package compatibility passed`);
} finally {
  if (!process.env.KEEP_TYPES_TEST) await rm(work, { force: true, recursive: true });
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

function commonSource() {
  return `
import router = require('@stackline/tool-router');

const tools = [{name: 'find_user', description: 'Find a user', inputSchema: {type: 'object'}}];
const index: router.ToolRouter<typeof tools[number]> = router.createToolRouter(tools);
const match: router.ToolMatch<typeof tools[number]> | undefined = index.search('find user')[0];
const routed: router.ToolRouteResult<typeof tools[number]> = index.route('find user', {maxTools: 1});
const error: router.ToolRouterError = new router.ToolRouterError('ERR_TEST', 'test');
void [match, routed, error];
`;
}

function moduleSource() {
  return `
import api, {
  createToolRouter,
  createToolSearch,
  defineTool,
  type ToolMatch,
  type ToolRouteResult
} from '@stackline/tool-router';

const weather = defineTool({
  type: 'function' as const,
  name: 'get_weather',
  description: 'Get weather',
  parameters: {type: 'object'}
});
const router = createToolRouter([weather]);
const matches: ToolMatch<typeof weather>[] = router.search('weather');
const route: ToolRouteResult<typeof weather> = router.route('forecast');
const helper = createToolSearch(router, {target: 'openai-responses'});
const result = helper.execute({query: 'weather'});
void [api, matches, route, result];
`;
}
