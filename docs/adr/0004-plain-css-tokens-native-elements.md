# 0004. Style with plain CSS and design tokens; build on native HTML elements

- Status: Accepted
- Date: 2026-11-08

## Context

Each app needs its own brand, but the same accessible behavior for dialogs, forms and tables. The first
draft of this ADR chose Tailwind CSS v4 for styling and Radix primitives for behavior.

While building `core-ui`, the components the core needs turned out to be few: buttons, fields, selects,
checkboxes, alerts, cards, tables and a modal dialog. Browsers now handle the hard parts of those
natively: `<dialog>` with `showModal()` traps focus, closes on Escape, has a backdrop and returns focus
to the opener; `<select>` and `<input>` bring their own keyboard and screen reader support.

## Decision

- `core-ui` ships two CSS files: `tokens.css` (CSS variables for color, spacing, radius and type, light
  and dark) and `styles.css` (component classes prefixed `ui-`). `core-shell` adds `styles.css` for the
  layout, prefixed `shell-`.
- Components are thin React wrappers over native elements. They add labels, error messages linked with
  `aria-describedby`, and consistent classes.
- Apps rebrand by overriding tokens in one CSS file. Apps may use Tailwind or any other styling for their
  own pages; the core does not require it.
- When the core needs a component the platform does not provide well (a combobox, a menu with
  submenus), the choice between writing it and adding a library is made in a new ADR.

## Consequences

- No CSS build step and no runtime styling library: the example app's whole stylesheet is under 2 KB
  gzipped.
- Fewer components than a full design system. Apps add their own.
- Native controls look slightly different across browsers; tokens set the colors, borders and spacing.

## Alternatives considered

- **Tailwind v4 + Radix.** Mature and flexible, but two more dependency trees and a build step for
  components the browser already provides.
- **A complete component library (MUI, Mantine, Chakra).** Fast to start, heavy to load and hard to
  rebrand deeply.
