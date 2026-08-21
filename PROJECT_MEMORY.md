# Project Memory

## Identity

- Package: `@stackline/tool-router`
- Repository: `alexandroit/stackline-tool-router`
- Public docs: `https://alexandro.net/docs/vanilla/tool-router/`
- Initial public version: `1.0.0`
- License: MIT

## Product decision

The package solves dynamic AI tool discovery before provider invocation. It is
an in-process routing library, not an MCP proxy, model SDK, vector database, or
schema converter. It preserves original definitions by reference and only
normalizes a private retrieval record.

## Compatibility contract

- Zero runtime dependencies is a release invariant for 1.x.
- Node.js 14.17+, ESM, CommonJS, browser, Deno, Bun, and TypeScript 3.9+ are
  validated release surfaces.
- MCP, OpenAI Responses, OpenAI Chat, Anthropic, Gemini, and canonical shapes
  are recognized.
- Provider wire payloads are never silently rewritten.

## Ranking contract

- Names and namespaces have the strongest field weights.
- Literal terms beat synonyms.
- Synonym alternatives contribute at most once per original query term.
- Acronyms are activated only by uppercase query tokens, preventing phrases
  such as `look up` from matching the `update_person` initials.
- Ordering is deterministic: score, then tool name, then tool ID.

## Security contract

- Use `Map` or null-prototype dictionaries for untrusted keys.
- Skip `__proto__`, `prototype`, and `constructor` during traversal.
- Never invoke getters while reading tool definitions.
- Keep schema, text, query, expansion, and catalog limits enabled by default.
- Do not introduce user-built regular expressions.

## Release baseline

- Evaluation corpus: 30 tools and 30 intents, recall@1 and recall@5 both 100%.
- Average estimated token reduction selecting five tools: 85.28%.
- Coverage baseline: 100% lines, functions, and statements; more than 98%
  branches.
- Verdaccio must receive and validate the exact tarball before public npm.
- GitHub Actions, GitHub Release, Verdaccio, and npm artifacts must be compared
  by digest.
