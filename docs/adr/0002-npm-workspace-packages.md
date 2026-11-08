# 0002. Ship small packages from an npm workspace, compiled with tsc

- Status: Accepted
- Date: 2026-11-08

## Context

Apps need different parts of the frontend core: some only want the UI kit and API client, most want the
full shell. One large package would make every change a release of everything and pull in code an app
does not use. The tooling should be what most JavaScript developers already have installed.

## Decision

- `core-frontend` is an npm workspace with packages under `packages/`: `core-config`, `core-ui`,
  `core-api`, `core-auth` and `core-shell`, published to the public npm registry as
  `@mahrus-rohisyam/core-*`.
- Packages are ES modules compiled with `tsc` to JavaScript plus type declarations. No bundler is used
  for the packages; the app's Vite build bundles them.
- All packages share one version and are released together ([project ADR 0004](../project/adr/0004-versioning-and-releases.md)).
- The repository's `.npmrc` enforces the dependency policy:

  ```ini
  save-exact=true        # pin exact versions
  min-release-age=14     # refuse versions published less than 14 days ago (npm 11.19+)
  ignore-scripts=true    # never run install scripts from dependencies
  allow-git=none         # no dependencies fetched from git URLs
  engine-strict=true     # fail on unsupported Node or npm versions
  ```

## Consequences

- Nothing to install beyond Node.js; npm ships with it.
- Apps install only what they use. Tree shaking removes unused components.
- With `ignore-scripts=true`, a dependency that really needs a build step (rare for browser packages)
  must be handled explicitly and documented in `docs/dependencies.md`.
- npm does not isolate `node_modules` as strictly as pnpm, so an undeclared import can work by accident.
  ESLint's `import/no-extraneous-dependencies` rule, or an equivalent check, catches it in CI.
- Package boundaries must be kept: `core-ui` must not import `core-api` or `core-auth`.

## Alternatives considered

- **pnpm workspaces.** Stricter `node_modules`, but one more tool for contributors to install, and npm now
  has the release-age and install-script settings the policy needs.
- **One package.** Simpler to release, but every app takes everything.
- **Bundling packages with tsup or Vite library mode.** Smaller output, but one more tool for little gain
  when the app bundles anyway.
