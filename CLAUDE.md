# Taskly App Node

Todo app: `backend/` (Node 22, Express 5, Prisma 7 + PostgreSQL, zod) and
`frontend/` (React 19, Vite, TanStack Query, styled-components). Two separate
npm packages; run commands inside the package directory.

## Commands

| | Backend | Frontend |
|---|---|---|
| Install | `cd backend && npm ci` | `cd frontend && npm ci` |
| Tests | `npm test` | `npm test` |
| Coverage | `npm run test:coverage` | `npm run test:coverage` |
| Types | `npm run typecheck` | `npm run typecheck` |

Tests need no database or network: the backend mocks Prisma delegates, the
frontend runs in jsdom.

## Layout

- `backend/src/features/todos/` — router → repository → Prisma; `validators.ts` (zod), `mappers.ts`.
- `backend/src/core/` — config, database bootstrap, server lifecycle; `factory.ts` builds the Express app.
- `backend/tests/` — backend unit tests.
- `frontend/src/features/todos/` — `api/`, `hooks/` (TanStack Query), `components/`, `utils/`.
- `frontend/src/design-system/` — UI kit with Storybook stories; `mocks.tsx` replaces it in tests.

## Unit tests

Rules and examples for unit tests: `TESTING.md`. Read it before writing or
reviewing tests.

The `unit-test-agent` (`.claude/agents/`) writes tests for changed code using
the skills in `.claude/skills/`. Run it locally with
`claude --agent unit-test-agent`.
