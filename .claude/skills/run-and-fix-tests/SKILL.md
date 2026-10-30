---
name: run-and-fix-tests
description: Run new or updated unit tests, diagnose failures and fix the tests (never the code under test). Use after writing or changing any test file, and before reporting results.
---

# Run and fix tests

## Commands

Always run from the package directory, one command per call. The shell keeps
its working directory between calls: from the repository root use
`cd backend &&`, from inside a package use `cd ../frontend &&`.

| Step | Backend | Frontend |
|---|---|---|
| One file | `cd backend && npx vitest run tests/router.test.ts` | `cd frontend && npx vitest run src/lib/http.test.ts` |
| Types | `cd backend && npx tsc --noEmit` | `cd frontend && npx tsc --noEmit` |
| Whole package | `cd backend && npx vitest run` | `cd frontend && npx vitest run` |

Vitest does not type-check, so run `tsc` after the tests pass.

## Loop (per test file, at most 3 fix attempts)

1. Run the file.
2. If it passes, run it two more times. A test that fails on any run is flaky:
   find the shared state, real timer or ordering dependency and fix it.
3. If it fails, read the failure and classify it:

   | Cause | Action |
   |---|---|
   | Wrong import, mock setup, query, async handling or fixture in the test | Fix the test. |
   | The expected value was a wrong guess about the contract (the diff and the code agree on another value) | Fix the expectation to the contract shown by the code and diff. |
   | The code contradicts its own contract (types, validators, API docs in `backend/openapi.json`, the PR diff intent) | **Suspected bug.** Do not edit the code. Do not loosen the assertion. Remove that single case from the file and record the bug with file, line, expected, actual. |

4. After 3 failed attempts on one file, revert your changes to that file
   (`git diff` shows them) and record it as **dropped** with the last error.

## Finish

- Run the whole package once to make sure nothing else broke.
- Run `tsc --noEmit` for every package you touched.
- Re-run the `analyze-changes` script with the same arguments as at the start
  and check that `uncoveredChangedLines` is empty for every file you covered.
  Explain any line that stays uncovered (for example unreachable code).
- Never: edit files outside test files, add `.skip`/`.only`/`.todo`, replace an
  exact assertion with a looser one, delete an existing passing case.
