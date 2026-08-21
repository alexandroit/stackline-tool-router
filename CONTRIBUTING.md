# Contributing

Contributions should preserve deterministic routing, provider-shape
compatibility, bounded processing, and zero runtime dependencies.

## Development

```bash
npm install
npm test
npm run test:attw
npm run benchmark
```

Node.js 20.20.0 is the reference development runtime. The CI matrix validates
the published artifact on every supported Node.js line plus Deno, Bun,
CommonJS, ESM, and multiple TypeScript versions.

## Pull requests

- Add a focused regression test for behavior changes.
- Keep provider definitions unchanged unless an API explicitly promises a
  conversion.
- Do not add a runtime dependency without a documented architecture review.
- Report ranking changes against the transparent evaluation corpus.
- Avoid hard timing assertions that become unstable on shared CI runners.
- Update README and architecture documentation for public API changes.

Run `npm test`, `npm run test:attw`, and `npm run audit:dependencies` before
requesting review.

## Security

Do not open public issues for vulnerabilities. Follow SECURITY.md.
