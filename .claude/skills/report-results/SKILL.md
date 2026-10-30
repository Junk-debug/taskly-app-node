---
name: report-results
description: Produce the final report of a unit-test run (decisions per file, tests written, run results, suspected bugs). Use as the last step of every test-writing task.
---

# Report results

Your final message is the report. In CI it is posted to the pull request
as-is, next to the workflow's own verification results, so use exactly the
Markdown format below and nothing else after it.

## Rules

- One table row per changed source from `analyze-changes`, skips included.
  A skip without a reason is not allowed.
- **Tests** lists only test files you created or modified, with the cases you
  added or changed, the final result and the number of runs.
- **Suspected bugs** only for failures classified as code bugs by
  `run-and-fix-tests`; quote the expected and actual values.
- **Dropped** lists cases you removed because they could not be made to pass.
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
