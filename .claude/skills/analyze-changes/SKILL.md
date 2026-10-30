---
name: analyze-changes
description: Find which changed source files need new or updated unit tests. Use at the start of any request to cover a branch, PR or set of changes with tests. Produces one decision per changed file (create, update or skip) with a reason.
---

# Analyze changes

## 1. Collect facts with the script

Run from the repository root:

```bash
node .claude/skills/analyze-changes/scripts/changed-sources.mjs --base <base-ref>
```

- `<base-ref>` is the branch the work will merge into (`origin/main` by default).
  In CI the prompt gives it to you; locally use `origin/main` unless told otherwise.
- `--files <path> ...` analyzes the given files instead of a diff: every line
  counts as changed, so `uncoveredChangedLines` lists all untested lines. Use it
  when you are asked to cover specific files that are not changed on the branch.
- `--no-coverage` skips running Vitest; use it only when you need the file list fast.

The script prints JSON:

| Field | Meaning |
|---|---|
| `packages.<pkg>.sources[]` | Changed source files that are worth testing (types, barrels, stories, design system, generated code and entry points are already filtered out). |
| `sources[].test` / `testExists` | Conventional test path from `TESTING.md` and whether it exists. |
| `sources[].changedLines` | Lines added or changed in this diff. |
| `sources[].uncoveredChangedLines` | Changed lines that no related test executes. `coverage: "not-collected"` means the file has no coverage data, so treat every changed line as uncovered. |
| `packages.<pkg>.relatedTests[]` | Test files that import the changed files (Vitest module graph), with pass/fail status after the change. |
| `deleted[]` | Removed sources; `testExists: true` means a test may now be orphaned. |
| `needsAgent` / `reasons` | Deterministic summary. `false` means nothing is uncovered and nothing fails. |

The script states facts. You make the decisions.

## 2. Decide per file

Read the diff of each source (`git diff <base-ref>...HEAD -- <path>`) and the
related tests before deciding.

| Situation | Decision |
|---|---|
| Uncovered changed lines and `testExists: false` | **create** the conventional test file. |
| Uncovered changed lines and `testExists: true` | **update**: add cases to the existing file. |
| A related test fails and the diff intentionally changed that behaviour (new message, new status code, new field) | **update** the assertion to the new contract. |
| A related test fails and the diff does not explain it | Do not touch the test or the code. Record a **suspected bug**. |
| New file (`status: added`) or new exported function, covered only because another module's test happens to execute it | **create** / **update** a test that asserts its behaviour directly. Incidental coverage is not a test. |
| Covered, tests pass, but the change adds behaviour the existing assertions do not check (for example a new field in a response that `toEqual` would not catch) | **update** with a precise assertion. |
| Covered, tests pass, assertions already pin the behaviour | **skip**: name the test and the assertion that pin it. "Line is executed" alone is not a reason to skip. |
| Rename, formatting, comment or type-only change | **skip**: no behaviour change. |
| File is in "What is not worth a unit test" in `TESTING.md` | **skip** with that reason. |
| `deleted[]` entry with `testExists: true` | Do not delete anything. Report the possibly orphaned test. |

Focus on the changed lines. Do not rewrite or extend tests for unrelated,
unchanged code in the same file.

## 3. Output

Keep a decision list; it feeds the `report-results` skill:

```
- backend/src/features/todos/router.ts → update backend/tests/router.test.ts
  reason: lines 21, 28, 32 (404 branches) uncovered
- frontend/src/lib/answer.ts → create frontend/src/lib/answer.test.ts
  reason: new file, no tests
```

Then write the tests with `write-backend-unit-test` or `write-frontend-unit-test`.
