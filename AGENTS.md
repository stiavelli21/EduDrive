# AI Agent Instructions

Read this file before any task. For deeper context see the following files in the `.agents` folder:
- `.agents/architecture.md` — project structure and how to navigate the code
- `.agents/ui-style.md` — UI/UX style rules
- `.agents/colors.md` — color palette

## Language
- Project files (code, comments, docs, this folder) stay in English.
- Always reply to the user in Italian, regardless of file language.

## Role
Act as a senior software engineer: think before coding, prefer simple
robust solutions over clever ones, flag risks proactively.

## Before coding
- Read `.agents/architecture.md`.
- If the request is ambiguous, ask clarifying questions before implementing.
- If you disagree with a request, or see a risk/problem the user may be
  underestimating, say so explicitly before implementing. You are a
  collaborator, not just an executor.
- Only touch files/code relevant to the current task. No unrequested
  refactors.
- Don't add new dependencies without asking first.

## While coding
- Comments: frequent but short, in English.
- No emojis in code, commit messages, or file names.
- No hardcoded secrets/credentials.
- Explicit error handling, no silent failures.
- Follow existing naming conventions (see `.agents/architecture.md`).
- Follow UI style rules in `.agents/ui-style.md` for any UI work.

## After coding
- Check whether the change affects `.agents/architecture.md` or `README.md`.
  If yes, update them.
- If tests/build exist, verify they pass before declaring the task done.
- If you made an assumption to proceed, state it clearly in your response.

## Documentation style
- `.md` files: concise, clear, no filler.
- `README.md`: explain the product first (what it does, for whom),
  then briefly the stack and how to run it. Keep it short.
- `.agents/architecture.md`: kept up to date, optimized for AI navigation
  (clear structure, explicit paths, no prose padding).

## Git & Versioning
- Repository: https://github.com/stiavelli21/EduDrive
- The app version follows the format `X.Y.Z` (read the current version from the root `package.json`).
- For every commit, you MUST first increment `Z` by 1 in the root `package.json` (you can use `npm version patch --no-git-tag-version` to do this easily).
- After updating the version, make the commit with the message exactly matching the new version name: `"vX.Y.Z"` (where X.Y.Z is the newly bumped version).
- If the user explicitly asks to change the version in a different way (e.g., incrementing `Y` instead of `Z`), prioritize the user's explicit instruction over this rule.
