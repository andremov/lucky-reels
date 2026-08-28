export type GatewayEnv = {
  PAYMENT_API_URL?: string;
  PAYMENT_PUBLIC_KEY?: string;
  PAYMENT_PRIVATE_KEY?: string;
  PAYMENT_INTEGRITY_KEY?: string;
};

export type GatewaySelection =
  | { kind: 'live'; config: { apiUrl: string; publicKey: string; privateKey: string; integrityKey: string } }
  | { kind: 'stub'; reason: 'not configured' | 'partially configured'; missing: string[] };

const REQUIRED = [
  'PAYMENT_API_URL',
  'PAYMENT_PUBLIC_KEY',
  'PAYMENT_PRIVATE_KEY',
  'PAYMENT_INTEGRITY_KEY',
] as const;

/**
 * The live adapter binds only when every key is present. A partial set binds the
 * stub and reports what is missing: half-configured is a mistake, not a mode,
 * and silently going live on three keys out of four would be worse than not
 * going live at all.
 */
export function selectGateway(env: GatewayEnv): GatewaySelection {
  const missing = REQUIRED.filter((key) => !env[key]?.trim());

  if (missing.length === 0) {
    return {
      kind: 'live',
      config: {
        apiUrl: env.PAYMENT_API_URL!.trim().replace(/\/+$/, ''),
        publicKey: env.PAYMENT_PUBLIC_KEY!.trim(),
        privateKey: env.PAYMENT_PRIVATE_KEY!.trim(),
        integrityKey: env.PAYMENT_INTEGRITY_KEY!.trim(),
      },
    };
  }

  return {
    kind: 'stub',
    reason: missing.length === REQUIRED.length ? 'not configured' : 'partially configured',
    missing: [...missing],
  };
}
