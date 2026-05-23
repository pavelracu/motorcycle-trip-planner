---
name: coding-agent
description: >-
  Full coding workflow for head-of-product-ui-v2: implement from PM handoff,
  route to stack-specific skills/MCPs, run checks, deslop, optional verify/review.
  Use for "Coding agent", "Implement handoff", build from LATEST.md, or after PM
  handoff when quality and routing matter.
---

# Coding agent (implement + quality)

You are the **coding agent** for this repo. Product scope comes from the PM handoff; quality and routing come from this skill.

**Handoff steps:** follow `.cursor/skills/implement-from-handoff/SKILL.md` for reading `LATEST.md`, scope rules, and status updates. This skill adds **phases**, **skill/MCP routing**, and **deslop**.

## Stack (this repo)

| Layer | Choice |
| --- | --- |
| Runtime | Bun |
| Frontend | React 18 + TypeScript (strict) + Vite 6 |
| Styling | Tailwind CSS v4 |
| Chat UI | `@assistant-ui/react` (+ markdown, UI primitives) |
| Backend | Hono (`server/`) |
| State | Zustand |
| Editor | TipTap |
| Analytics | PostHog (`posthog-node` server; instrument via PostHog skills) |
| Checks | `bun run check` (tsc -b + design-system script), `bun test src` |
| Dev (worktree) | `bun run dev:worktree` — ports **5176** / **5183** (see `.cursor/rules/dev-servers.mdc`) |

Do not run plain `bun run dev` in this worktree.

## Workflow phases

Execute in order unless the user asks to skip a phase.

### Phase 0 — Handoff

1. Read `.agents/handoffs/LATEST.md` and linked handoff (and `prd:` if set).
2. If no handoff, stop and ask user to run **PM agent** first.
3. Optional: set handoff `status: in-progress`.

### Phase 1 — Implement (iteration 1)

- Satisfy **Must (P0)** and **Acceptance criteria** first; respect **Out of scope**.
- Minimal diff; match existing patterns; no drive-by refactors.
- Use **Skill routing** below when touching those areas.

### Phase 2 — Compile & test

1. Run **`bun run check`** (required after TS/React changes).
2. Run **`bun test src`** when logic, hooks, or adapters changed.
3. If failures: follow skill **`check-compiler-errors`** (cursor-team-kit) — fix by file, re-run until clean or blocked.

### Phase 3 — Deslop (required after iteration 1)

After the first implementation pass and checks, run a **deslop** pass:

1. Read and follow skill **`deslop`** (cursor-team-kit plugin).
2. Review diff vs `main` (or merge base): remove unnecessary comments, defensive noise, `any` casts, nested code that fights local style.
3. Re-run **`bun run check`** (and tests if you changed behavior paths).

Do not skip deslop because checks passed — slop is often type-clean.

### Phase 4 — Verify & review (optional)

| Trigger | Skill |
| --- | --- |
| User wants proof a criterion works | **`verify-this`** (cursor-team-kit) — falsifiable claim + baseline/treatment |
| UI change needs visual confirmation | **`cursor-ide-browser`** MCP (see below) + acceptance criteria |
| React perf / waterfalls / bundle concerns | **`vercel-react-best-practices`** |
| React architecture / hooks / state smell | **`typescript-react-reviewer`** |
| PR-ready structured review | **`review-and-ship`** (cursor-team-kit) |

### Phase 5 — Done

- Mark handoff `status: done` when acceptance criteria are met.
- Update `LATEST.md` status.
- Reply with: what shipped, checks run, deslop summary (1–2 sentences), open questions left.

## Skill routing

Read the **`SKILL.md`** for the row you need; do not paste entire external skills into the repo.

### assistant-ui (chat, thread, composer, tools)

| Situation | Skill (global / Claude plugins path) |
| --- | --- |
| New integration or package versions | `setup` |
| ThreadPrimitive, ComposerPrimitive, MessagePrimitive | `primitives` |
| Runtime, thread state, adapters | `runtime` |
| Tool registration / tool UI | `tools` |
| Streaming / assistant-stream | `streaming` |
| Thread list / multi-thread | `thread-list` |
| Cloud persistence / auth | `cloud` |
| Version bumps / breaking changes | `update` |
| General architecture | `assistant-ui` |

**MCP (optional, not in repo by default):** `@assistant-ui/mcp-docs-server` — add to `.cursor/mcp.json` per [assistant-ui LLM docs](https://www.assistant-ui.com/docs/llm). Tools: `assistantUIDocs`, `assistantUIExamples`. Prefer MCP when API/docs are uncertain; prefer local skills when editing known patterns in `src/components/chat/`, `HopThread`, `ModelComposer`, etc.

### PostHog (after feature ships or user asks)

| Situation | Skill |
| --- | --- |
| New user-visible actions | `instrument-product-analytics` |
| Feature flags | `instrument-feature-flags` |
| LLM/agent paths | `instrument-llm-analytics` |
| Errors | `instrument-error-tracking` |
| Logs | `instrument-logs` |
| Node server (`server/`) | repo `.claude/skills/integration-javascript_node` |

### UI / visual polish (Grains design language)

| Situation | Skill |
| --- | --- |
| Spacing, typography hierarchy, motion, chrome reduction, UI audit | **`ui-ux-agent`** (project) — Three Principles + `docs/tokens.md` |
| Greenfield marketing page outside repo tokens | `frontend-design` — reconcile to paper-and-ink before merge |

### TypeScript / React quality

| Situation | Skill |
| --- | --- |
| Typecheck/build failures | `check-compiler-errors` |
| Post-implementation cleanup | `deslop` |
| Performance patterns | `vercel-react-best-practices` |
| Component/hook review | `typescript-react-reviewer` |
| Claim needs evidence | `verify-this` |

### PM boundary

- Do not change product scope without PM rerun. For specs only, user invokes **`product-manager-agent`**.

## MCP routing (enabled in this workspace)

| MCP | When to use |
| --- | --- |
| **cursor-ide-browser** | Verify UI on `http://localhost:5176` after `dev:worktree`; click flows, snapshots, regressions. Lock tab → interact → unlock. Confirm both 5176 and 5183 respond before claiming ready. |
| **cursor-app-control** | Open handoff/spec in editor (`open_resource`), move agent to another root — not for routine feature work. |

**Not installed here (document for user):** `assistant-ui` MCP — recommend `npx add-mcp @assistant-ui/mcp-docs-server -a cursor` when building unfamiliar assistant-ui APIs.

## Do not

- Replace handoff scope without PM.
- Skip `LATEST.md` because the user paraphrased the feature.
- Skip Phase 3 deslop after iteration 1.
- Duplicate cursor-team-kit or assistant-ui skill bodies in repo files.

## Example

**User:** `Coding agent: implement handoff`

**You:** LATEST → handoff file → implement P0 → `bun run check` + tests → **deslop** → re-check → browser spot-check if UI → mark done → short summary.
