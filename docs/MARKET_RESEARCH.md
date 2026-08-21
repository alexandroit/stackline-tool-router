# Market Research

Research snapshot: 2026-08-20.

## Market signal

Agent platforms are moving from a few hardcoded functions to catalogs spanning
many services and MCP servers. The resulting bottleneck is no longer only tool
execution; it is deciding which definitions should enter model context.

Anthropic's advanced tool-use engineering report gives a concrete production
shape: 58 tools across five servers consumed about 55,000 tokens before a task,
and its tool-search approach reduced tool-definition token use by 85% while
improving internal selection evaluations. The report recommends dynamic search
for catalogs above roughly ten tools or 10,000 definition tokens:

https://www.anthropic.com/engineering/advanced-tool-use

OpenAI model documentation now lists tool search as a supported Responses API
capability on current tool-capable models, and the API reference describes both
hosted and bring-your-own-tool search configuration:

- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses

MCP defines discoverable tool names, descriptions, input schemas, output
schemas, and annotations. MCP's move toward JSON Schema 2020-12 increases the
amount and richness of metadata a multi-server client may carry:

- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/seps/2106-json-schema-2020-12

The public npm registry also shows that agent infrastructure can become deeply
transitive. On the research date, registry download endpoints reported large
monthly use for the official MCP SDK and related adapters. Counts change over
time and can be checked directly:

- https://api.npmjs.org/downloads/point/last-month/%40modelcontextprotocol%2Fsdk
- https://api.npmjs.org/downloads/point/last-month/%40ai-sdk%2Fmcp
- https://api.npmjs.org/downloads/point/last-month/%40a2a-js%2Fsdk

## Existing approaches

Current solutions generally fall into four groups:

1. Provider-hosted tool search, which is effective but provider- and
   model-specific.
2. MCP proxies that sit between a client and servers and require the MCP SDK.
3. General full-text engines that are capable but do not normalize AI tool
   formats or return routing evidence and budgets.
4. Embedding/vector retrieval, which adds model calls, storage, latency,
   nondeterminism, and operational cost.

The gap is a provider-neutral in-process primitive: accept definitions already
owned by the application, rank them locally, preserve the original payload,
and stay small enough to become a transitive dependency.

## Product thesis

`@stackline/tool-router` targets that gap with:

- zero runtime dependencies;
- no provider SDK or network requirement;
- original-definition preservation;
- provider-shape normalization for retrieval only;
- deterministic lexical ranking with bounded typo handling;
- incremental catalog updates;
- token and tool-count budgets;
- browser, server, edge, Deno, and Bun support.

Potential for very large download volume depends on framework adoption and
transitive use, not only direct installs. No download outcome is guaranteed.
The package is designed around the characteristics that enable broad adoption:
a narrow problem, low integration cost, a stable API, no runtime dependency
risk, and utility across competing AI providers.

## Validation baseline

The repository's transparent 1.0.0 evaluation contains 30 tools and 30 natural
language intents covering GitHub, Slack, Drive, Jira, Calendar, Stripe,
PostgreSQL, Sentry, Grafana, Notion, email, and contacts.

Observed on the maintainer workstation:

- recall@1: 100%;
- recall@5: 100%;
- average estimated token reduction at five selected tools: 85.28%;
- 10,000-tool synthetic build: about 759 ms;
- 10,000-tool query: about 67 ms p50 and 109 ms p95.

The corpus and generator are in `benchmark/benchmark.mjs`. These are transparent
engineering baselines, not claims about every catalog. Production evaluation
must use real tool names, descriptions, aliases, and user requests.
