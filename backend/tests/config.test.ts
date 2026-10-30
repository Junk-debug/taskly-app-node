import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

const parts = {
  POSTGRES_USER: 'user',
  POSTGRES_PASSWORD: 'pass',
  POSTGRES_HOST: 'db.local',
  DB_PORT: '5433',
  POSTGRES_DB: 'taskly',
};

function setup(env: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', '');
  for (const name of Object.keys(parts)) vi.stubEnv(name, '');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveDatabaseUrl', () => {
  it('prefers the override over DATABASE_URL', () => {
    setup({ DATABASE_URL: 'postgresql://env/db' });
    expect(resolveDatabaseUrl('postgresql://override/db')).toBe('postgresql://override/db');
  });

  it('uses DATABASE_URL when there is no override', () => {
    setup({ DATABASE_URL: 'postgresql://env/db' });
    expect(resolveDatabaseUrl()).toBe('postgresql://env/db');
  });

  it('rewrites the SQLAlchemy psycopg scheme to postgresql', () => {
    setup({ DATABASE_URL: 'postgresql+psycopg://u:p@h:5432/db' });
    expect(resolveDatabaseUrl()).toBe('postgresql://u:p@h:5432/db');
  });

  it('builds the URL from the POSTGRES_* parts', () => {
    setup(parts);
    expect(resolveDatabaseUrl()).toBe('postgresql://user:pass@db.local:5433/taskly');
  });

  it('percent-encodes special characters in credentials and database name', () => {
    setup({ ...parts, POSTGRES_PASSWORD: 'p@ss/w:rd', POSTGRES_DB: 'my/db%' });
    expect(resolveDatabaseUrl()).toBe('postgresql://user:p%40ss%2Fw%3Ard@db.local:5433/my%2Fdb%25');
  });

  it.each(Object.keys(parts))('throws when %s is missing', (name) => {
    setup({ ...parts, [name]: '' });
    expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${name}`);
  });
});
