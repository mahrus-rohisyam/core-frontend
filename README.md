# core-frontend

React packages for apps built on [core-backend](https://github.com/mahrus-rohisyam/core-backend): design
tokens and components, a typed API client, sign-in screens, and the app shell with account and
organization settings. Your app adds its own pages; the rest comes from here.

> **Status: `v0.1.0` in development.** The packages work and are tested, including in a browser against
> the Go backend. They are not published to npm yet. Items marked *(planned)* have no code yet.

## Contents

- [What you get](#what-you-get)
- [Quick start](#quick-start)
- [Using it in an app](#using-it-in-an-app)
- [Adding a page](#adding-a-page)
- [Branding](#branding)
- [Developing core-frontend](#developing-core-frontend)
- [Principles](#principles)
- [Documentation](#documentation)
- [Contributing, security and license](#contributing-security-and-license)

## What you get

| Package | Use it for |
|---|---|
| `@mahrus-rohisyam/core-config` | Shared strict TypeScript settings |
| `@mahrus-rohisyam/core-ui` | Design tokens (light and dark) and accessible components on native HTML elements: buttons, fields, selects, tables, dialogs, alerts |
| `@mahrus-rohisyam/core-api` | A typed client for the API, with problem+json errors and the CSRF header built in |
| `@mahrus-rohisyam/core-auth` | Session handling and the sign-in (with two-factor), sign-up, password reset and email confirmation forms |
| `@mahrus-rohisyam/core-shell` | The router and layout, organization switcher, account settings, and organization settings: members, roles, invitations, API tokens, audit log |

The packages build one React single-page app, served by the app's Go binary at `/app/`. The example app's
first screen loads 113 KB of JavaScript (gzipped); settings pages load on demand.

Public, SEO-oriented pages are not part of this repository; a separate Astro-based `core-site` is planned.

Requirements: Node.js 24 or newer with npm 11.19 or newer (for the `min-release-age` setting).

## Quick start

Run the example app against the backend's example app:

```sh
# terminal 1: the Go backend on http://localhost:8080 (see core-backend's README)
cd core-backend && make up && make run

# terminal 2: this repository
git clone https://github.com/mahrus-rohisyam/core-frontend.git
cd core-frontend
npm ci              # install exactly what the lockfile says; install scripts are off
npm run dev         # http://localhost:5173/app/, API calls go to port 8080
```

The first visit asks you to create the first account, which becomes the administrator. Emails
(confirmation, invitations) appear in the backend's log until SMTP is configured.

## Using it in an app

The packages are not on npm yet. Until they are, build them here (`npm run build`) and install from the
folder, or copy `examples/app` into your app's `web/` folder. Once published:

```sh
npm install @mahrus-rohisyam/core-ui @mahrus-rohisyam/core-api \
            @mahrus-rohisyam/core-auth @mahrus-rohisyam/core-shell \
            @tanstack/react-query @tanstack/react-router react react-dom
npm install --save-dev @mahrus-rohisyam/core-config
```

Use the same `.npmrc` policy as this repository:

```ini
save-exact=true
min-release-age=14
ignore-scripts=true
allow-git=none
engine-strict=true
```

### Entry point

```tsx
// web/src/main.tsx
import { createRoot } from "react-dom/client";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createCoreApp } from "@mahrus-rohisyam/core-shell";
import "@mahrus-rohisyam/core-ui/tokens.css";
import "@mahrus-rohisyam/core-ui/styles.css";
import "@mahrus-rohisyam/core-shell/styles.css";
import "./theme.css";

const { App } = createCoreApp({
  appName: "Notes",
  nav: [{ to: "notes", label: "Notes", permission: "notes.read" }],
  routes: (orgRoute) => [
    createRoute({
      getParentRoute: () => orgRoute,
      path: "notes",
      component: lazyRouteComponent(() => import("./notes"), "NotesPage"),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(<App />);
```

Sign-in, account and organization settings work without more code. Build with Vite using
`base: "/app/"` and embed `dist/` in the Go binary (`app.Options.SPA`).

### Upgrading

All `core-*` packages share one version; upgrade them together and read [CHANGELOG.md](CHANGELOG.md) for
every version you skip.

## Adding a page

1. Describe the backend endpoints in your app's OpenAPI file and generate types:
   `npx openapi-typescript openapi.json -o src/schema.ts`.
2. Create a client and write query factories next to the feature:

   ```ts
   export const api = createApiClient<paths>();

   const notesQuery = (org: string) =>
     queryOptions({
       queryKey: ["orgs", org, "notes"],
       queryFn: () => unwrap(api.GET("/api/v1/orgs/{org}/notes", { params: { path: { org } } })),
     });
   ```

3. Build the page from `core-ui` components. `useOrg()` gives the current organization;
   `useCan("notes.write")` hides controls the user cannot use. Show server errors with
   `<FormError error={m.error} />` and `fieldError(m.error, "title")`.
4. Add the route and nav entry as in the entry point above.

[examples/app/src/notes.tsx](examples/app/src/notes.tsx) is a complete page.

## Branding

Override tokens in one CSS file, imported after the core styles; every component and both themes follow:

```css
:root {
  --color-brand: oklch(0.5 0.15 160);
  --font-sans: "Inter", system-ui, sans-serif;
  --radius: 0.375rem;
}
@media (prefers-color-scheme: dark) {
  :root { --color-brand: oklch(0.75 0.13 160); }
}
```

All tokens are in [packages/core-ui/styles/tokens.css](packages/core-ui/styles/tokens.css).

## Developing core-frontend

| Script | Does |
|---|---|
| `npm run dev` | The example app with the packages' source, against the backend on port 8080 |
| `npm run build` | Compile all packages with `tsc` into `dist/` |
| `npm test` | Unit and component tests (Vitest) |
| `npm run typecheck` | Type-check packages, the example app and the tests |
| `npm run build:example` | Production build of the example app |
| `npm run gen:api` | Regenerate `core-api/src/schema.ts` from `../core-backend/api/openapi.json` |
| `npm run audit` | `npm audit` on runtime dependencies |
| `npm run check:unicode` | Reject hidden Unicode characters in tracked files |

Workflow:

1. Branch from `dev`: `git switch -c feature/<short-name> dev`.
2. Change code, add tests, add a line under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).
3. Run `npm run typecheck && npm test && npm run build:example`.
4. Open a pull request into `dev`. Releases go from `dev` to `master`.

When a backend endpoint changes, run `npm run gen:api`; type errors then show every place to update.

Building with a coding agent? The repository includes `AGENTS.md`, `CLAUDE.md`, skills and review
subagents. Read [docs/building-with-ai.md](docs/building-with-ai.md) first.

## Principles

The six shared principles, and what each means in this repository:

| Principle | Here |
|---|---|
| **Light** | Four runtime dependencies (React, TanStack Query and Router, openapi-fetch), each vetted and recorded. Plain CSS, no styling framework. Packages compiled with `tsc` only. First screen under 200 KB of JavaScript gzipped |
| **Scalable** | Server data in TanStack Query with cursor pagination ("Load more"); no global store to outgrow |
| **Clean code** | `tsc --strict` with `noUncheckedIndexedAccess`, zero errors. No `any`, names from the domain |
| **Modular** | Small packages with one-way imports; an app's features live in their own folders with their own routes and queries |
| **Secure by default** | Session in an HttpOnly cookie, CSRF header on every change, no tokens in browser storage, no raw HTML from users, works under a strict CSP, return paths after sign-in limited to the app |
| **No AI slop** | Agents follow `AGENTS.md`, check dependencies first and review their own diffs; UI copy is short and specific |

Decisions behind these are in [docs/adr/](docs/adr/).

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Packages, import rules, routes, data flow, theming, performance, security, testing |
| [docs/adr/](docs/adr/) | Frontend decisions and their reasons |
| [docs/dependencies.md](docs/dependencies.md) | Every direct dependency and why it is here |
| [docs/project/](docs/project/) | Plan, deployment topology and decisions shared by all core repositories |
| [docs/building-with-ai.md](docs/building-with-ai.md) | Working safely with coding agents |

## Contributing, security and license

- [CONTRIBUTING.md](CONTRIBUTING.md) explains branches, commits and review.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.
- Licensed under [MIT](LICENSE).
