---
name: project-memory
description: Maintains a persistent .project-memory/ directory for this project so the agent doesn't re-scan the whole repo on every task. Use at the start of any non-trivial coding task (bug fix, feature, refactor) and again before marking that task complete.
---

# Project Memory Skill

## Purpose

Gives the agent a persistent, lightweight memory layer for this codebase so it can:
- find relevant files without rescanning the whole repo every time
- remember architecture, conventions, past decisions, and past mistakes
- know what the last agent did and what's unfinished
- pick up exactly where a previous session left off

**Source code is always the final source of truth.** If memory and code disagree, trust the code, then fix the memory.

> **Core rule: Read once, remember intelligently, verify when changed, update memory before declaring done.**

---

## 1. The Canonical Workflow (use this every task)

**Start of task:**
1. Read `.project-memory/master.md`. If it doesn't exist, run First-Run Discovery (Section 4).
2. Identify the feature/module the task touches using `feature-map.md` and `file-index.md`.
3. Pull only the memory relevant to that area: architecture, patterns, decisions, mistakes, recent task history for that module.
4. Build the smallest candidate set of source files that could be involved (see Relevance Scoring, Section 5).
5. For each candidate file, check its fingerprint (Section 6). Unchanged + memory sufficient → reuse memory, skip reading it. Changed, critical, or low-confidence → read the current file.
6. Only expand beyond this set if implementation reveals a missing dependency — then read it, log it, keep going. Don't jump to a full repo scan unless nothing else works.
7. Implement the task.

**End of task (do this before saying "done"):**
1. Validate (tests / typecheck / manual check as applicable).
2. Update `file-index.md` fingerprints and notes for every file you touched.
3. Add one entry to `changes.md` and one to `task-history.md`.
4. Update `architecture.md` / `patterns.md` / `decisions.md` / `mistakes.md` **only if** something at that level actually changed (see Section 7 — don't over-memorize).
5. Refresh the "Current State" block in `master.md` if the active area, known issues, or next-likely-work changed.
6. Only then mark the task complete.

This loop is the whole skill. Everything below is reference detail for applying it correctly.

---

## 2. Non-Negotiable Rules

1. **Memory before exploration.** Never start a task with a repo-wide scan if memory can answer "where does this live" first.
2. **Relevant files only.** Read a file only if: the user named it, memory maps it to the task, it's a dependency of a relevant file, or the task can't be safely done without it. Skip `node_modules`, build output, caches, binaries, lockfiles, and generated files unless the task is specifically about them.
3. **Memory stores knowledge, not code.** Purpose, symbols, responsibilities, interfaces, relationships, constraints, conventions, decisions, lessons — never paste large implementations into memory.
4. **Source code wins.** A memory/code conflict is resolved in favor of the code, every time, then memory is corrected.
5. **No task is complete until memory is updated** per the End-of-Task checklist above.
6. **Don't over-memorize.** Trivial formatting-only changes, abandoned experiments, and one-off debugging guesses don't get permanent entries.
7. **Never store secrets** — no passwords, API keys, tokens, credentials. Record the env var name, not its value (e.g. `Auth uses AUTH_PROVIDER_URL`).

---

## 3. Memory Structure

```text
.project-memory/
├── master.md
├── project.md
├── file-index.md
├── architecture.md
├── patterns.md
├── decisions.md
├── mistakes.md
├── task-history.md
├── changes.md
├── dependencies.md
├── feature-map.md
├── glossary.md
├── roadmap.md
└── archive/
    ├── task-history-<period>.md
    └── changes-<period>.md
```

**Small project?** Start with just `master.md`, `file-index.md`, `architecture.md`, `patterns.md`, `decisions.md`, `mistakes.md`, `task-history.md`, `changes.md`. Add the rest only when they'd earn their keep.

| File | Holds | Keep it to |
|---|---|---|
| `master.md` | One-paragraph project summary, architecture summary, major modules, key conventions/decisions/patterns, known issues, current active work, pointers to other files | ~1,000–5,000 words. Compact at 6,000+ (Section 8). |
| `project.md` | Stable identity: purpose, stack, entry points, dev/build/test commands, external services, constraints | Rarely changes |
| `file-index.md` | Per-file: purpose, key symbols, role, depends-on, used-by, last analyzed, fingerprint, status (`verified`/`stale`/`needs review`) | One entry per meaningful file only |
| `architecture.md` | Layers, responsibilities, data flow, which layer may call which | Relationships and rules, not source duplication |
| `patterns.md` | Reusable conventions (API responses, error handling, auth, state mgmt, testing) with use-when / preferred approach / avoid / reason / status | Only patterns actually established (repeated, approved, or documented) |
| `decisions.md` | Architectural choices: decision, reason, alternatives considered, status | One entry per real decision |
| `mistakes.md` | Failures likely to recur: problem, cause, fix, lesson, status | Not every bug — only repeatable lessons |
| `task-history.md` | Date, task, result, files affected, verification, remaining work | Concise; archive when large (Section 8) |
| `changes.md` | Date, task, files changed, behavior change, impact, verification | Concise; archive when large |
| `dependencies.md` | Architectural dependency chains (route → controller → service → repo) | Not a full import graph |
| `feature-map.md` | Feature → entry points, core files, persistence, tests, dependencies | One block per major feature |
| `glossary.md` | Project-specific domain terms | Terms only, not tutorials |
| `roadmap.md` | Durable future direction, tagged planned/proposed/blocked/completed/deprecated | Not speculative ideas |

---

## 4. First-Run Discovery (when `.project-memory/` doesn't exist or is clearly incomplete)

1. **Structure pass** — root layout, source dirs, entry points, package/workspace config, test dirs, build config, DB/schema files, API and frontend entry points. Don't recursively open everything.
2. **Architecture pass** — layers, modules, data flow, state management, persistence, integrations, key boundaries.
3. **Classify files** — Critical (entry points, shared abstractions, config) / Important (frequently used domain code) / Contextual (read only when a task touches it) / Generated-low-value (skip).
4. **Create the memory files** from the structure in Section 3. Use `unknown` / `not yet analyzed` / `needs verification` rather than guessing. Don't claim anything unverified.

---

## 5. Relevance Scoring (when many files could be candidates)

```text
+5  explicitly named by user
+5  direct owner of the requested feature
+4  direct dependency of that feature
+3  related test
+3  API/model/type used by the feature
+2  architecture/config dependency
+1  indirectly related
-3  unrelated feature area
-5  generated file / vendor / dependency directory
```

Heuristic, not a hard formula — read highest-value files first and stop once you're confident.

---

## 6. Fingerprinting & Staleness

**Default fingerprint:** `mtime + file size`. Cheap, no shell hashing required, good enough for most files.

**Use a content hash (e.g. SHA-256) only when the task is security-critical, touches data migrations, public API contracts, concurrency, or permissions** — situations where a false "unchanged" reading is costly.

Status values for each file-index entry: `verified` (checked against current source this session or recently) / `partially verified` / `stale` / `needs review`. Never treat `verified` as permanent — a file can go stale indirectly if something it depends on changed even though its own hash didn't.

**Never skip verification when:** memory is stale, fingerprints changed, or the task touches security, migrations, public API contracts, concurrency, permissions, or production infra, or when a test shows unexpected behavior, or your own confidence is low.

---

## 7. What Gets a Memory Entry (avoid noise)

- **File touched** → update its `file-index.md` entry and fingerprint. Always.
- **Meaningful task change** → one entry in `changes.md` and `task-history.md`. Always.
- **Architectural change** → update `architecture.md` / `decisions.md`.
- **New reusable pattern** → update `patterns.md`.
- **Failure/bug/regression worth remembering** → update `mistakes.md`.
- **New domain term** → update `glossary.md`.
- Skip permanent entries for: typo fixes, formatting-only changes, abandoned experiments, temporary debugging guesses, anything already captured elsewhere.

---

## 8. Compaction (concrete triggers, not "periodically")

- `master.md` exceeds ~6,000 words → trim to current state + pointers; move detail into category files.
- `task-history.md` or `changes.md` exceeds ~50 entries, or covers more than one quarter → archive older entries into `.project-memory/archive/<file>-<period>.md`, keep the recent ~15–20 in the live file.
- A pattern/decision is superseded → mark it `Deprecated`/`Superseded`, don't delete it (it explains history).
- Renamed/removed files → update `file-index.md`, `feature-map.md`, `dependencies.md`, and remove dead references from `master.md`. Mark removed, don't just drop silently.
- A reverted change → record that it was reverted and why, so it isn't reintroduced.

Never delete historical knowledge that still explains a real constraint — archive it, don't erase it.

---

## 9. If the Agent Can't Write Files

If this session is read-only or sandboxed and `.project-memory/` can't be created or updated: proceed with the task using in-session memory only, and say so explicitly rather than silently skipping the update step. Don't fabricate a memory update that didn't happen.

---

## 10. Example

**Task:** "Fix the login timeout bug."

1. Read `master.md` → points to Authentication in `feature-map.md`.
2. Read auth architecture/patterns/mistakes entries.
3. Check fingerprints for `auth/service.ts`, `auth/session.ts` → `auth/service.ts` changed since last analysis.
4. Read `auth/service.ts` and its timeout test.
5. Find and fix the bug. Run tests.
6. Update `file-index.md` fingerprint, add entries to `changes.md` and `task-history.md`, update `mistakes.md` if the bug reflects a repeatable lesson.
7. Refresh `master.md` current-state block.

Files never touched: `billing/`, `chat/`, `analytics/`, `admin/`, `notifications/` — nothing pointed to them.

---

## 11. Definition of Success

- The agent stops re-scanning an unchanged repo every task.
- It locates relevant files quickly via `feature-map.md` / `file-index.md`.
- It remembers past decisions and doesn't repeat documented mistakes.
- It can tell what a previous session changed and pick up unfinished work.
- Stale memory gets caught and corrected, not trusted blindly.
- Memory stays smaller than the codebase it summarizes.

**Final balance:** minimum context + maximum relevant knowledge + current-source verification, without ever sacrificing correctness to save tokens, and without ever copying the repo into memory instead of summarizing it.
