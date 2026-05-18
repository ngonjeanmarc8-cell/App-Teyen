import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('returns a valid env object when all keys present', () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      DATABASE_URL: 'postgres://user:pass@host:5432/db',
      OPENAI_API_KEY: 'sk-openai-xxx',
      NODE_ENV: 'test',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.NODE_ENV).toBe('test');
  });

  it('throws if a required key is missing', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        DATABASE_URL: 'postgres://x',
        OPENAI_API_KEY: 'k',
        NODE_ENV: 'test',
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects an invalid URL for NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        DATABASE_URL: 'postgres://x',
        OPENAI_API_KEY: 'k',
        NODE_ENV: 'test',
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
