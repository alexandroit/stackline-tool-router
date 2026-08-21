export function canonicalTools() {
  return [
    {
      aliases: ['open pull request', 'new PR'],
      description: 'Create a pull request in a GitHub repository.',
      inputSchema: {
        additionalProperties: false,
        properties: {
          base: { description: 'Target branch', type: 'string' },
          head: { description: 'Source branch', type: 'string' },
          repository: { description: 'Repository owner and name', type: 'string' }
        },
        required: ['repository', 'head'],
        type: 'object'
      },
      name: 'github_create_pull_request',
      namespace: 'github',
      tags: ['git', 'write']
    },
    {
      description: 'List open GitHub issues for a repository.',
      inputSchema: {
        properties: {
          labels: { items: { type: 'string' }, type: 'array' },
          repository: { type: 'string' }
        },
        type: 'object'
      },
      name: 'github_list_issues',
      namespace: 'github',
      tags: ['git', 'read']
    },
    {
      description: 'Send a message to a Slack channel.',
      inputSchema: {
        properties: {
          channel: { description: 'Slack channel identifier', type: 'string' },
          text: { description: 'Message body', type: 'string' }
        },
        type: 'object'
      },
      name: 'slack_send_channel_message',
      namespace: 'slack',
      tags: ['chat', 'write']
    },
    {
      description: 'Search files and documents in Google Drive.',
      inputSchema: {
        properties: { query: { description: 'Drive search expression', type: 'string' } },
        type: 'object'
      },
      name: 'drive_search_files',
      namespace: 'drive',
      tags: ['files', 'read']
    },
    {
      description: 'Create a Jira ticket with a title, priority, and project.',
      inputSchema: {
        properties: {
          priority: { enum: ['low', 'medium', 'high'] },
          project: { type: 'string' },
          title: { type: 'string' }
        },
        type: 'object'
      },
      name: 'jira_create_ticket',
      namespace: 'jira',
      tags: ['project', 'write']
    }
  ];
}

export function providerTools() {
  return {
    anthropic: {
      description: 'Look up current weather for a city.',
      input_schema: { properties: { city: { type: 'string' } }, type: 'object' },
      name: 'weather_lookup'
    },
    gemini: {
      description: 'Search the product catalog.',
      name: 'catalog_search',
      parameters: { properties: { query: { type: 'string' } }, type: 'object' }
    },
    mcp: {
      description: 'Read a customer record.',
      inputSchema: { properties: { id: { type: 'string' } }, type: 'object' },
      name: 'customers.read',
      outputSchema: { properties: { name: { type: 'string' } }, type: 'object' }
    },
    openAIChat: {
      function: {
        description: 'Cancel a calendar event.',
        name: 'calendar_cancel_event',
        parameters: { properties: { event_id: { type: 'string' } }, type: 'object' }
      },
      type: 'function'
    },
    openAIResponses: {
      description: 'Create a calendar event.',
      name: 'calendar_create_event',
      parameters: { properties: { title: { type: 'string' } }, type: 'object' },
      type: 'function'
    }
  };
}
