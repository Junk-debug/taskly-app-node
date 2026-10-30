---
name: report-results
description: Produce the final report of a unit-test run (decisions per file, tests written, run results, suspected bugs). Use as the last step of every test-writing task.
---

# Report results

The report must match [report.schema.json](report.schema.json). In CI the same
schema is passed to Claude Code as `--json-schema`, so return it as the final
structured output. Locally, print it as the Markdown below.

## Rules

- One `decisions` entry per changed source from `analyze-changes`, skips included.
  A skip without a reason is not allowed.
- `tests` lists only test files you created or modified, with the cases you
  added or changed, the final result and the number of runs.
- `suspectedBugs` only for failures classified as code bugs by
  `run-and-fix-tests`; quote the expected and actual values.
- `dropped` lists cases you removed because they could not be made to pass.
- Report facts only: test counts and results come from the commands you ran,
  not from expectations.

## Markdown

```markdown
### Unit test agent

| Source | Decision | Test file | Reason |
|---|---|---|---|
| backend/src/features/todos/router.ts | update | backend/tests/router.test.ts | 404 branches uncovered |

**Tests:** 2 files, 6 cases added, all passing (3 runs each).

**Suspected bugs:** none.

**Dropped:** none.
```
