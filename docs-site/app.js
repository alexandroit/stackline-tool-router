(function () {
  'use strict';

  const api = StacklineToolRouter;
  const catalog = createCatalog();
  const elements = {
    catalogCount: document.getElementById('catalog-count'),
    catalogTokens: document.getElementById('catalog-tokens'),
    copyCode: document.getElementById('copy-code'),
    format: document.getElementById('format'),
    fuzzy: document.getElementById('fuzzy'),
    pinList: document.getElementById('pin-list'),
    query: document.getElementById('query'),
    reduction: document.getElementById('reduction'),
    requestCode: document.getElementById('request-code'),
    resultStatus: document.getElementById('result-status'),
    results: document.getElementById('results'),
    routeButton: document.getElementById('route-button'),
    selectedCount: document.getElementById('selected-count'),
    selectedTokens: document.getElementById('selected-tokens'),
    synonyms: document.getElementById('synonyms')
  };
  let limit = 5;
  let lastCode = '';

  renderPins();
  route();

  elements.routeButton.addEventListener('click', route);
  elements.query.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') route();
  });
  elements.format.addEventListener('change', route);
  elements.fuzzy.addEventListener('change', route);
  elements.synonyms.addEventListener('change', route);
  elements.copyCode.addEventListener('click', function () {
    copy(lastCode, elements.copyCode);
  });
  document.querySelectorAll('[data-limit]').forEach(function (button) {
    button.addEventListener('click', function () {
      limit = Number(button.dataset.limit);
      document.querySelectorAll('[data-limit]').forEach(function (candidate) {
        const selected = candidate === button;
        candidate.classList.toggle('selected', selected);
        candidate.setAttribute('aria-pressed', String(selected));
      });
      route();
    });
  });
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      copy(button.dataset.copy || '', button);
    });
  });

  function route() {
    const definitions = catalog.map(function (tool) {
      return providerDefinition(tool, elements.format.value);
    });
    const router = api.createToolRouter(definitions, {
      fuzzy: elements.fuzzy.checked,
      synonyms: elements.synonyms.checked ? {} : false
    });
    const result = router.route(elements.query.value, {
      maxTools: limit,
      pinned: selectedPins()
    });

    elements.catalogCount.textContent = String(result.catalogSize);
    elements.selectedCount.textContent = String(result.selectedCount);
    elements.catalogTokens.textContent = `${result.catalogEstimatedTokens.toLocaleString()} tok`;
    elements.selectedTokens.textContent = `${result.estimatedTokens.toLocaleString()} tok`;
    elements.reduction.textContent = `${Math.round(result.tokenReduction * 100)}%`;
    elements.resultStatus.textContent = result.selectedCount === 0
      ? 'No relevant definitions'
      : `${result.selectedCount} of ${result.catalogSize}`;
    renderResults(result.matches);
    lastCode = requestCode(result.records, elements.format.value, elements.query.value);
    elements.requestCode.textContent = lastCode;
  }

  function renderPins() {
    const initiallyPinned = new Set(['auth_get_current_user']);
    for (const tool of catalog) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = tool.name;
      input.checked = initiallyPinned.has(tool.name);
      input.addEventListener('change', route);
      const text = document.createElement('span');
      text.textContent = tool.name;
      label.append(input, text);
      elements.pinList.append(label);
    }
  }

  function selectedPins() {
    return Array.from(elements.pinList.querySelectorAll('input:checked'), function (input) {
      return input.value;
    });
  }

  function renderResults(matches) {
    elements.results.replaceChildren();
    if (matches.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'No tool crossed the relevance threshold.';
      row.append(cell);
      elements.results.append(row);
      return;
    }

    for (const match of matches) {
      const row = document.createElement('tr');
      const toolCell = document.createElement('td');
      const name = document.createElement('span');
      name.className = 'tool-name';
      name.title = match.name;
      name.textContent = match.name;
      const provider = document.createElement('span');
      provider.className = 'tool-provider';
      provider.textContent = match.record.namespace || match.record.format;
      toolCell.append(name, provider);

      const evidenceCell = document.createElement('td');
      evidenceCell.className = match.pinned ? 'pinned-label' : 'evidence';
      evidenceCell.textContent = match.pinned
        ? 'always loaded'
        : (match.matchedFields.join(', ') || 'policy');
      const scoreCell = document.createElement('td');
      scoreCell.textContent = match.score === null ? '-' : match.score.toFixed(2);
      const tokenCell = document.createElement('td');
      tokenCell.textContent = String(match.estimatedTokens);
      row.append(toolCell, evidenceCell, scoreCell, tokenCell);
      elements.results.append(row);
    }
  }

  function providerDefinition(tool, format) {
    const metadata = {
      aliases: tool.aliases,
      namespace: tool.namespace,
      tags: tool.tags
    };
    if (format === 'openai-responses') {
      return Object.assign(metadata, {
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      });
    }
    if (format === 'openai-chat') {
      return Object.assign(metadata, {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      });
    }
    if (format === 'anthropic') {
      return Object.assign(metadata, {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
      });
    }
    if (format === 'gemini') {
      return Object.assign(metadata, {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      });
    }
    return Object.assign(metadata, {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
  }

  function requestCode(records, format, query) {
    const names = records.map(function (record) { return record.name; });
    const client = format.indexOf('openai') === 0
      ? 'openai.responses.create'
      : format === 'anthropic'
        ? 'anthropic.messages.create'
        : format === 'gemini'
          ? 'genai.models.generateContent'
          : 'agent.request';
    return `const routed = router.route(${JSON.stringify(query)}, {\n  maxTools: ${limit},\n  pinned: ${JSON.stringify(selectedPins())}\n});\n\n// ${names.length} selected: ${names.join(', ') || 'none'}\nawait ${client}({\n  model: 'your-model',\n  tools: routed.tools\n});`;
  }

  function copy(value, button) {
    const original = button.textContent;
    const done = function () {
      button.textContent = 'Copied';
      window.setTimeout(function () { button.textContent = original; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done, function () {});
    } else {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      done();
    }
  }

  function createCatalog() {
    return [
      tool('auth_get_current_user', 'auth', 'Read the authenticated user and current workspace.', ['auth', 'read'], ['who am I']),
      tool('github_create_pull_request', 'github', 'Create a pull request from one GitHub branch into another.', ['git', 'write'], ['open PR', 'new pull request']),
      tool('github_list_pull_requests', 'github', 'List open pull requests in a GitHub repository.', ['git', 'read']),
      tool('github_create_issue', 'github', 'Create an issue in a GitHub repository.', ['git', 'write']),
      tool('slack_send_channel_message', 'slack', 'Send a message to a Slack channel.', ['chat', 'write'], ['post channel update', 'notify channel']),
      tool('slack_search_messages', 'slack', 'Search Slack message history across channels.', ['chat', 'read']),
      tool('drive_search_files', 'drive', 'Find files and documents in Google Drive.', ['files', 'read']),
      tool('drive_share_file', 'drive', 'Share a Google Drive file with a user or team.', ['files', 'write']),
      tool('jira_create_ticket', 'jira', 'Create a Jira ticket with project and priority.', ['project', 'write']),
      tool('jira_search_tickets', 'jira', 'Search Jira tickets by status and project.', ['project', 'read']),
      tool('calendar_create_event', 'calendar', 'Schedule a calendar event with attendees.', ['calendar', 'write']),
      tool('calendar_find_free_time', 'calendar', 'Find when meeting attendees are available.', ['calendar', 'read']),
      tool('sentry_search_errors', 'sentry', 'Search production errors and exceptions in Sentry.', ['observability', 'read']),
      tool('grafana_query_metrics', 'grafana', 'Query time-series metrics from Grafana.', ['observability', 'read']),
      tool('stripe_create_refund', 'stripe', 'Refund a card payment or Stripe charge.', ['billing', 'write']),
      tool('stripe_list_invoices', 'stripe', 'List customer invoices and payment status.', ['billing', 'read']),
      tool('notion_search_pages', 'notion', 'Search pages and databases in Notion.', ['docs', 'read']),
      tool('email_send_message', 'email', 'Send an email with recipients, subject, and body.', ['email', 'write'])
    ];
  }

  function tool(name, namespace, description, tags, aliases) {
    return {
      aliases: aliases || [],
      description: description,
      inputSchema: {
        additionalProperties: false,
        properties: {
          query: { description: `Input for ${description.toLocaleLowerCase('en-US')}`, type: 'string' }
        },
        type: 'object'
      },
      name: name,
      namespace: namespace,
      tags: tags
    };
  }
}());
