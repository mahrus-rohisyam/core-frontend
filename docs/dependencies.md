# Dependencies

Every direct dependency, why it is here and who approved it. Add a row in the same commit that adds
the dependency (see `.agents/skills/dependency-check/`). Remove the row when the dependency goes.

| Package | Version | Why | Approved by | Date |
|---|---|---|---|---|
| `react`, `react-dom` | 19.3.1 | The UI library this repository is built for (peer dependency of the packages) | maintainer | 2026-11-08 |
| `@tanstack/react-query` | 5.104.5 | Server state: caching, refetching, invalidation ([ADR 0003](adr/0003-tanstack-router-query.md)) | maintainer | 2026-11-08 |
| `@tanstack/react-router` | 1.170.46 | Typed routes, search params and route guards ([ADR 0003](adr/0003-tanstack-router-query.md)) | maintainer | 2026-11-08 |
| `openapi-fetch` | 0.17.0 | Typed `fetch` wrapper driven by the OpenAPI types; one small dependency | maintainer | 2026-11-08 |
| `typescript` (dev) | 5.9.3 | Compiler and type checker. 7.x skipped: `openapi-typescript` needs 5.x | maintainer | 2026-11-08 |
| `vite` (dev) | 8.3.5 | Builds and serves the example app. `@vitejs/plugin-react` is not used: Vite compiles TSX itself | maintainer | 2026-11-08 |
| `vitest` (dev) | 5.0.5 | Test runner | maintainer | 2026-11-08 |
| `jsdom` (dev) | 30.1.3 | Browser environment for component tests | maintainer | 2026-11-08 |
| `@testing-library/react`, `@testing-library/dom` (dev) | 16.3.3, 10.4.2 | Render components and query them the way a user would | maintainer | 2026-11-08 |
| `openapi-typescript` (dev) | 7.13.0 | Generates `core-api/src/schema.ts` from the backend's OpenAPI description | maintainer | 2026-11-08 |
| `@types/react`, `@types/react-dom` (dev) | 19.3.0 | React type definitions | maintainer | 2026-11-08 |

All versions were at least 14 days old when added, none has an install script, and `npm audit` reported
no vulnerabilities. Every package is MIT licensed except `typescript` (Apache-2.0). Not used, to stay
light: Tailwind, Radix, ESLint and Prettier ([ADR 0004](adr/0004-plain-css-tokens-native-elements.md)).
