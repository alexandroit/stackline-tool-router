import assert from 'node:assert/strict';

import { createToolRouter } from '@stackline/tool-router';

const functionDeclarations = [
  declaration('calendar_find_free_time', 'Find shared free time for attendees.'),
  declaration('calendar_create_event', 'Create a calendar event.'),
  declaration('drive_search_files', 'Search Google Drive files.')
];
const prompt = 'Find free time for meeting attendees';
const route = createToolRouter({ functionDeclarations }).route(prompt, { maxTools: 2 });

assert.equal(route.records[0].name, 'calendar_find_free_time');
console.log({ functionDeclarations: route.tools });

function declaration(name, description) {
  return {
    name,
    description,
    parameters: { type: 'object', properties: {} }
  };
}
