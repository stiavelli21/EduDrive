# UI Style

## Principles
- Minimal: no unnecessary elements, no decoration without function.
- Every screen must stay intuitive: minimal does not mean unclear. If
  reducing an element hurts usability, keep it and flag the tradeoff.
- Consistency over novelty: reuse existing patterns/components before
  creating new ones.

## Rules
- Spacing: Tailwind CSS defaults via variables (e.g., --radius-sm, --radius-md, --radius-lg)
- Typography: "Inter", system-ui, -apple-system, sans-serif
- Components: Custom glassmorphism, see `frontend/src/index.css` and `frontend/src/components`

## Colors
- Default: use the tokens defined in `colors.md` for most UI elements
  (backgrounds, text, primary actions, states).
- Exceptions allowed: a new color can be introduced for a specific
  element (e.g. a single button, a badge, an accent) when it serves a
  clear purpose, as long as it visually harmonizes with the existing
  palette (similar saturation/lightness family, no clashing hues).
- Any new color introduced this way must be added to the "Extended
  colors" section in `colors.md`, with the element it's used for.
- Never invent a color that duplicates or nearly duplicates an existing
  token — reuse the token instead.

## Before adding a new UI pattern
Check if an existing component/pattern already covers the need. If not,
propose it before implementing and explain why the existing ones don't
fit.
