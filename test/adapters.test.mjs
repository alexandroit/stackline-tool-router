import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TOOL_FORMATS,
  ToolRouterError,
  detectToolFormat,
  normalizeTool,
  normalizeTools
} from '../src/index.js';
import { providerTools } from './fixtures.mjs';

test('detects and normalizes every supported provider format', () => {
  const tools = providerTools();
  const cases = [
    [tools.mcp, 'mcp', 'customers'],
    [tools.openAIChat, 'openai-chat', ''],
    [tools.openAIResponses, 'openai-responses', ''],
    [tools.anthropic, 'anthropic', ''],
    [tools.gemini, 'gemini', '']
  ];
  for (const [tool, format, namespace] of cases) {
    assert.equal(detectToolFormat(tool), format);
    const normalized = normalizeTool(tool);
    assert.equal(normalized.format, format);
    assert.equal(normalized.namespace, namespace);
    assert.equal(normalized.original, tool);
    assert.ok(normalized.inputSchema);
    assert.ok(Object.isFrozen(normalized));
  }
  assert.deepEqual(TOOL_FORMATS, [
    'canonical', 'mcp', 'openai-chat', 'openai-responses', 'anthropic', 'gemini'
  ]);
  assert.equal(normalizeTool(tools.mcp).outputSchema, tools.mcp.outputSchema);
});

test('normalizes canonical metadata and provider envelopes', () => {
  const canonical = {
    aliases: ['find', 'find'],
    description: 'Find a record',
    id: 'custom-id',
    inputSchema: { type: 'object' },
    name: 'records/find',
    namespace: 'records',
    tags: ['read', 'read']
  };
  const normalized = normalizeTool(canonical);
  assert.equal(normalized.format, 'mcp');
  assert.equal(normalized.id, 'custom-id');
  assert.deepEqual(normalized.aliases, ['find']);
  assert.deepEqual(normalized.tags, ['read']);

  const openai = providerTools().openAIResponses;
  assert.equal(normalizeTools({ tools: [openai] })[0].name, 'calendar_create_event');
  const gemini = providerTools().gemini;
  assert.equal(normalizeTools({ functionDeclarations: [gemini] })[0].format, 'gemini');
  assert.equal(normalizeTools([{ functionDeclarations: [gemini] }])[0].name, 'catalog_search');
});

test('supports explicit canonical schemas and format selection', () => {
  const tool = { name: 'plain', schema: { type: 'object' } };
  assert.equal(detectToolFormat(tool), 'canonical');
  assert.equal(normalizeTool(tool, { format: 'canonical' }).inputSchema, tool.schema);
  assert.equal(normalizeTool({ name: 'forced', parameters: {} }, { format: 'gemini' }).format, 'gemini');
});

test('rejects malformed formats without invoking accessors', () => {
  let invoked = false;
  const malicious = {};
  Object.defineProperty(malicious, 'name', {
    enumerable: true,
    get() {
      invoked = true;
      return 'hidden';
    }
  });
  assert.throws(() => normalizeTool(malicious), /Unable to detect/);
  assert.equal(invoked, false);
  assert.throws(() => detectToolFormat(null), /must be an object/);
  assert.throws(() => normalizeTool(null), /must be an object/);
  assert.throws(() => normalizeTool({ name: 'valid' }, null), /options/);
  assert.throws(() => normalizeTool({}), /Unable to detect/);
  assert.throws(() => normalizeTool({ name: '' }), /non-empty/);
  assert.throws(() => normalizeTool({ name: 'x'.repeat(513) }), /512/);
  assert.throws(() => normalizeTool({ name: 'x' }, { format: 'unknown' }), /Unsupported/);
  assert.throws(() => normalizeTool({ type: 'function', function: null }, { format: 'openai-chat' }), /must be an object/);
  assert.throws(() => normalizeTools(null), /catalog/);
  assert.throws(() => normalizeTools([], null), /options/);
  assert.throws(() => normalizeTools({}), /must contain/);
  const sparse = new Array(2);
  assert.deepEqual(normalizeTools(sparse), []);
  const detailed = new ToolRouterError('ERR_DETAILS', 'details', { field: 'name' });
  assert.deepEqual(detailed.details, { field: 'name' });
});
