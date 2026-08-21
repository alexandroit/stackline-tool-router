import assert from 'node:assert/strict';
import test from 'node:test';

import { createToolRouter, createToolSearch } from '../src/index.js';
import { canonicalTools } from './fixtures.mjs';

test('creates search definitions for all provider targets', () => {
  const router = createToolRouter(canonicalTools());
  const expected = {
    anthropic: 'input_schema',
    canonical: 'inputSchema',
    gemini: 'parameters',
    mcp: 'inputSchema'
  };
  for (const [target, schemaKey] of Object.entries(expected)) {
    const helper = createToolSearch(router, { target });
    assert.equal(helper.definition.name, 'search_tools');
    assert.ok(helper.definition[schemaKey]);
  }
  const responses = createToolSearch(router, { target: 'openai-responses' });
  assert.equal(responses.definition.type, 'function');
  assert.equal(responses.definition.name, 'search_tools');
  const chat = createToolSearch(router, { target: 'openai-chat' });
  assert.equal(chat.definition.function.name, 'search_tools');
});

test('executes bounded catalog discovery with compact summaries', () => {
  const helper = createToolSearch(createToolRouter(canonicalTools()), {
    description: 'Find capabilities',
    limit: 2,
    name: 'discover_capabilities',
    target: 'mcp'
  });
  assert.equal(helper.definition.name, 'discover_capabilities');
  assert.equal(helper.definition.description, 'Find capabilities');
  const result = helper.execute({ query: 'GitHub pull request', limit: 1 });
  assert.equal(result.catalogSize, 5);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].name, 'github_create_pull_request');
  assert.equal(result.tools[0].namespace, 'github');
  assert.equal(Object.prototype.hasOwnProperty.call(result.tools[0], 'inputSchema'), false);
  assert.ok(Object.isFrozen(result));

  const unnamed = createToolSearch(createToolRouter([{
    description: 'Read status',
    name: 'read_status'
  }]));
  assert.equal(unnamed.execute({ query: 'status' }).tools[0].namespace, undefined);
});

test('validates helper creation and invocation', () => {
  const router = createToolRouter(canonicalTools());
  assert.throws(() => createToolSearch(null), /requires/);
  assert.throws(() => createToolSearch(router, { target: 'other' }), /Unsupported/);
  assert.throws(() => createToolSearch(router, { name: '' }), /non-empty/);
  assert.throws(() => createToolSearch(router, { description: 1 }), /description/);
  assert.throws(() => createToolSearch(router, { limit: 0 }), /between/);
  const helper = createToolSearch(router);
  assert.throws(() => helper.execute(null), /input.query/);
  assert.throws(() => helper.execute({ query: '' }), /input.query/);
  assert.throws(() => helper.execute({ query: 'x', limit: 26 }), /input.limit/);
});
