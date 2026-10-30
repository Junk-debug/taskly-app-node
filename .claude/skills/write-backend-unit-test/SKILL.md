---
name: write-backend-unit-test
description: Write or update a Vitest unit test for a backend source file (Express router, Prisma repository, zod validators, mappers, config, app factory). Use when a file under backend/src needs a new or updated test.
paths: backend/**
---

# Write a backend unit test

1. Read `TESTING.md` sections **Backend**, **What a good unit test is** and
   **Examples: bad → good**. They are the rules; this skill is the procedure.
2. Read the source file and the diff of the lines you must cover.
3. Read the existing test file if there is one, and `backend/tests/fixture.ts`.
   Reuse their `setup()` helper and fixtures. Never duplicate a case that exists.
4. List the cases before writing: one per behaviour in the changed lines
   (each branch, status code, error, boundary). Name each after the behaviour.
5. Pick the boundary to mock:

   | Source | How to test |
   |---|---|
   | `features/*/router.ts` | Express app + `createTodosRouter(store)` with a `vi.fn()` store, Supertest requests |
   | `features/*/repository.ts` | `createDatabase('postgresql://test:test@localhost:5432/test')`, `vi.spyOn(database.todo, ...)` |
   | `validators.ts`, `mappers.ts` | Call directly, `it.each` tables; no mocks |
   | `api/*.ts`, `factory.ts` | `createApp(database)` with spied Prisma delegates, Supertest |
   | `core/config.ts` | `vi.stubEnv`, `vi.unstubAllEnvs()` in `afterEach` |
   | `core/lifespan.ts` | `vi.mock('../src/core/database.ts')` and `../src/factory.ts`; never open a port or a DB |

6. Write the test at `backend/tests/<module>.test.ts` with `.ts` import
   extensions, semicolons and flat `it` blocks.
7. Run it with the `run-and-fix-tests` skill.
