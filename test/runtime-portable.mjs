const args = globalThis.Deno
  ? globalThis.Deno.args
  : globalThis.process.argv.slice(2);
const input = args[0];
const moduleUrl = input
  ? (input.includes('://') ? input : new URL(input, import.meta.url).href)
  : new URL('../src/index.js', import.meta.url).href;
const { createToolRouter, createToolSearch } = await import(moduleUrl);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tools = [
  {
    name: 'github_create_issue',
    description: 'Create an issue in a GitHub repository.',
    inputSchema: { type: 'object' }
  },
  {
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel.',
    inputSchema: { type: 'object' }
  }
];

const router = createToolRouter(tools);
assert(router.select('open a github ticket')[0] === tools[0], 'expected issue tool');
assert(router.select('post in slack')[0] === tools[1], 'expected Slack tool');

const discovery = createToolSearch(router, { target: 'mcp', limit: 1 });
const result = discovery.execute({ query: 'github issue' });
assert(result.tools.length === 1, 'expected one discovery result');
assert(result.tools[0].name === 'github_create_issue', 'expected issue discovery');

console.log('Portable runtime smoke passed');
