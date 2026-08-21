import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';

const output = new URL('../site-dist/', import.meta.url);
const required = [
  'index.html',
  'app.js',
  'styles.css',
  'assets/tool-routing.webp',
  'assets/stackline-tool-router.min.js',
  'reference.md',
  'architecture.md',
  'market-research.md',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  'version.json'
];

for (const file of required) await access(new URL(file, output));

const html = await readFile(new URL('index.html', output), 'utf8');
const app = await readFile(new URL('app.js', output), 'utf8');
const styles = await readFile(new URL('styles.css', output), 'utf8');
const robots = await readFile(new URL('robots.txt', output), 'utf8');
const sitemap = await readFile(new URL('sitemap.xml', output), 'utf8');
const llms = await readFile(new URL('llms.txt', output), 'utf8');
const llmsFull = await readFile(new URL('llms-full.txt', output), 'utf8');
const version = JSON.parse(await readFile(new URL('version.json', output), 'utf8'));
const bundle = await stat(new URL('assets/stackline-tool-router.min.js', output));
const image = await stat(new URL('assets/tool-routing.webp', output));

assert.match(html, /<link rel="canonical" href="https:\/\/alexandro\.net\/docs\/vanilla\/tool-router\/">/);
assert.match(html, /<meta name="description"/);
assert.match(html, /id="workbench"/);
assert.match(html, /application\/ld\+json/);
assert.match(html, /assets\/stackline-tool-router\.min\.js/);
assert.match(app, /StacklineToolRouter/);
assert.match(app, /api\.createToolRouter/);
assert.match(styles, /@media \(max-width: 760px\)/);
assert.match(robots, /Allow: \/docs\/vanilla\/tool-router\//);
assert.match(sitemap, /https:\/\/alexandro\.net\/docs\/vanilla\/tool-router\//);
assert.match(llms, /@stackline\/tool-router/);
assert.match(llmsFull, /createToolRouter/);
assert.doesNotMatch(html, /{{VERSION}}/);
assert.doesNotMatch(app, /{{VERSION}}/);
assert.doesNotMatch(llms, /{{VERSION}}/);
assert.doesNotMatch(llmsFull, /{{VERSION}}/);
assert.equal(version.name, '@stackline/tool-router');
assert.equal(version.version, '1.0.0');
assert.ok(bundle.size < 35_000, `browser bundle is ${bundle.size} bytes`);
assert.ok(image.size > 30_000, `documentation visual is only ${image.size} bytes`);

console.log(JSON.stringify({
  browserBytes: bundle.size,
  documentation: true,
  imageBytes: image.size,
  version: version.version
}));
