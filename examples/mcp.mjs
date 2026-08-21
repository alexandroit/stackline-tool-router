import { createToolRouter, createToolSearch } from '@stackline/tool-router';

const mcpTools = await listToolsFromConnectedServers();
const router = createToolRouter(mcpTools);
const discovery = createToolSearch(router, { target: 'mcp', limit: 5 });

console.log(discovery.definition);
console.log(discovery.execute({ query: 'search error logs' }));

async function listToolsFromConnectedServers() {
  return [
    {
      name: 'sentry_search_errors',
      description: 'Search application errors in Sentry.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
    },
    {
      name: 'grafana_query_metrics',
      description: 'Query time-series metrics in Grafana.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
    }
  ];
}
