# Releasing

## Preconditions

- Version, changelog, README, docs, and package metadata agree.
- `npm test` passes from a clean install.
- `npm run test:attw` passes on the packed artifact.
- `npm run benchmark` has no unexpected recall regression.
- `npm run audit:dependencies` passes.
- The working tree contains only intended release changes.

## Artifact-first process

1. Run `npm pack --ignore-scripts` once and record its SHA-512 digest.
2. Publish that tarball to the local Verdaccio registry.
3. Install the exact Verdaccio version into a clean consumer and execute ESM,
   CommonJS, and TypeScript smoke tests.
4. Push the reviewed commit and wait for GitHub Actions.
5. Download the CI artifact and compare its package digest.
6. Run `publish.yml` with the local tarball's SHA-512 hex digest. The trusted
   workflow rebuilds the reviewed commit, refuses a digest mismatch, and
   publishes through npm OIDC with provenance.
7. Download the public npm tarball and compare its digest and contents.
8. Create the signed version tag and GitHub Release with package, checksums,
   SBOM, and documentation archive.
9. Deploy documentation and verify canonical, sitemap, robots, AI docs, and the
   live browser workbench.

Do not rebuild between registries. A release is one source commit and one
immutable package artifact.

## Rollback

npm versions are immutable. If a published release is incorrect, deprecate it
with a precise reason, publish a patch, and move `latest` only after the patch
passes the full process. Never replace or silently rewrite an existing version.
