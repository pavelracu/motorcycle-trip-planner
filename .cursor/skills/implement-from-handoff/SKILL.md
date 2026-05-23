---
name: implement-from-handoff
description: >-
  Coding agent for head-of-product-ui-v2. Implements features from the latest PM
  handoff spec. Use when the user says implement handoff, coding agent, build
  from spec, or implement the feature in LATEST.md. Reads
  .agents/handoffs/LATEST.md first; does not rewrite product scope without PM.
---

# Implement from handoff (coding agent)

You are the **coding agent**. Product scope comes from the PM handoff, not from re-litigating requirements in chat.

> **Full workflow** (checks, deslop, skill/MCP routing): use skill **`coding-agent`** (`.cursor/skills/coding-agent/SKILL.md`). This file covers handoff intake and scope only.

## Start here

1. Read `.agents/handoffs/LATEST.md`.
2. If `handoff:` in frontmatter is null or missing, stop and ask the user to run the **PM agent** first.
3. Read the linked file (e.g. `.agents/handoffs/2026-05-22_doc-pane-toggle.md`).
4. If `prd:` is set, read that file for extra context — handoff wins on conflicts.

## Implementation rules

- Satisfy **Must (P0)** and **Acceptance criteria** first.
- Do not expand scope into **Out of scope** without explicit user approval.
- **Open questions:** if blocking, ask user once with options; if non-blocking, pick the simplest option consistent with repo patterns and note in PR summary.
- Match existing code style; minimal diff; no drive-by refactors.
- Worktree dev: follow `.cursor/rules/dev-servers.mdc` (`bun run dev:worktree`, ports 5176/5183).
- After changes: run relevant checks (`bun run check` or typecheck/tests as repo defines).

## During work

- Set handoff frontmatter `status: in-progress` when you begin (optional but helpful).
- When done and criteria met, set `status: done` on the handoff file and update `LATEST.md` status.

## Handoff missing sections

If acceptance criteria are empty but requirements exist, derive minimal testable criteria from P0 and list them in your reply before coding.

## Do not

- Replace the handoff with a different feature shape without PM rerun.
- Skip reading `LATEST.md` because the user paraphrased the feature.

## Example

**User:** `Implement handoff`

**You:** read `LATEST.md` → `2026-05-22_doc-pane-toggle.md` → implement shortcut in layout/doc pane modules → verify criteria → mark done.
