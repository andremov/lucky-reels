import { corsOrigins } from './cors-origins';

describe('corsOrigins', () => {
  it('allows nothing when unset, rather than allowing everything', () => {
    expect(corsOrigins(undefined)).toBe(false);
  });

  it('allows nothing when blank', () => {
    expect(corsOrigins('   ')).toBe(false);
  });

  it('parses a single origin', () => {
    expect(corsOrigins('https://a.test')).toEqual(['https://a.test']);
  });

  it('parses a comma separated list and trims it', () => {
    expect(corsOrigins(' https://a.test , http://localhost:5173 ')).toEqual([
      'https://a.test',
      'http://localhost:5173',
    ]);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(corsOrigins('https://a.test,')).toEqual(['https://a.test']);
  });

  it('opens up only for an explicit wildcard', () => {
    expect(corsOrigins('*')).toBe(true);
  });

  it('matches exactly, so a lookalike origin is not in the list', () => {
    const allowed = corsOrigins('https://lucky-reels.vercel.app');

    expect(allowed).not.toContain('https://lucky-reels.vercel.app.evil.com');
    expect(allowed).toEqual(['https://lucky-reels.vercel.app']);
  });
});
