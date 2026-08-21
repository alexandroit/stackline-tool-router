import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { createToolRouter, estimateToolTokens, normalizeTools } from '../src/index.js';
import { collectSchemaText, estimateJsonTokens } from '../src/schema.js';
import { ownEnumerableEntries, ownValue } from '../src/safe.js';

test('does not traverse dangerous keys or pollute Object.prototype', () => {
  delete Object.prototype.polluted;
  const malicious = JSON.parse(`{
    "name": "safe_tool",
    "description": "A safe description",
    "inputSchema": {
      "type": "object",
      "properties": {
        "__proto__": {"polluted": true},
        "constructor": {"prototype": {"polluted": true}},
        "ordinary": {"description": "searchable value", "type": "string"}
      }
    }
  }`);
  const router = createToolRouter([malicious]);
  assert.equal(router.search('searchable value')[0].name, 'safe_tool');
  assert.equal(router.search('polluted').length, 0);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(({}).polluted, undefined);
});

test('does not invoke schema getters while indexing or estimating', () => {
  let invoked = false;
  const schema = { type: 'object' };
  Object.defineProperty(schema, 'description', {
    enumerable: true,
    get() {
      invoked = true;
      return 'secret';
    }
  });
  const tool = { name: 'getter_safe', inputSchema: schema };
  createToolRouter([tool]);
  estimateToolTokens(tool);
  assert.equal(invoked, false);
  assert.equal(ownValue(null, 'x'), undefined);
  assert.equal(ownValue(() => {}, 'x'), undefined);
  assert.deepEqual(ownEnumerableEntries('text'), []);
});

test('rejects cyclic, oversized, and deeply nested definitions', () => {
  const cyclic = { type: 'object' };
  cyclic.self = cyclic;
  assert.throws(() => createToolRouter([{ name: 'cycle', inputSchema: cyclic }]), /JSON-serializable/);

  const deep = { description: 'end' };
  let current = deep;
  for (let index = 0; index < 6; index++) {
    current.child = {};
    current = current.child;
  }
  assert.throws(() => createToolRouter([{ name: 'deep', inputSchema: deep }], {
    maxSchemaDepth: 3
  }), /maxSchemaDepth/);

  const wide = { properties: {} };
  for (let index = 0; index < 20; index++) wide.properties[`field_${index}`] = { type: 'string' };
  assert.throws(() => createToolRouter([{ name: 'wide', inputSchema: wide }], {
    maxSchemaNodes: 5
  }), /maxSchemaNodes/);

  assert.throws(() => createToolRouter([{
    description: 'x'.repeat(101),
    name: 'long'
  }], { maxTextLength: 100 }), /maxTextLength/);
  assert.throws(() => createToolRouter([{ name: 'one' }, { name: 'two' }], { maxTools: 1 }), /maxTools/);
  assert.throws(() => normalizeTools(new Array(100_001)), /maxTools/);
  assert.throws(() => normalizeTools([
    { functionDeclarations: new Array(6) }
  ], { maxTools: 5 }), /maxTools/);
  assert.throws(() => estimateJsonTokens(1n), /bigint/);
});

test('bounds sparse arrays and primitive-heavy schemas by work performed', () => {
  const sparse = new Array(1_000_000);
  assert.throws(() => estimateJsonTokens(sparse, { maxNodes: 100 }), /maxNodes/);
  assert.throws(() => collectSchemaText({
    examples: sparse
  }, { maxSchemaNodes: 100 }), /maxSchemaNodes/);
});

test('covers safe schema extraction and JSON token estimation shapes', () => {
  const sparse = new Array(2);
  sparse[1] = { description: 'nested branch' };
  const schema = {
    allOf: sparse,
    const: 42,
    examples: ['', 7, false],
    properties: {
      field: { description: 'value description', format: 'uuid' }
    }
  };
  const text = collectSchemaText(schema, { maxSchemaDepth: 10, maxSchemaNodes: 100, maxTextLength: 1000 });
  assert.match(text, /nested branch/);
  assert.match(text, /field/);
  assert.match(text, /42/);
  assert.equal(collectSchemaText(null), '');
  assert.equal(collectSchemaText(true), '');
  assert.equal(collectSchemaText({ description: '' }, { maxTextLength: 1 }), '');

  assert.ok(estimateJsonTokens({
    array: [undefined, 'x', true, false, Infinity],
    ignored: undefined,
    ignoredFunction() {},
    ignoredSymbol: Symbol('x'),
    number: 12,
    value: null
  }, { maxDepth: 10, maxNodes: 100 }) > 0);
  assert.equal(estimateJsonTokens(undefined), 1);
  assert.throws(() => estimateJsonTokens({ child: { child: {} } }, { maxDepth: 1 }), /maxDepth/);
  assert.throws(() => estimateJsonTokens({ a: {}, b: {} }, { maxNodes: 1 }), /maxNodes/);
});

test('bounds malformed large searches without catastrophic regex behavior', () => {
  const router = createToolRouter([{
    description: 'Search customer invoices and payment records.',
    inputSchema: { properties: { customer_id: { type: 'string' } }, type: 'object' },
    name: 'billing_search_invoices'
  }], { maxQueryLength: 65_536 });
  const malicious = `${'('.repeat(20_000)}${'a'.repeat(20_000)}${')'.repeat(20_000)}`;
  const started = performance.now();
  const result = router.search(malicious);
  const elapsed = performance.now() - started;
  assert.deepEqual(result, []);
  assert.ok(elapsed < 2000, `large malformed query took ${elapsed.toFixed(1)}ms`);
  assert.throws(() => router.search('x'.repeat(65_537)), /maxQueryLength/);
});

test('rejects malformed custom tokenizer output', () => {
  const nonArray = createToolRouter([], { tokenizer: () => 'word' });
  assert.throws(() => nonArray.add({ name: 'tool' }), /must return an array/);
  const nonString = createToolRouter([], { tokenizer: () => [1] });
  assert.throws(() => nonString.add({ name: 'tool' }), /must be strings/);
  const bounded = createToolRouter([{ name: 'tool' }], {
    tokenizer: () => ['', 'x'.repeat(300), 'safe']
  });
  assert.equal(bounded.search('anything')[0].name, 'tool');
});
