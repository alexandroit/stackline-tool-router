import { fail } from './errors.js';

const SEARCH_SCHEMA = Object.freeze({
  additionalProperties: false,
  properties: {
    limit: {
      description: 'Maximum number of matching tool summaries to return.',
      maximum: 25,
      minimum: 1,
      type: 'integer'
    },
    query: {
      description: 'Capability, action, service, or resource needed for the task.',
      minLength: 1,
      type: 'string'
    }
  },
  required: ['query'],
  type: 'object'
});

function definitionFor(target, name, description) {
  if (target === 'openai-responses') {
    return { type: 'function', name, description, parameters: SEARCH_SCHEMA };
  }
  if (target === 'openai-chat') {
    return { type: 'function', function: { name, description, parameters: SEARCH_SCHEMA } };
  }
  if (target === 'anthropic') return { name, description, input_schema: SEARCH_SCHEMA };
  if (target === 'gemini') return { name, description, parameters: SEARCH_SCHEMA };
  if (target === 'mcp') return { name, description, inputSchema: SEARCH_SCHEMA };
  if (target === 'canonical') return { name, description, inputSchema: SEARCH_SCHEMA };
  fail('ERR_TOOL_FORMAT', `Unsupported search tool target: ${String(target)}`);
}

export function createToolSearch(router, options = {}) {
  if (!router || typeof router.search !== 'function') {
    fail('ERR_TOOL_ROUTER', 'createToolSearch requires a ToolRouter instance');
  }
  const target = options.target === undefined ? 'canonical' : options.target;
  const name = options.name === undefined ? 'search_tools' : options.name;
  const description = options.description === undefined
    ? 'Find the smallest set of available tools relevant to a capability or task.'
    : options.description;
  if (typeof name !== 'string' || name.length === 0) fail('ERR_TOOL_NAME', 'Search tool name must be a non-empty string');
  if (typeof description !== 'string') fail('ERR_TOOL_DEFINITION', 'Search tool description must be a string');
  const defaultLimit = options.limit === undefined ? 5 : options.limit;
  if (!Number.isInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > 25) {
    fail('ERR_TOOL_ROUTER_OPTION', 'Search tool limit must be an integer between 1 and 25');
  }

  const definition = definitionFor(target, name, description);
  return Object.freeze({
    definition,
    execute(input) {
      if (!input || typeof input !== 'object' || typeof input.query !== 'string' || input.query.length === 0) {
        fail('ERR_TOOL_QUERY', 'Search tool input.query must be a non-empty string');
      }
      const limit = input.limit === undefined ? defaultLimit : input.limit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
        fail('ERR_TOOL_QUERY', 'Search tool input.limit must be an integer between 1 and 25');
      }
      const matches = router.search(input.query, { limit });
      return Object.freeze({
        catalogSize: router.size,
        query: input.query,
        tools: Object.freeze(matches.map((match) => Object.freeze({
          description: match.record.description,
          id: match.id,
          name: match.name,
          namespace: match.record.namespace || undefined,
          score: match.score,
          tags: match.record.tags
        })))
      });
    }
  });
}
