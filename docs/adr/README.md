# Frontend decisions

Decisions specific to `core-frontend`. Decisions that apply to every repository are in
[../project/adr/](../project/adr/), which also has the template for a new ADR.

| # | Decision | Status |
|---|---|---|
| [0001](0001-react-spa-only.md) | Build one React single-page app; public pages come later from a separate repository | Accepted |
| [0002](0002-npm-workspace-packages.md) | Ship small packages from an npm workspace, compiled with tsc | Accepted |
| [0003](0003-tanstack-router-query.md) | Use TanStack Router and Query with a generated API client | Accepted |
| [0004](0004-plain-css-tokens-native-elements.md) | Style with plain CSS and design tokens; build on native HTML elements | Accepted |
