import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ToolRouter,
  ToolRouterError,
  createToolRouter,
  defineTool,
  estimateToolTokens,
  routeTools
} from '../src/index.js';
import { canonicalTools, providerTools } from './fixtures.mjs';

test('routes natural language, acronyms, schema terms, and typos', () => {
  const tools = canonicalTools();
  const router = createToolRouter(tools);
  assert.equal(router.size, 5);
  assert.equal(router.options.k1, 1.2);
  assert.equal(router.search('github_create_pull_request')[0].name, 'github_create_pull_request');
  assert.equal(router.search('open a GitHub PR')[0].name, 'github_create_pull_request');
  assert.equal(router.search('mesage on slak')[0].name, 'slack_send_channel_message');
  assert.equal(router.search('post in slack')[0].name, 'slack_send_channel_message');
  assert.equal(router.search('target branch source branch')[0].name, 'github_create_pull_request');
  assert.equal(router.search('high priority project issue')[0].name, 'jira_create_ticket');
  assert.equal(router.select('find a document in drive')[0], tools[3]);
  assert.deepEqual(router.search('a I'), []);
});

test('returns deterministic matches with explanations and filters', () => {
  const router = new ToolRouter(canonicalTools());
  const match = router.search('github repository', { limit: 1 })[0];
  assert.ok(match.score > 0);
  assert.ok(match.matchedFields.includes('description') || match.matchedFields.includes('schema'));
  assert.ok(match.matchedTerms.includes('github') || match.matchedTerms.includes('repository'));
  assert.ok(match.queryCoverage > 0);
  assert.equal(match.pinned, false);

  assert.equal(router.search('create', { namespaces: 'jira' })[0].record.namespace, 'jira');
  assert.equal(router.search('create', { formats: ['mcp'] }).length > 0, true);
  assert.deepEqual(router.search('create', { formats: ['anthropic'] }), []);
  assert.equal(router.search('create', { ids: 'jira:jira_create_ticket' })[0].name, 'jira_create_ticket');
  assert.equal(router.search('create', { tags: ['git', 'write'] })[0].name, 'github_create_pull_request');
  assert.equal(router.search('create', { filter: (record) => record.namespace === 'jira' })[0].name, 'jira_create_ticket');
  assert.deepEqual(router.search('create', { tags: 'missing' }), []);
  assert.deepEqual(router.search('unknown capability'), []);
  assert.deepEqual(router.search('create', { minScore: 1_000_000 }), []);
});

test('honors result and token budgets', () => {
  const router = createToolRouter(canonicalTools());
  const results = router.search('create write', { limit: 1 });
  assert.equal(results.length, 1);
  const tooSmall = router.search('create write', { maxEstimatedTokens: 1 });
  assert.deepEqual(tooSmall, []);
  assert.throws(() => router.search('create', { limit: 0 }), /limit/);
  assert.throws(() => router.search('create', { minScore: -1 }), /minScore/);
  assert.throws(() => router.search('create', { maxEstimatedTokens: 0 }), /maxEstimatedTokens/);
});

test('routes pinned tools, fallbacks, and token-reduction evidence', () => {
  const tools = canonicalTools();
  const router = createToolRouter(tools);
  const route = router.route('create issue', {
    maxTools: 2,
    pinned: 'slack:slack_send_channel_message'
  });
  assert.equal(route.catalogSize, 5);
  assert.equal(route.selectedCount, 2);
  assert.equal(route.matches[0].pinned, true);
  assert.equal(route.tools[0], tools[2]);
  assert.ok(route.estimatedTokens < route.catalogEstimatedTokens);
  assert.ok(route.tokenReduction > 0);
  assert.equal(route.budgetExceeded, false);

  const pinnedOverBudget = router.route('nothing', {
    maxEstimatedTokens: 1,
    pinned: ['slack_send_channel_message']
  });
  assert.equal(pinnedOverBudget.budgetExceeded, true);
  assert.equal(pinnedOverBudget.selectedCount, 1);

  const boundedPinned = router.route('slack message', {
    maxTools: 1,
    pinned: ['missing', 'slack_send_channel_message', 'slack_send_channel_message']
  });
  assert.equal(boundedPinned.selectedCount, 1);
  const skippedForBudget = router.route('create issue', {
    maxEstimatedTokens: router.get('slack_send_channel_message').original
      ? estimateToolTokens(router.get('slack_send_channel_message').original)
      : 1,
    maxTools: 2,
    pinned: 'slack_send_channel_message'
  });
  assert.equal(skippedForBudget.selectedCount, 1);

  assert.equal(router.route('nothing', { fallback: 'first' }).selectedCount, 1);
  assert.equal(router.route('nothing', { fallback: 'all', maxTools: 2 }).selectedCount, 2);
  assert.equal(router.route('nothing').selectedCount, 0);
  assert.equal(createToolRouter().route('anything').tokenReduction, 0);
  assert.equal(router.route('nothing', { fallback: 'all', maxEstimatedTokens: 1 }).selectedCount, 0);
  assert.throws(() => router.route('nothing', { fallback: 'bad' }), /fallback/);
  assert.throws(() => router.route('nothing', { pinned: 7 }), /pinned/);
});

test('supports incremental updates without stale postings', () => {
  const tools = canonicalTools();
  const router = createToolRouter([tools[0]]);
  assert.equal(router.has('github_create_pull_request'), true);
  assert.equal(router.get('github_create_pull_request').original, tools[0]);
  assert.equal(router.get('missing'), undefined);
  assert.equal(router.list().length, 1);
  router.add(tools[1]);
  assert.equal(router.search('list issues')[0].tool, tools[1]);
  assert.equal(router.remove('github_list_issues'), 1);
  assert.equal(router.search('list issues').length, 0);
  assert.equal(router.remove(['missing']), 0);
  assert.throws(() => router.remove(5), /must be a string/);

  router.replace([tools[2], tools[3]]);
  assert.equal(router.size, 2);
  assert.equal(router.search('pull request').length, 0);
  assert.equal(router.search('slack message')[0].tool, tools[2]);
  const stats = router.stats();
  assert.equal(stats.tools, 2);
  assert.ok(stats.terms > 0);
  assert.ok(stats.estimatedTokens > 0);
  router.clear();
  assert.equal(router.size, 0);
  assert.deepEqual(router.stats().fields, {
    aliases: 0,
    description: 0,
    name: 0,
    namespace: 0,
    schema: 0,
    tags: 0
  });
  assert.equal(router._removeDocument('missing'), false);
});

test('handles duplicates transactionally and supports replacement mode', () => {
  const tool = { name: 'same', description: 'first' };
  const other = { name: 'same', description: 'second' };
  const router = createToolRouter([tool]);
  assert.throws(() => router.add(other), (error) => {
    assert.ok(error instanceof ToolRouterError);
    assert.equal(error.code, 'ERR_TOOL_DUPLICATE');
    return true;
  });
  assert.equal(router.get('same').description, 'first');
  assert.throws(() => createToolRouter([tool, other]), /Duplicate tool id in batch/);

  const replacing = createToolRouter([tool], { onDuplicate: 'replace' });
  replacing.add(other);
  assert.equal(replacing.get('same').description, 'second');

  const bounded = createToolRouter([{ name: 'existing' }], { maxTools: 2 });
  assert.throws(() => bounded.add([{ name: 'new_one' }, { name: 'new_two' }]), /maxTools/);
  assert.deepEqual(bounded.list().map((record) => record.name), ['existing']);

  const sameNames = createToolRouter([
    { id: 'b', name: 'duplicate_name', description: 'shared lookup' },
    { id: 'a', name: 'duplicate_name', description: 'shared lookup' }
  ]);
  assert.equal(sameNames.get('duplicate_name').id, 'a');
  assert.equal(sameNames.search('shared lookup', { limit: 2 })[0].id, 'a');

  const tiedNames = createToolRouter([
    { name: 'beta_action', description: 'shared capability' },
    { name: 'alpha_action', description: 'shared capability' }
  ]);
  assert.equal(tiedNames.search('shared capability', { limit: 2 })[0].name, 'alpha_action');
});

test('accepts provider envelopes and one-shot helpers', () => {
  const providers = providerTools();
  const envelope = { tools: [providers.openAIResponses] };
  const router = createToolRouter(envelope);
  assert.equal(router.search('create calendar event')[0].format, undefined);
  assert.equal(router.search('create calendar event')[0].record.format, 'openai-responses');
  const gemini = createToolRouter({ functionDeclarations: [providers.gemini] });
  assert.equal(gemini.search('product catalog')[0].name, 'catalog_search');

  const route = routeTools(canonicalTools(), 'jira issue', {
    maxTools: 1,
    router: { fuzzy: false }
  });
  assert.equal(route.tools[0].name, 'jira_create_ticket');
  const value = defineTool({ name: 'typed', inputSchema: { type: 'object' } });
  assert.equal(value.name, 'typed');
  assert.ok(estimateToolTokens(value) > 0);
  assert.equal(routeTools(canonicalTools(), 'drive files', { maxTools: 1 }).tools[0].name, 'drive_search_files');

  const explicit = createToolRouter();
  explicit.add({ name: 'plain', schema: { type: 'object' } }, { format: 'canonical' });
  assert.equal(explicit.get('plain').format, 'canonical');
});

test('validates router and search options', () => {
  assert.throws(() => createToolRouter([], null), /options/);
  assert.throws(() => createToolRouter([], { tokenizer: 'bad' }), /tokenizer/);
  assert.throws(() => createToolRouter([], { onDuplicate: 'merge' }), /onDuplicate/);
  assert.throws(() => createToolRouter([], { synonyms: 'bad' }), /synonyms/);
  assert.throws(() => createToolRouter([], { synonyms: { find: 7 } }), /synonyms.find/);
  assert.throws(() => createToolRouter([], { b: 2 }), /between/);
  assert.throws(() => createToolRouter([], { fieldWeights: { name: -1 } }), /fieldWeights/);
  const router = createToolRouter(canonicalTools(), { fuzzy: false });
  assert.deepEqual(router.search('slak'), []);
  assert.throws(() => router.search(null), /must be a string/);
  assert.throws(() => router.search('create', { ids: 7 }), /filters/);
  assert.throws(() => router.search('create', { filter: true }), /filter/);
  assert.equal(router.has(42), false);

  const zeroWeights = createToolRouter([{ name: 'invisible' }], {
    fieldWeights: { aliases: 0, description: 0, name: 0, namespace: 0, schema: 0, tags: 0 }
  });
  assert.deepEqual(zeroWeights.search('invisible'), []);

  const expansions = createToolRouter([
    { name: 'message' },
    { name: 'massage' },
    { name: 'credit' },
    { name: 'create' }
  ]);
  assert.ok(expansions._expand('mssage').size >= 2);
  assert.equal(expansions._expand('cre').size, 2);

  const noSynonyms = createToolRouter([{ name: 'send_message' }], { synonyms: false });
  assert.deepEqual(noSynonyms.search('post'), []);
  const customSynonyms = createToolRouter([{ name: 'archive_record' }], {
    synonyms: { store: ['ARCHIVE'] }
  });
  assert.equal(customSynonyms.search('store')[0].name, 'archive_record');

  const equalSynonyms = createToolRouter([{ name: 'send_publish' }]);
  assert.equal(equalSynonyms.search('post')[0].name, 'send_publish');
});
