# TODO

## Near term

- Add opt-in multilingual action-synonym packs without increasing the default
  browser bundle.
- Add a serializable precompiled-index format with explicit versioning and
  integrity checks for cold-start-sensitive edge deployments.
- Publish larger community evaluation sets for MCP and enterprise SaaS tool
  catalogs.
- Add optional ranking hooks for application-owned embeddings and rerankers
  while keeping the core deterministic and dependency-free.

## Standards tracking

- Track stable BYOT tool-search contracts in OpenAI and Anthropic APIs before
  adding provider-specific continuation helpers.
- Track MCP tool metadata and schema revisions without changing original tool
  payloads.
- Review Node.js and TypeScript support annually; use a major release for any
  compatibility reduction.

## Non-goals

- Executing tools or granting permissions.
- Silently converting JSON Schema dialects between providers.
- Calling hosted models, embedding services, or vector databases from the core
  package.
