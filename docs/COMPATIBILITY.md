# Compatibility

## Runtime matrix

| Runtime | Support |
| --- | --- |
| Node.js 14.17, 16, 18, 20, 22, 24 | CI artifact smoke test |
| Browsers with ES2018 support | IIFE and ESM builds |
| Deno 1.46 and 2.x | direct ESM runtime test |
| Bun current | direct ESM runtime test |

The package does not use Node.js built-ins at runtime. Browser and edge usage
does not require a shim.

## Module formats

- ESM: `dist/index.js`
- CommonJS: `dist/index.cjs`
- browser global: `dist/index.min.js` as `StacklineToolRouter`
- declarations: `.d.ts`, `.d.mts`, and `.d.cts`

Package exports select matching runtime and declaration files. `publint` and
Are the Types Wrong validate the packed artifact.

## TypeScript

Declarations intentionally avoid syntax newer than TypeScript 3.9. CI installs
the packed package into clean consumers using TypeScript 3.9, 4.7, 4.9, 5.9,
6, and current releases.

`defineTool<T>` preserves the caller's exact inferred type. `ToolRouter<T>`,
`ToolMatch<T>`, and `ToolRouteResult<T>` carry that type through selected
original definitions.

## Provider formats

Recognition is structural and does not require provider SDK packages. Provider
schemas remain opaque after bounded text extraction. A schema accepted by one
provider is not claimed to be accepted by another.

## Versioning

The 1.x line preserves public method names, normalized record fields, stable
error codes, original-definition return behavior, and supported module formats.
Ranking improvements may reorder genuinely ambiguous results and will be
documented in release notes. Removing a runtime, TypeScript line, or provider
shape requires a major release.
