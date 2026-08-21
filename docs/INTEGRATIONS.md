# Provider Integration Guide

## OpenAI Responses

Responses tools place `name`, `description`, and `parameters` on the outer
function object. Route the original array and pass `route.tools` directly to
the existing SDK request. See
[`examples/openai-responses.mjs`](../examples/openai-responses.mjs).

## OpenAI Chat Completions

Chat tools wrap the definition in `function`. The router detects that envelope
and returns the original wrapped objects without conversion. See
[`examples/openai-chat.mjs`](../examples/openai-chat.mjs).

## Anthropic Messages

Anthropic uses `input_schema`. No schema rewrite is needed. Route the array and
place the selected definitions in the Messages request. See
[`examples/anthropic.mjs`](../examples/anthropic.mjs).

## Gemini

Pass a `functionDeclarations` envelope or an array of declarations. The
selected original declarations can be placed back into the provider request.
See [`examples/gemini.mjs`](../examples/gemini.mjs).

## MCP

Index the result of connected servers' `tools/list` calls. `createToolSearch`
can also expose compact discovery as an MCP-shaped function while full schemas
remain outside the initial model context. See
[`examples/mcp.mjs`](../examples/mcp.mjs).

## Large and changing catalogs

Use `add`, `remove`, and `replace` for catalogs that change while the process
is running. Count and token budgets are independent, so production policy can
bound both. The package remains a local retrieval layer and never executes a
tool or calls a provider.
