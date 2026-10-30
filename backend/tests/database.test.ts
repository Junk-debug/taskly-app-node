import { expect, it, vi } from 'vitest';
import { initialize } from '../src/core/database.ts';
import type { Database } from '../src/features/todos/types.ts';

function setup() {
  const executeRaw = vi.fn().mockResolvedValue(0);
  const database = { $executeRaw: executeRaw } as unknown as Database;
  return { database, executeRaw };
}

it('creates the todos table idempotently', async () => {
  const { database, executeRaw } = setup();
  await initialize(database);
  expect(executeRaw).toHaveBeenCalledTimes(1);
  const sql = (executeRaw.mock.calls[0][0] as string[]).join('');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS todos');
  expect(sql).toContain("priority IN ('low', 'medium', 'high')");
  expect(sql).toContain('completed BOOLEAN NOT NULL DEFAULT FALSE');
  expect(sql).toContain('length(title) >= 1');
  expect(sql).toContain('due_date DATE');
  expect(sql).toContain('updated_at TIMESTAMPTZ NOT NULL');
});

it('propagates a failure of the table creation', async () => {
  const { database, executeRaw } = setup();
  executeRaw.mockRejectedValue(new Error('boom'));
  await expect(initialize(database)).rejects.toThrow('boom');
});
