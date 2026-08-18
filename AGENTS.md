# AGENTS.md

Shared brief for agents working in this repo (Cursor, Claude Code, humans driving agents). Deep architecture and live-path detail live in `CLAUDE.md` — do not treat this file as a mirror.

## Co-authors

| Role | How |
|------|-----|
| Maintainer | Git **Author** |
| Cursor | `Co-Authored-By` trailer when Cursor participated |
| Claude | `Co-Authored-By` trailer when Claude participated |

On commits where any agent participated, end the message with a blank line, then both trailers (exact strings):

```
Co-Authored-By: Cursor <cursoragent@cursor.com>
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Trailer emails are convention strings for GitHub co-author display, not real mailboxes.

## Read order

1. `AGENTS.md` (this file) — policy, trailers, hard gotchas
2. `CLAUDE.md` — commands, live vs dead paths, request flows
3. Spec Kit / `.specify` (and `specs/`) when the active feature or constitution applies

## Hard gotchas

1. Live backend entry point is `backend/app/main_agent.py` (`app.main_agent:app`). Confirm reachability from it before editing backend modules.
2. Dead trap: `app/api/sessions.py` looks like chat but is only wired through dead `app/main.py`. Live chat endpoints are inline in `main_agent.py`.
3. Roughly half of `backend/app/` is a dead alternative pipeline — do not edit dead paths expecting runtime effect.
4. Schema ground truth is local `supabase/migrations/` (and local `supabase/`); prose docs often disagree. Code + migrations win.
5. Bare `supabase/` in `.gitignore` — new migrations/edge functions need `git add -f` or they stay untracked.
6. Never read, echo, or commit `.env*` / secrets.
7. Auth is **Clerk**, not Supabase Auth. Dashboard layout resolves role server-side; use `useRole()` — no client role re-fetch.
8. Next.js BFF route handlers use service-role Supabase (bypasses RLS) — always scope with `.eq("user_id", userId)` from Clerk `auth()`.
9. Browser → Next.js same-origin BFF → `${BACKEND_URL}`; do not call the Python backend from the browser.
10. Surgical diffs only — no drive-by refactors, unrelated files, or scope creep.
11. Edit canonical unsuffixed files only (`route.ts`, `page.tsx`); ignore `* 2.tsx` / `*_old.tsx` / duplicate shadow copies.
12. Backend must run from `backend/` (CWD-relative `.env` loading). Frontend uses **npm**, not pnpm/yarn.
13. CI is a placeholder (`echo "CI passed"`) — green checks mean nothing; verify locally.
14. `.gitignore` ignores `*.md` except allowlisted files (`CLAUDE.md`, `AGENTS.md`, vault negations). Do not assume markdown is tracked.
15. Medical honesty: MIDAS is assistive analysis, not a diagnosis product. Do not invent clinical certainty.
16. Do not amend pushed history or force-push without an explicit ask.
17. Do not create `.agents/`; Cursor-local rules stay under gitignored `.cursor/`.

## Branching (sticky)

- **One branch only for Cursor work:** `cursor-fix`.
- Do **not** create throwaway `chore/*`, `feat/*`, or extra git worktrees to ship routine commits/PRs.
- Commit and (when asked) push / open or update **one PR** from `cursor-fix` → default base `ajit`.
- If you are not on `cursor-fix`, check it out or create it from the current sticky tip — do not invent a new branch name.
- Spec Kit feature branches (e.g. `002-…`) are human/spec workflow; Cursor still lands agent commits on `cursor-fix` unless the user explicitly names another branch for that session.

## Commits

- Agent-participated commits: append **both** trailers above (blank line before trailers).
- Commit only when asked; do not push unless asked.
- No `--no-verify` / skip hooks unless explicitly requested.
- Approach A leaves `commit-surgeon` unchanged (Claude-only trailer there until a later alignment); Cursor/human follow this file.

## Non-goals

- Not a full `CLAUDE.md` mirror or substitute.
- Not product / end-user documentation.
- Not an instruction to create `.agents/` or commit `.cursor/`.
- Not a change to application code, `commit-surgeon`, or Claude-side agent packages by itself.
- Not permission to spawn many short-lived branches or worktrees for agent shipping.
