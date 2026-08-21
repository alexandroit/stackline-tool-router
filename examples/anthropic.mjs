import { createToolRouter } from '@stackline/tool-router';

const tools = [
  {
    name: 'drive_search_files',
    description: 'Search files in Google Drive.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  },
  {
    name: 'calendar_create_event',
    description: 'Schedule a calendar event with attendees.',
    input_schema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title']
    }
  }
];

const prompt = 'Find the Q4 plan in Drive';
const { tools: selectedTools } = createToolRouter(tools).route(prompt, { maxTools: 3 });

console.log({
  model: 'your-model',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
  tools: selectedTools
});
