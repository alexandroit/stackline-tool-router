import assert from 'node:assert/strict';

import { createToolRouter } from '@stackline/tool-router';

const tools = Array.from({ length: 1_000 }, (_, index) => ({
  name: `service_${index % 20}_resource_${index}_search`,
  description: `Search resource ${index} records in service ${index % 20}.`,
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } }
  }
}));
const router = createToolRouter(tools);
const route = router.route('search resource 742 in service 2', {
  maxEstimatedTokens: 2_000,
  maxTools: 5
});

assert.equal(route.records[0].name, 'service_2_resource_742_search');
assert.ok(route.tokenReduction > 0.9);
console.log({
  catalogTools: router.size,
  selectedTools: route.selectedCount,
  tokenReduction: route.tokenReduction
});
