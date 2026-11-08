# 0001. Build one React single-page app; public pages come later from a separate repository

- Status: Accepted
- Date: 2026-11-08

## Context

Apps need an interactive interface behind sign-in. Some also need public pages that search engines index
well (landing, pricing, blog). Building both in one repository from the start doubles the frontend
tooling, the build steps and the things a new contributor must learn, before any app has asked for
public pages.

## Decision

- `core-frontend` supports one React single-page app per product, built with Vite and served by the
  app's Go binary under `/app`. Requests to `/` redirect to `/app` until a public site exists.
- Public, SEO-oriented pages are out of scope for v1. They will come from a separate repository
  (`core-site`, Astro) when an app needs them, served at `/` by the same binary or by any static host.

## Consequences

- One build tool (Vite), one router, one way to fetch data. Faster to learn and to maintain.
- The SPA is not suitable for pages that must rank in search engines. Apps that need those before
  `core-site` exists can add a static page or two in their own repository.
- Keeping the SPA under `/app` from day one means adding a public site later does not change any app URL.

## Alternatives considered

- **Astro site and React SPA in this repository.** Covers SEO now, but adds a second framework that most
  apps would not use yet.
- **Next.js for both.** One framework with server rendering, but needs a Node runtime in production next
  to Go.
- **SPA at `/`.** Shorter URLs, but every app URL would move once a public site is added.
