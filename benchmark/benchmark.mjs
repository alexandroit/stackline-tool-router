import { performance } from 'node:perf_hooks';

import { createToolRouter } from '../dist/index.js';

const evaluationTools = [
  tool('github_create_pull_request', 'Create a pull request from one branch into another GitHub branch.', ['git', 'write']),
  tool('github_list_pull_requests', 'List and filter pull requests in a GitHub repository.', ['git', 'read']),
  tool('github_create_issue', 'Open a new issue in a GitHub repository.', ['git', 'write']),
  tool('github_search_code', 'Search source code across GitHub repositories.', ['git', 'read']),
  tool('slack_send_channel_message', 'Send a message to a public or private Slack channel.', ['chat', 'write']),
  tool('slack_search_messages', 'Search message history across Slack workspaces and channels.', ['chat', 'read']),
  tool('slack_create_channel', 'Create a new Slack channel.', ['chat', 'write']),
  tool('drive_search_files', 'Find files and documents in Google Drive.', ['files', 'read']),
  tool('drive_share_file', 'Share a Google Drive file with a user or team.', ['files', 'write']),
  tool('drive_download_file', 'Download the contents of a Google Drive file.', ['files', 'read']),
  tool('jira_create_ticket', 'Create a Jira ticket with project, priority, and assignee.', ['project', 'write']),
  tool('jira_transition_ticket', 'Move a Jira ticket to another workflow status.', ['project', 'write']),
  tool('jira_search_tickets', 'Search Jira tickets with project and status filters.', ['project', 'read']),
  tool('calendar_create_event', 'Schedule a calendar event with attendees and a time range.', ['calendar', 'write']),
  tool('calendar_find_free_time', 'Find a shared free time window for meeting attendees.', ['calendar', 'read']),
  tool('calendar_cancel_event', 'Cancel an existing calendar event.', ['calendar', 'write']),
  tool('stripe_create_refund', 'Refund a Stripe payment or charge.', ['billing', 'write']),
  tool('stripe_list_invoices', 'List customer invoices and payment status in Stripe.', ['billing', 'read']),
  tool('stripe_find_customer', 'Find a Stripe customer by email or identifier.', ['billing', 'read']),
  tool('postgres_query_readonly', 'Run a read-only SQL query against PostgreSQL.', ['database', 'read']),
  tool('postgres_describe_table', 'Describe PostgreSQL table columns and constraints.', ['database', 'read']),
  tool('sentry_search_errors', 'Search application errors and exceptions in Sentry.', ['observability', 'read']),
  tool('sentry_get_issue', 'Read the details and stack trace for a Sentry issue.', ['observability', 'read']),
  tool('grafana_query_metrics', 'Query time-series metrics from Grafana data sources.', ['observability', 'read']),
  tool('notion_search_pages', 'Search pages and databases in Notion.', ['docs', 'read']),
  tool('notion_create_page', 'Create a new Notion page in a workspace.', ['docs', 'write']),
  tool('email_send_message', 'Send an email message with recipients, subject, and body.', ['email', 'write']),
  tool('email_search_messages', 'Search email messages by sender, subject, or date.', ['email', 'read']),
  tool('contacts_find_person', 'Find a person in the contact directory.', ['contacts', 'read']),
  tool('contacts_update_person', 'Update a person in the contact directory.', ['contacts', 'write'])
];

const evaluations = [
  ['open a PR on github', 'github_create_pull_request'],
  ['show open pull requests', 'github_list_pull_requests'],
  ['report a repository bug', 'github_create_issue'],
  ['find this function in source code', 'github_search_code'],
  ['post an update in the team Slack channel', 'slack_send_channel_message'],
  ['look through old slack conversations', 'slack_search_messages'],
  ['make a new chat channel', 'slack_create_channel'],
  ['find the quarterly plan in drive', 'drive_search_files'],
  ['give the finance team access to this drive file', 'drive_share_file'],
  ['download this document', 'drive_download_file'],
  ['open a high priority jira task', 'jira_create_ticket'],
  ['move the ticket to done', 'jira_transition_ticket'],
  ['find unresolved project tickets', 'jira_search_tickets'],
  ['schedule a meeting tomorrow', 'calendar_create_event'],
  ['when is everyone available', 'calendar_find_free_time'],
  ['cancel the meeting', 'calendar_cancel_event'],
  ['refund this card payment', 'stripe_create_refund'],
  ['show unpaid customer invoices', 'stripe_list_invoices'],
  ['look up customer by email in stripe', 'stripe_find_customer'],
  ['run a readonly sql query', 'postgres_query_readonly'],
  ['what columns are in this postgres table', 'postgres_describe_table'],
  ['find production exceptions', 'sentry_search_errors'],
  ['show the stack trace for sentry issue 42', 'sentry_get_issue'],
  ['graph request latency metrics', 'grafana_query_metrics'],
  ['find the launch notes in notion', 'notion_search_pages'],
  ['make a notion page', 'notion_create_page'],
  ['send the customer an email', 'email_send_message'],
  ['find the email from accounting', 'email_search_messages'],
  ['look up Jane in the company directory', 'contacts_find_person'],
  ['change a contact phone number', 'contacts_update_person']
];

const evaluationRouter = createToolRouter(evaluationTools);
let top1 = 0;
let top5 = 0;
let reduction = 0;
const misses = [];
const top1Misses = [];
for (const [query, expected] of evaluations) {
  const route = evaluationRouter.route(query, { maxTools: 5 });
  const names = route.records.map((record) => record.name);
  if (names[0] === expected) top1 += 1;
  else top1Misses.push({ expected, query, returned: names[0] });
  if (names.includes(expected)) top5 += 1;
  else misses.push({ expected, query, returned: names });
  reduction += route.tokenReduction;
}

const largeCatalog = makeLargeCatalog(10_000);
const memoryBefore = process.memoryUsage().heapUsed;
const buildStarted = performance.now();
const largeRouter = createToolRouter(largeCatalog);
const buildMilliseconds = performance.now() - buildStarted;
const memoryBytes = process.memoryUsage().heapUsed - memoryBefore;

const timings = [];
for (let index = 0; index < 200; index++) {
  const query = index % 2 === 0
    ? `create resource ${index % 100} in service ${index % 20}`
    : `search records for tenant ${index % 50}`;
  const started = performance.now();
  largeRouter.route(query, { maxTools: 5 });
  timings.push(performance.now() - started);
}
timings.sort((left, right) => left - right);

console.log(JSON.stringify({
  catalog: {
    buildMilliseconds: round(buildMilliseconds),
    heapMegabytes: round(memoryBytes / 1024 / 1024),
    searchP50Milliseconds: round(percentile(timings, 0.5)),
    searchP95Milliseconds: round(percentile(timings, 0.95)),
    tools: largeRouter.size
  },
  evaluation: {
    averageEstimatedTokenReduction: round(reduction / evaluations.length),
    cases: evaluations.length,
    misses,
    recallAt1: round(top1 / evaluations.length),
    recallAt5: round(top5 / evaluations.length),
    top1Misses,
    tools: evaluationRouter.size
  }
}, null, 2));

function tool(name, description, tags) {
  const namespace = name.split('_', 1)[0];
  return {
    description,
    inputSchema: {
      additionalProperties: false,
      properties: {
        query: { description: `Input for ${description.toLocaleLowerCase('en-US')}`, type: 'string' }
      },
      type: 'object'
    },
    name,
    namespace,
    tags
  };
}

function makeLargeCatalog(size) {
  const tools = [];
  for (let index = 0; index < size; index++) {
    const service = index % 20;
    const resource = index % 100;
    const action = ['create', 'delete', 'get', 'search', 'update'][index % 5];
    tools.push(tool(
      `service_${service}_${action}_resource_${resource}_${index}`,
      `${action} resource ${resource} records for a tenant in service ${service}.`,
      [`service-${service}`, action, `resource-${resource}`]
    ));
  }
  return tools;
}

function percentile(values, position) {
  return values[Math.min(values.length - 1, Math.floor(values.length * position))];
}

function round(value) {
  return Number(value.toFixed(4));
}
