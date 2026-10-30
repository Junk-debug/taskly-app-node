import request from 'supertest';
import { it, expect, vi, afterEach } from 'vitest';
import { createDatabase } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';

function setup() {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const findFirst = vi.spyOn(database.todo, 'findFirst');
  return { app: createApp(database), findFirst };
}
afterEach(() => {
  vi.restoreAllMocks();
});
it('reports ok after querying the database', async () => {
  const { app, findFirst } = setup();
  findFirst.mockResolvedValue(null as never);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
});
it('returns a generic 500 and logs the error when the database query fails', async () => {
  const { app, findFirst } = setup();
  const failure = new Error('db down');
  findFirst.mockRejectedValue(failure);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(logged).toHaveBeenCalledWith(failure);
});
