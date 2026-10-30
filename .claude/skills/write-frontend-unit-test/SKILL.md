---
name: write-frontend-unit-test
description: Write or update a Vitest + React Testing Library unit test for a frontend source file (React component, TanStack Query hook, plain hook, API module, utility, HTTP client). Use when a file under frontend/src needs a new or updated test.
---

# Write a frontend unit test

1. Read `TESTING.md` sections **Frontend**, **What a good unit test is** and
   **Examples: bad → good**. They are the rules; this skill is the procedure.
2. Read the source file and the diff of the lines you must cover.
3. Read the colocated test if there is one, `src/test/todoFixture.ts`, and one
   neighbouring test of the same kind for style.
4. List the cases before writing: one per behaviour in the changed lines
   (each visible branch, interaction, error state, cache update).
5. Pick the pattern:

   | Source | Pattern |
   |---|---|
   | Component | Mock the design system with the async `vi.mock` factory, stub child components, query by role, `userEvent.setup()` |
   | Component using hooks | Mock the hook modules, `vi.mocked(useX).mockReturnValue(... as unknown as ReturnType<typeof useX>)` |
   | TanStack Query hook | [templates.md](templates.md) → "Query and mutation hooks" |
   | Plain hook | `renderHook`, `act`, fake timers for timeouts |
   | `lib/http.ts` | [templates.md](templates.md) → "fetch" |
   | API module, utility | Call directly, mock only `lib/http` |

6. Write the test next to the source (`X.tsx` → `X.test.tsx`, `x.ts` → `x.test.ts`).
7. Format it: `cd frontend && npx prettier --write <path relative to frontend>`.
8. Run it with the `run-and-fix-tests` skill.
