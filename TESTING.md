# Unit testing guidelines

Single source of truth for how unit tests are written in this repository.

## Commands

| Package | All tests | One file | Coverage |
|---|---|---|---|
| `backend/` | `npm test` | `npx vitest run tests/router.test.ts` | `npm run test:coverage` |
| `frontend/` | `npm test` | `npx vitest run src/hooks/useNotice.test.ts` | `npm run test:coverage` |

Both packages use Vitest 4 and V8 coverage. No database, network or browser is
needed: every test runs in-process.

## Backend (`backend/`)

- **Location:** `backend/tests/<module>.test.ts`, one file per source module
  (`src/features/todos/router.ts` → `tests/router.test.ts`).
- **Imports:** relative with the `.ts` extension (`../src/features/todos/router.ts`).
- **Style:** flat `it(...)` blocks (a `describe` only to group a schema or a
  table), semicolons, short `setup()` helper per file that returns everything
  the test needs.
- **Fixtures:** `tests/fixture.ts` exports `record` (Prisma row) and `todo` (API
  DTO). Derive variants with spreads (`{ ...record, completed: true }`), do not
  copy literals.
- **Mocking boundaries:**
  - Router / HTTP: build the app with an in-memory `TodoStore` of `vi.fn()`s
    and call it with Supertest. For the whole app use `createApp(database)`.
  - Repository / Prisma: construct the real client with
    `createDatabase('postgresql://test:test@localhost:5432/test')` and
    `vi.spyOn(database.todo, '<method>')`. Constructing it opens no connection.
  - Environment: `vi.stubEnv(...)` + `vi.unstubAllEnvs()` in `afterEach`.
  - Never mock the module under test, nor the libraries its logic is built
    from (zod schemas, pure helpers): the test would then check the mock.
- **Tables:** use `it.each` for validation and error matrices.

## Frontend (`frontend/`)

- **Location:** colocated, `Component.tsx` → `Component.test.tsx`,
  `hook.ts` → `hook.test.ts`.
- **Style:** Prettier (`semi: false`, `singleQuote: true`, `trailingComma: all`),
  flat `it(...)` blocks. Run `npx prettier --write <file>` on new tests.
- **Fixtures:** `src/test/todoFixture.ts` (`todoFixture`). Derive variants with
  spreads.
- **Design system:** in component tests replace it with the shared mocks; the
  factory must be async because `vi.mock` is hoisted:
  `vi.mock('../../../design-system', () => import('../../../design-system/mocks'))`.
- **Child components:** a component test may stub children
  (`vi.mock('./TodoItem', () => ({ TodoItem: () => <li>Task</li> }))`) so the
  test covers only the component's own behaviour.
- **Hooks used by a component:** mock the hook module and set the return with
  `vi.mocked(useX).mockReturnValue({...} as unknown as ReturnType<typeof useX>)`.
- **Testing a TanStack Query hook itself:** a fresh `QueryClient` per test with
  `retry: false`, wrapped with `QueryClientProvider` (or
  `AppProviders client={client}`), mock `todosApi` (`vi.mock('../api/todos')`),
  assert on the result and on `client.getQueryData(todoKeys.list)`.
- **HTTP (`lib/http.ts`):** `vi.stubGlobal('fetch', vi.fn())`, build real
  `Response` objects, `vi.unstubAllGlobals()` in `afterEach`.
- **Queries:** by role and accessible name (`getByRole('button', { name: 'Try again' })`),
  then by visible text. `getByTestId` only for the mocked `Alert`.
- **Interaction:** `const user = userEvent.setup()` and `await user.click(...)`,
  never `fireEvent` for user flows.
- **Coverage scope:** `src/design-system/**`, `lib/queryClient.ts`, types,
  barrels and `main.tsx` are excluded from coverage (see `vite.config.ts`).

## What a good unit test is

A test is worth keeping only if it **fails when the behaviour it names breaks**.

Do:

1. Test behaviour through the public interface (props, return values, HTTP
   responses, rendered output), not private details.
2. Name the test after the behaviour: `returns 404 when the task does not exist`.
3. Cover the branches that matter: happy path, each error / empty / boundary
   case, each distinct status code.
4. Mock only at boundaries (database delegate, `fetch`, API module, timers),
   never the unit under test or the libraries its logic is built from.
5. Assert precisely: exact values, exact call arguments, call order when order
   is the behaviour.
6. Keep tests deterministic: no real time, network, randomness or shared state
   between tests.
7. Keep each test independent and small; one reason to fail.

Do not:

- Write render-only tests (`renders without crashing`) or type-only assertions
  (`expect(fn).toEqual(expect.any(Function))`).
- Compute the expected value by re-implementing the code under test.
- Assert `toHaveBeenCalled()` without checking the arguments that matter.
- Use snapshots for logic or for whole component trees.
- Assert styles, class names or styled-components internals.
- Test third-party libraries (zod, React Query, Express) instead of our code.
- Change production code to make a test pass. If the code looks wrong, leave
  that case out (do not commit a failing or `it.fails` test) and report the
  suspected bug with the expected and actual values.
- Weaken or delete an existing assertion to make a test pass.

## Examples: bad → good

The snippets show the pattern; names follow the current code but the point is
the shape of the test, not the exact module.

### Type-only assertion → observable behaviour

```tsx
// Bad: passes even if notify does nothing
it('exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.notify).toEqual(expect.any(Function))
})

// Good: proves the message appears and expires
it('shows a notice and clears it after four seconds', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useNotice())
  act(() => result.current.notify('Task saved.'))
  expect(result.current.message).toBe('Task saved.')
  act(() => vi.advanceTimersByTime(4000))
  expect(result.current.message).toBe('')
  vi.useRealTimers()
})
```

### Render-only → each branch the user can see

```tsx
// Bad: fails only if rendering throws
it('renders', () => {
  render(<TodoEmptyState hasTodos={false} disabled={false} onCreate={vi.fn()} />)
})

// Good: one test per visible branch, with the interaction
it('offers to create the first task when there are no tasks', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  render(<TodoEmptyState hasTodos={false} disabled={false} onCreate={onCreate} />)
  await user.click(screen.getByRole('button', { name: 'Add your first task' }))
  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('explains the empty result when filters hide existing tasks', () => {
  render(<TodoEmptyState hasTodos disabled={false} onCreate={vi.fn()} />)
  expect(screen.getByRole('heading', { name: 'No matching tasks' })).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
```

### Expected value re-computed from the code → fixed literals

```ts
// Bad: copies the implementation, so a bug in it is copied too
it('detects overdue tasks', () => {
  const today = new Date().toISOString().slice(0, 10)
  const todo = { ...todoFixture, due_date: '2026-01-01' }
  expect(isOverdue(todo)).toBe(todo.due_date < today)
})

// Good: frozen clock, literal inputs and outputs, boundary included
it.each([
  ['2026-10-14', false, true],
  ['2026-10-15', false, false],
  ['2026-10-14', true, false],
])('due %s, completed %s → overdue %s', (due_date, completed, expected) => {
  vi.useFakeTimers({ now: new Date(2026, 9, 15, 9, 0) })
  expect(isOverdue({ ...todoFixture, due_date, completed })).toBe(expected)
  vi.useRealTimers()
})
```

### Loose call assertion → exact arguments and response

```ts
// Bad: passes even if the wrong ID or payload reaches the repository
it('updates a task', async () => {
  const { app, repository } = setup();
  await request(app).patch('/api/todos/1').send({ completed: true });
  expect(repository.update).toHaveBeenCalled();
});

// Good: checks what was sent and what the client gets back
it('updates a task with the validated patch', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue({ ...todo, completed: true });
  const response = await request(app).patch('/api/todos/1').send({ completed: true });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ...todo, completed: true });
  expect(repository.update).toHaveBeenCalledWith(1, { completed: true });
});
```

### Weakened to go green → keep the assertion, report the bug

```ts
// Bad: the code returns 200 for a missing task, so the test was loosened
expect(response.status).toBeLessThan(500);

// Good: assert the contract; if it fails because of the code, do not edit the
// code and do not loosen the test — report it as a suspected bug
expect(response.status).toBe(404);
expect(response.body).toEqual({ detail: 'Task not found.' });
```

## What is not worth a unit test

- Pure wiring with no logic: `main.ts`, barrels (`index.ts`), types.
- Storybook stories and the design-system styles.
- Generated code (`backend/src/generated/**`).
