import { createToolRouter } from '@stackline/tool-router';

const tools = [
  {
    type: 'function',
    name: 'github_create_issue',
    description: 'Create a GitHub issue in a repository.',
    parameters: {
      type: 'object',
      properties: {
        repository: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['repository', 'title'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel.',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['channel', 'text'],
      additionalProperties: false
    }
  }
];

const router = createToolRouter(tools);
const prompt = 'Open an issue for the checkout regression';
const selected = router.route(prompt, { maxTools: 4 });

// Pass selected.tools to the provider SDK without changing the definitions.
const request = {
  model: 'your-model',
  input: prompt,
  tools: selected.tools
};

console.log(request);
