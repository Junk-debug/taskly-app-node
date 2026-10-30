import request from 'supertest';
import { it, expect, vi, afterEach } from 'vitest';
import { createDatabase } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';
import { record, todo } from './fixture.ts';

function setup() {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  const findMany = vi.spyOn(database.todo, 'findMany');
  const findFirst = vi.spyOn(database.todo, 'findFirst');
  return { app: createApp(database), findMany, findFirst };
}
afterEach(() => {
  vi.restoreAllMocks();
});
it('does not advertise the framework in response headers', async () => {
  const { app, findFirst } = setup();
  findFirst.mockResolvedValue(null as never);
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.headers['x-powered-by']).toBeUndefined();
});
it('mounts the todos router on the repository under /api/todos', async () => {
  const { app, findMany } = setup();
  findMany.mockResolvedValue([record] as never);
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
});
it('serves the OpenAPI specification as JSON', async () => {
  const { app } = setup();
  const response = await request(app).get('/openapi.json');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('application/json');
  expect(response.body.info.title).toBe('Taskly App Node API');
  expect(Object.keys(response.body.paths)).toContain('/api/health');
});
it('serves the Swagger UI under /docs', async () => {
  const { app } = setup();
  const response = await request(app).get('/docs/');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
  expect(response.text).toContain('swagger-ui');
});
it('returns 404 with a JSON detail for unknown routes', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/nope');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
});
it('returns 422 for malformed JSON bodies', async () => {
  const { app } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{"title":');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
});
it('returns 413 when the body exceeds the JSON limit', async () => {
  const { app } = setup();
  const response = await request(app).post('/api/todos').send({ title: 'x'.repeat(200_000) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
});
it('returns a generic 500 and logs the error when a handler fails unexpectedly', async () => {
  const { app, findMany } = setup();
  const failure = new Error('boom');
  findMany.mockRejectedValue(failure);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(logged).toHaveBeenCalledWith(failure);
});
