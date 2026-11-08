# Contributing

Thanks for helping. Small, focused pull requests are reviewed fastest.

## Before you start

- For a bug, open an issue with the steps to reproduce it, unless it is a security problem: then follow
  [SECURITY.md](SECURITY.md).
- For a new component, feature or dependency, open an issue first. The core stays small on purpose; many
  components belong in the app that needs them.

## Making a change

1. Fork, then branch from `dev`: `git switch -c feature/<short-name> dev`.
2. `npm ci`, then `npm test` and `npm run dev` (the example app needs `core-backend` running on port 8080).
3. Write the test first when you fix a bug.
4. A new dependency needs a row in `docs/dependencies.md` and a maintainer's approval
   (see `.agents/skills/dependency-check/`). Check the example app's bundle size before and after.
5. Add a line under `Unreleased` in `CHANGELOG.md`.
6. Run `npm run typecheck && npm test && npm run build:example` and open a pull request into `dev`.

## Style

- `tsc` must pass with zero errors. No `any`; no `// @ts-ignore`.
- Components use tokens, not raw colors. Every input has a label.
- Comments explain why, not what. Exported names have a doc comment.
- UI copy is short and specific: say what happened and what to do next.
- Commit messages: imperative mood, under 72 characters on the first line, body when the reason is not
  obvious.

## Using coding agents

Agent-written code is welcome and held to the same bar. Read [docs/building-with-ai.md](docs/building-with-ai.md);
`AGENTS.md` holds the rules agents follow in this repository.
