# Changelog

All notable changes to this project are documented in this file. The format is
based on Keep a Changelog and the project follows Semantic Versioning.

## [1.0.0] - 2026-08-20

### Added

- Deterministic BM25F-style routing over names, namespaces, aliases, tags,
  descriptions, and JSON Schema text.
- Automatic normalization for MCP, OpenAI Responses, OpenAI Chat, Anthropic,
  Gemini, and canonical tool definitions.
- Bounded prefix completion, typo tolerance, uppercase acronym matching, and
  weighted action-synonym expansion.
- `search`, `select`, and budget-aware `route` APIs with ranking evidence and
  original-definition preservation.
- Incremental `add`, `remove`, `replace`, and `clear` catalog operations.
- Provider-shaped `createToolSearch` discovery helper.
- ESM, CommonJS, browser, TypeScript 3.9+, Deno, and Bun distributions.
- Security limits and regression coverage for prototype pollution, accessors,
  cyclic schemas, oversized input, and malformed long queries.
- Reproducible benchmark corpus, public documentation, CI, CodeQL, package
  smoke tests, and release artifact verification.
