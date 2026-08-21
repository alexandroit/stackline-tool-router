# Changelog

All notable changes to this project are documented in this file. The format is
based on Keep a Changelog and the project follows Semantic Versioning.

## [1.0.1] - 2026-08-21

### Added

- Executable examples for OpenAI Responses, OpenAI Chat, Anthropic, Gemini,
  MCP, dynamic catalogs, and a 1,000-tool catalog.
- Provider integration guide and transparent benchmark methodology.
- Stackline package catalog links and first-party documentation analytics that
  never record tool definitions or user queries.
- Trusted-publishing workflow for provenance-enabled future releases.

### Changed

- Package tarballs now include the public guides and provider examples.
- Documentation version checks now follow package metadata.

No runtime API or declaration behavior changed in this release.

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

[1.0.1]: https://github.com/alexandroit/stackline-tool-router/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/alexandroit/stackline-tool-router/releases/tag/v1.0.0
