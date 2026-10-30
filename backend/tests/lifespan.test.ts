import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { start } from '../src/core/lifespan.ts';
import { createDatabase, initialize } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';

vi.mock('../src/core/database.ts', () => ({
  createDatabase: vi.fn(),
  initialize: vi.fn(),
}));
vi.mock('../src/factory.ts', () => ({ createApp: vi.fn() }));

function setup() {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  const database = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const server = Object.assign(new EventEmitter(), {
    address: () => ({ port: 8123 }),
    close: vi.fn(),
  });
  const listen = vi.fn((_port: number, _host: string, cb: () => void) => {
    queueMicrotask(cb);
    return server;
  });
  vi.mocked(createDatabase).mockReturnValue(database as never);
  vi.mocked(initialize).mockResolvedValue(undefined);
  vi.mocked(createApp).mockReturnValue({ listen } as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const handlers: Record<string, () => void> = {};
  vi.spyOn(process, 'once').mockImplementation(((event: string, fn: () => void) => {
    handlers[event] = fn;
    return process;
  }) as never);
  return { database, server, listen, handlers };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetAllMocks();
  process.exitCode = undefined;
});

it('connects, initializes, and listens on API_PORT on all interfaces', async () => {
  const { database, server, listen } = setup();
  vi.stubEnv('API_PORT', '9001');
  const result = await start();
  expect(createDatabase).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/test');
  expect(database.$connect).toHaveBeenCalledTimes(1);
  expect(initialize).toHaveBeenCalledWith(database);
  expect(createApp).toHaveBeenCalledWith(database);
  expect(listen).toHaveBeenCalledWith(9001, '0.0.0.0', expect.any(Function));
  expect(result).toEqual({ server, database });
  expect(console.log).toHaveBeenCalledWith('Taskly App Node API listening on port 8123');
});

it('defaults to port 8000 when API_PORT is not set', async () => {
  const { listen } = setup();
  vi.stubEnv('API_PORT', '');
  await start();
  expect(listen).toHaveBeenCalledWith(8000, '0.0.0.0', expect.any(Function));
});

it('disconnects and rethrows when the connection fails', async () => {
  const { database } = setup();
  database.$connect.mockRejectedValue(new Error('no db'));
  await expect(start()).rejects.toThrow('no db');
  expect(database.$disconnect).toHaveBeenCalledTimes(1);
  expect(initialize).not.toHaveBeenCalled();
});

it('disconnects and rethrows when the server emits a listen error', async () => {
  const { database, server, listen } = setup();
  listen.mockImplementation(() => {
    queueMicrotask(() => server.emit('error', new Error('EADDRINUSE')));
    return server;
  });
  await expect(start()).rejects.toThrow('EADDRINUSE');
  expect(database.$disconnect).toHaveBeenCalledTimes(1);
});

it.each(['SIGTERM', 'SIGINT'])('closes the server and disconnects on %s', async (signal) => {
  const { database, server, handlers } = setup();
  await start();
  handlers[signal]();
  expect(server.close).toHaveBeenCalledTimes(1);
  expect(database.$disconnect).not.toHaveBeenCalled();
  await (server.close.mock.calls[0][0] as () => Promise<void>)();
  expect(database.$disconnect).toHaveBeenCalledTimes(1);
  expect(process.exitCode).toBeUndefined();
});

it('sets a failing exit code when disconnect fails during shutdown', async () => {
  const { database, server, handlers } = setup();
  database.$disconnect.mockRejectedValue(new Error('disconnect failed'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await start();
  handlers.SIGTERM();
  await (server.close.mock.calls[0][0] as () => Promise<void>)();
  expect(error).toHaveBeenCalledWith(new Error('disconnect failed'));
  expect(process.exitCode).toBe(1);
});

it('does not force-exit after the server closed cleanly', async () => {
  const { server, handlers } = setup();
  vi.useFakeTimers();
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  await start();
  handlers.SIGTERM();
  await (server.close.mock.calls[0][0] as () => Promise<void>)();
  vi.advanceTimersByTime(10000);
  expect(exit).not.toHaveBeenCalled();
});

it('force-exits with code 1 when the server does not close within 10 seconds', async () => {
  const { handlers } = setup();
  vi.useFakeTimers();
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  await start();
  handlers.SIGTERM();
  vi.advanceTimersByTime(9999);
  expect(exit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(exit).toHaveBeenCalledWith(1);
});
