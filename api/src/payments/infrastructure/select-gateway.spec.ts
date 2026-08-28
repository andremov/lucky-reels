import { selectGateway } from './select-gateway';

const full = {
  PAYMENT_API_URL: 'https://api.example.test/v1',
  PAYMENT_PUBLIC_KEY: 'pub_test',
  PAYMENT_PRIVATE_KEY: 'prv_test',
  PAYMENT_INTEGRITY_KEY: 'int_test',
};

describe('selectGateway', () => {
  it('goes live when every key is present', () => {
    expect(selectGateway(full).kind).toBe('live');
  });

  it('carries the configuration through', () => {
    const selection = selectGateway(full);

    if (selection.kind === 'live') {
      expect(selection.config).toEqual({
        apiUrl: 'https://api.example.test/v1',
        publicKey: 'pub_test',
        privateKey: 'prv_test',
        integrityKey: 'int_test',
      });
    }
  });

  it('trims a trailing slash so urls are joined predictably', () => {
    const selection = selectGateway({ ...full, PAYMENT_API_URL: 'https://api.example.test/v1///' });

    if (selection.kind === 'live') {
      expect(selection.config.apiUrl).toBe('https://api.example.test/v1');
    }
  });

  it('falls back to the stub when nothing is configured', () => {
    const selection = selectGateway({});

    expect(selection).toMatchObject({ kind: 'stub', reason: 'not configured' });
  });

  it.each(Object.keys(full))('refuses to go live when %s is missing', (key) => {
    const partial = { ...full, [key]: undefined };

    expect(selectGateway(partial).kind).toBe('stub');
  });

  it.each(Object.keys(full))('reports %s as the missing key', (key) => {
    const selection = selectGateway({ ...full, [key]: undefined });

    if (selection.kind === 'stub') {
      expect(selection.missing).toEqual([key]);
      expect(selection.reason).toBe('partially configured');
    }
  });

  it('treats blank strings as absent rather than configured', () => {
    const selection = selectGateway({ ...full, PAYMENT_PRIVATE_KEY: '   ' });

    expect(selection.kind).toBe('stub');
  });

  it('distinguishes nothing configured from half configured', () => {
    const none = selectGateway({});
    const half = selectGateway({ PAYMENT_API_URL: 'https://x.test' });

    if (none.kind === 'stub' && half.kind === 'stub') {
      expect(none.reason).toBe('not configured');
      expect(half.reason).toBe('partially configured');
      expect(half.missing).toHaveLength(3);
    }
  });
});
