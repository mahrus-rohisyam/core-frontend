# Changelog

All notable changes to the `@mahrus-rohisyam/core-*` packages. They share one version. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Before `v1.0.0`, a minor version may break the public API;
the entry then says how to upgrade.

## Unreleased

First version.

### Added

- `core-config`: strict `tsconfig.base.json`.
- `core-ui`: design tokens for light and dark themes, component styles, and `Button`, `TextField`,
  `SelectField`, `Checkbox`, `Alert`, `Card`, `PageHeader`, `Table`, `Dialog`, `Badge`, `EmptyState`,
  `Spinner`.
- `core-api`: `createApiClient`, `unwrap`, `ApiError`, CSRF handling, types for the core endpoints.
- `core-auth`: `SessionProvider`, `useSession`, `useSignOut`, and the sign-in (with two-factor), sign-up,
  password reset and email confirmation forms.
- `core-shell`: `createCoreApp` with routes, layout, organization switcher, account settings and
  organization settings (members, roles, invitations, API tokens, audit log). Setting up two-factor
  asks for the password.
- `examples/app`: a notes app that runs against `core-backend`'s example.
