import { createToolRouter } from '@stackline/tool-router';

const router = createToolRouter([], { onDuplicate: 'replace' });

router.add({
  name: 'customers_find',
  description: 'Find a customer by email.',
  inputSchema: { type: 'object', properties: { email: { type: 'string' } } }
});

router.add({
  name: 'customers_find',
  description: 'Find a customer by email or account identifier.',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
});

const route = router.route('look up the account owner', {
  maxEstimatedTokens: 2_000,
  maxTools: 5,
  pinned: []
});

console.log(route.records.map(({ id, name }) => ({ id, name })));
console.log({
  selected: route.selectedCount,
  estimatedReduction: route.tokenReduction
});
