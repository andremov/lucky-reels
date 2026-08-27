import { existsSync, readFileSync } from 'node:fs';

export type SslOption = false | { ca: string; rejectUnauthorized: true };

export type SslInput = {
  caCert?: string;
  caPath?: string;
  insecureOptOut?: boolean;
};

export class MissingDatabaseCertificateError extends Error {
  constructor() {
    super(
      'No database CA certificate configured. Set DATABASE_CA_PATH (or DATABASE_CA_CERT). ' +
        'Download it from Supabase: Project Settings > Database > SSL Configuration. ' +
        'For a local server with no TLS, set DATABASE_SSL=disable.',
    );
    this.name = 'MissingDatabaseCertificateError';
  }
}

// The pooler accepts plaintext, so an unconfigured client reaches production in
// the clear without erroring. Hence no fallback: either we verify against a CA
// or the caller opts out by name.
export function resolveDatabaseSsl({ caCert, caPath, insecureOptOut }: SslInput): SslOption {
  const ca = readCa(caCert, caPath);

  if (ca) return { ca, rejectUnauthorized: true };
  if (insecureOptOut) return false;

  throw new MissingDatabaseCertificateError();
}

function readCa(caCert?: string, caPath?: string): string | null {
  const inline = caCert?.trim();
  if (inline) return inline;

  const path = caPath?.trim();
  if (!path) return null;
  if (!existsSync(path)) return null;

  const contents = readFileSync(path, 'utf8').trim();
  return contents.length > 0 ? contents : null;
}
