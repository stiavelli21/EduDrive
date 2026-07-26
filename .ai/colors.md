# Color Palette

## Core tokens
These are the default colors for the app. Use these first.

| Name       | Hex     | Usage                    |
|------------|---------|---------------------------|
| primary    | #3b82f6 | main actions, links        |
| background | #f4f7fc | page/app background        |
| surface    | #ffffff | cards, panels               |
| text       | #0f172a | primary text                |
| muted      | #94a3b8 | secondary text, borders     |
| error      | #ef4444 | errors, destructive actions |
| success    | #10b981 | confirmations                |

## Extended colors
One-off colors used for specific elements, allowed when they harmonize
with the core tokens above (see `ui-style.md` for the rule). Log them
here so the palette stays traceable over time.

| Name | Hex | Used for | Why default tokens didn't fit |
|------|-----|----------|-------------------------------|
|      |     |          |                                 |

## Rules
- Prefer core tokens for anything reused across the app.
- Extended colors are for single, specific elements — not for new
  recurring patterns. If an extended color starts being reused in
  multiple places, promote it to a core token instead.
- Never use raw hex directly in components — always reference a token
  (core or extended) defined here.
