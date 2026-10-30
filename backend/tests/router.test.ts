import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createTodosRouter } from '../src/features/todos/router.ts';
import { todo } from './fixture.ts';

function setup() {
  const repository = { list: vi.fn().mockResolvedValue([todo]), create: vi.fn().mockResolvedValue(todo), get: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
it('lists tasks from the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(repository.list).toHaveBeenCalledOnce();
});
it('returns statistics for the stored tasks instead of treating stats as an id', async () => {
  vi.useFakeTimers({ now: new Date('2026-10-20T10:00:00Z'), toFake: ['Date'] });
  try {
    const { app, repository } = setup();
    const response = await request(app).get('/api/todos/stats');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 1, active: 1, completed: 0, overdue: 1, byPriority: { low: 0, medium: 0, high: 1 } });
    expect(repository.get).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it('creates tasks with trimmed input and defaults', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: '  Plan the sprint  ', priority: 'high' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual(todo);
  expect(repository.create).toHaveBeenCalledWith({ title: 'Plan the sprint', description: '', priority: 'high', due_date: null, completed: false });
});
it.each([{ title: '  ' }, { title: 'x'.repeat(121) }, { title: 'Task', priority: 'urgent' }, { title: 'Task', due_date: '2026-02-30' }])(
  'rejects invalid create input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    expect((await request(app).post('/api/todos').send(payload)).status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  },
);
it.each(['abc', '0', '-1', '1.5', '9007199254740992'])('rejects invalid id %s with 422 on every id route', async (id) => {
  const { app, repository } = setup();
  const getResponse = await request(app).get(`/api/todos/${id}`);
  expect(getResponse.status).toBe(422);
  expect(getResponse.body.detail).toEqual(expect.arrayContaining([expect.objectContaining({ code: expect.any(String), message: expect.any(String) })]));
  expect((await request(app).patch(`/api/todos/${id}`).send({ completed: true })).status).toBe(422);
  expect((await request(app).delete(`/api/todos/${id}`)).status).toBe(422);
  expect(repository.get).not.toHaveBeenCalled();
  expect(repository.update).not.toHaveBeenCalled();
  expect(repository.delete).not.toHaveBeenCalled();
});
it('returns a task by numeric id', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(todo);
  const response = await request(app).get('/api/todos/1');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(todo);
  expect(repository.get).toHaveBeenCalledWith(1);
});
it('returns 404 when the task to read does not exist', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(null);
  const response = await request(app).get('/api/todos/5');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
  expect(repository.get).toHaveBeenCalledWith(5);
});
it('updates a task with the validated patch', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue({ ...todo, completed: true });
  const response = await request(app).patch('/api/todos/1').send({ completed: true });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ...todo, completed: true });
  expect(repository.update).toHaveBeenCalledWith(1, { completed: true });
});
it.each([{}, { title: '' }, { unknown: 1 }, { priority: 'urgent' }])(
  'rejects invalid patch input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    const response = await request(app).patch('/api/todos/1').send(payload);
    expect(response.status).toBe(422);
    expect(response.body.detail.length).toBeGreaterThan(0);
    expect(repository.update).not.toHaveBeenCalled();
  },
);
it('explains that an empty patch needs at least one field', async () => {
  const { app } = setup();
  const response = await request(app).patch('/api/todos/1').send({});
  expect(response.status).toBe(422);
  expect(response.body.detail[0].message).toBe('Provide at least one field to update.');
});
it('returns 404 when the task to update does not exist', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue(null);
  const response = await request(app).patch('/api/todos/7').send({ title: 'New' });
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
  expect(repository.update).toHaveBeenCalledWith(7, { title: 'New' });
});
it('deletes a task and answers 204 with no body', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(true);
  const response = await request(app).delete('/api/todos/1');
  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(repository.delete).toHaveBeenCalledWith(1);
});
it('returns 404 when the task to delete does not exist', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(false);
  const response = await request(app).delete('/api/todos/9');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
  expect(repository.delete).toHaveBeenCalledWith(9);
});
