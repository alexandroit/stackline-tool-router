# @stackline/tool-router

[![npm version](https://img.shields.io/npm/v/@stackline/tool-router.svg)](https://www.npmjs.com/package/@stackline/tool-router)
[![npm downloads](https://img.shields.io/npm/dm/@stackline/tool-router.svg)](https://www.npmjs.com/package/@stackline/tool-router)
[![CI](https://github.com/alexandroit/stackline-tool-router/actions/workflows/ci.yml/badge.svg)](https://github.com/alexandroit/stackline-tool-router/actions/workflows/ci.yml)
[![CodeQL](https://github.com/alexandroit/stackline-tool-router/actions/workflows/codeql.yml/badge.svg)](https://github.com/alexandroit/stackline-tool-router/actions/workflows/codeql.yml)
[![license](https://img.shields.io/npm/l/@stackline/tool-router.svg)](LICENSE)

Route a user request to the smallest relevant subset of an AI tool catalog.
The router is local, deterministic, zero-dependency, and understands MCP,
OpenAI, Anthropic, Gemini, and provider-neutral definitions.

```bash
npm install @stackline/tool-router
```

## Quick start

```js
import { createToolRouter } from '@stackline/tool-router';

const tools = [
  {
    type: 'function',
    name: 'github_create_issue',
    description: 'Create a GitHub issue in a repository.',
    parameters: {
      type: 'object',
      properties: {
        repository: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['repository', 'title'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel.',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['channel', 'text'],
      additionalProperties: false
    }
  }
];

const router = createToolRouter(tools);
const prompt = 'Open an issue for the checkout regression';
const routed = router.route(prompt, { maxTools: 4 });

// The original OpenAI definitions are returned by reference.
const response = await openai.responses.create({
  model: 'your-model',
  input: prompt,
  tools: routed.tools
});
```

No provider SDK is required by the package. Route first, then pass
`routed.tools` to the SDK already used by the application.

## Why route tools

Large tool catalogs create three practical problems:

- definitions consume context before the task starts;
- similar tools become harder for a model to distinguish;
- sending every schema increases request size, latency, and cost.

`@stackline/tool-router` builds an in-memory BM25F-style index over names,
namespaces, aliases, tags, descriptions, and JSON Schema text. It adds bounded
prefix matching, typo tolerance, uppercase acronym recognition, and a small
action-synonym layer. Literal name and namespace matches remain stronger than
synonym matches.

The router never calls a model, embedding endpoint, database, or network
service. The same catalog and query produce the same ordering.

## Supported definitions

| Source | Recognized shape | Returned by `route()` |
| --- | --- | --- |
| MCP | `{ name, inputSchema }` | original MCP tool |
| OpenAI Responses | `{ type: 'function', name, parameters }` | original Responses tool |
| OpenAI Chat | `{ type: 'function', function: { ... } }` | original Chat tool |
| Anthropic | `{ name, input_schema }` | original Anthropic tool |
| Gemini | `{ name, parameters }` or `functionDeclarations` | original Gemini declaration |
| Canonical | `{ name, inputSchema }` or `{ name, schema }` | original object |

Provider envelopes are accepted directly:

```js
const openaiRouter = createToolRouter({ tools: openaiTools });
const geminiRouter = createToolRouter({ functionDeclarations });
```

Keep one provider-compatible catalog per outbound request. The package
normalizes definitions for retrieval; it does not rewrite JSON Schema dialects
or convert one provider's wire format into another.

## Search and route

Use `search` when ranking evidence matters:

```js
const matches = router.search('post the release note in Slack', {
  limit: 5,
  namespaces: ['slack'],
  tags: ['write']
});

for (const match of matches) {
  console.log(match.name, match.score, match.matchedFields);
}
```

Use `select` for only the original definitions:

```js
const tools = router.select('find the Q4 plan in Drive', { limit: 3 });
```

Use `route` for production request controls:

```js
const result = router.route(userMessage, {
  maxTools: 6,
  maxEstimatedTokens: 4_000,
  pinned: ['auth_get_current_user'],
  fallback: 'none'
});

console.log({
  selected: result.selectedCount,
  estimatedTokens: result.estimatedTokens,
  estimatedReduction: result.tokenReduction
});
```

Pinned tools are always included before ranked tools. If pinned definitions
exceed the token budget, `budgetExceeded` is `true`; explicit policy is never
silently discarded.

Token counts are transparent estimates based on JSON character length divided
by four. They are useful for relative budgets, not a replacement for a
provider-specific tokenizer.

## Dynamic catalogs

Updates maintain postings and document frequencies without rebuilding the
router:

```js
const router = createToolRouter([], { onDuplicate: 'replace' });

router.add(tool);
router.add(updatedTool); // replaces the same id
router.remove('github_create_issue');
router.replace(await loadCurrentCatalog());
router.clear();
```

By default, duplicate IDs throw `ERR_TOOL_DUPLICATE`. Tool IDs use an explicit
`id` when present, otherwise `namespace:name`, otherwise `name`.

## BYOT discovery helper

`createToolSearch` creates a compact search function and an executor for
bring-your-own-tool discovery loops:

```js
import { createToolSearch, createToolRouter } from '@stackline/tool-router';

const router = createToolRouter(mcpTools);
const discovery = createToolSearch(router, {
  target: 'mcp',
  limit: 5
});

console.log(discovery.definition);
console.log(discovery.execute({ query: 'search production errors' }));
```

Targets are `canonical`, `mcp`, `openai-responses`, `openai-chat`,
`anthropic`, and `gemini`. The executor returns compact summaries, not full
schemas. Applications decide how selected tools are admitted into the next
model request.

## Ranking controls

Default field weights favor intent-bearing identifiers:

| Field | Weight |
| --- | ---: |
| name | 10 |
| namespace | 8 |
| aliases | 7 |
| tags | 5 |
| description | 2 |
| schema | 1 |

Override only what the catalog needs:

```js
const router = createToolRouter(tools, {
  fieldWeights: {
    tags: 8,
    schema: 2
  },
  fuzzy: true,
  k1: 1.2,
  b: 0.75
});
```

The built-in English action synonyms cover common tool verbs such as
`find/search`, `send/post`, `create/open`, and `change/update`. Extend them:

```js
const router = createToolRouter(tools, {
  synonyms: {
    archive: ['store', 'retain'],
    deploy: ['release', 'ship']
  }
});
```

Set `synonyms: false` for literal-only retrieval. Custom tokenizers are also
supported and receive both indexed text and queries.

## Catalog metadata

Canonical metadata improves routing without changing provider payloads:

```js
const tool = {
  id: 'github:pull-request:create',
  namespace: 'github',
  tags: ['git', 'write'],
  aliases: ['open pull request', 'new PR'],
  name: 'github_create_pull_request',
  description: 'Create a pull request from one branch into another.',
  inputSchema: { type: 'object', properties: {} }
};
```

For provider definitions, metadata can be placed on the outer tool object.
The original object is returned unchanged and by reference.

## API

| Export | Purpose |
| --- | --- |
| `createToolRouter(tools, options)` | build a mutable in-memory router |
| `router.search(query, options)` | ranked matches with evidence |
| `router.select(query, options)` | original tool definitions only |
| `router.route(query, options)` | selected tools plus budget metrics |
| `router.add/remove/replace/clear` | update a live catalog |
| `router.get/list/has/stats` | inspect the normalized catalog |
| `routeTools(tools, query, options)` | one-shot routing helper |
| `createToolSearch(router, options)` | provider-shaped discovery function |
| `normalizeTool/normalizeTools` | inspect canonical retrieval records |
| `detectToolFormat(tool)` | detect a supported provider shape |
| `estimateToolTokens(tool)` | bounded provider-neutral size estimate |
| `tokenize/normalizeText` | use the default text pipeline directly |

Every validation error is a `ToolRouterError` with a stable `code` beginning
with `ERR_TOOL_`.

## Evaluation and performance

The repository includes the complete corpus and benchmark command:

```bash
npm run benchmark
```

The 1.0.0 release baseline on the maintainer workstation:

- 30-tool, 30-query transparent intent corpus: recall@1 `100%`, recall@5 `100%`;
- average estimated catalog-token reduction when selecting five tools: `85.28%`;
- 10,000-tool synthetic catalog: build about `759 ms`;
- 10,000-tool catalog search: about `67 ms` p50 and `109 ms` p95.

These numbers are implementation baselines, not universal guarantees. Hardware,
catalog vocabulary, descriptions, aliases, and query distribution materially
change the result. Run the included benchmark with representative tools before
choosing production limits.

## Security and limits

Tool definitions are untrusted input. The implementation:

- uses `Map` and null-prototype records for internal dictionaries;
- ignores `__proto__`, `prototype`, and `constructor` during schema traversal;
- reads own data properties without invoking getters;
- detects cyclic JSON definitions;
- bounds catalog size, schema depth, schema nodes, text, query length, token
  expansion, and edit distance;
- uses no user-built regular expressions and no catastrophic-backtracking
  patterns;
- has zero runtime dependencies and performs no network access.

Defaults are intended for ordinary provider schemas. Raise limits only for a
catalog that has already been validated. See [SECURITY.md](SECURITY.md) for
private vulnerability reporting.

## Compatibility

- Node.js 14.17 and newer;
- ESM and CommonJS;
- browsers through the `StacklineToolRouter` global build;
- TypeScript 3.9 through current releases;
- Deno and Bun through the ESM build;
- no runtime dependencies.

Detailed runtime and declaration guarantees are in
[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Documentation

- [Live routing workbench](https://alexandro.net/docs/vanilla/tool-router/)
- [Architecture](docs/ARCHITECTURE.md)
- [Market research](docs/MARKET_RESEARCH.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
