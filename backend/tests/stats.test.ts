import { it, expect } from 'vitest';
import { computeStats } from '../src/features/todos/stats.ts';
import { todo } from './fixture.ts';

it('returns zeros for an empty list', () => {
  expect(computeStats([], '2026-10-15')).toEqual({ total: 0, active: 0, completed: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } });
});
it('counts active, completed and priorities', () => {
  const todos = [
    { ...todo, due_date: null },
    { ...todo, completed: true, priority: 'low' as const, due_date: null },
    { ...todo, priority: 'medium' as const, due_date: null },
  ];
  expect(computeStats(todos, '2026-10-15')).toEqual({ total: 3, active: 2, completed: 1, overdue: 0, byPriority: { low: 1, medium: 1, high: 1 } });
});
it('sums every overdue active task and ignores completed, due-today and undated ones', () => {
  const todos = [
    { ...todo, due_date: '2026-10-14' },
    { ...todo, due_date: '2026-10-01' },
    { ...todo, due_date: '2026-10-14', completed: true },
    { ...todo, due_date: '2026-10-15' },
    { ...todo, due_date: null },
  ];
  expect(computeStats(todos, '2026-10-15').overdue).toBe(2);
});
it.each([
  ['2026-10-14', false, 1],
  ['2026-10-15', false, 0],
  ['2026-10-14', true, 0],
  [null, false, 0],
])('due %s, completed %s → overdue %s', (due_date, completed, overdue) => {
  expect(computeStats([{ ...todo, due_date, completed }], '2026-10-15').overdue).toBe(overdue);
});
