import assert from 'node:assert/strict';

import { createToolRouter } from '@stackline/tool-router';

const tools = [
  functionTool('github_search_code', 'Search code in GitHub repositories.'),
  functionTool('github_create_issue', 'Create a GitHub issue.'),
  functionTool('slack_send_message', 'Send a Slack channel message.')
];
const prompt = 'Create a GitHub issue for the checkout bug';
const route = createToolRouter(tools).route(prompt, { maxTools: 2 });

assert.equal(route.records[0].name, 'github_create_issue');
console.log({ messages: [{ role: 'user', content: prompt }], tools: route.tools });

function functionTool(name, description) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: {} }
    }
  };
}
