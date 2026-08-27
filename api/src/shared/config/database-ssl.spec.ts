import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MissingDatabaseCertificateError, resolveDatabaseSsl } from './database-ssl';

const PEM = '-----BEGIN CERTIFICATE-----\nabc123\n-----END CERTIFICATE-----';

describe('resolveDatabaseSsl', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ssl-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (contents: string) => {
    const path = join(dir, 'ca.crt');
    writeFileSync(path, contents);
    return path;
  };

  describe('with a certificate', () => {
    it('verifies against an inline certificate', () => {
      expect(resolveDatabaseSsl({ caCert: PEM })).toEqual({ ca: PEM, rejectUnauthorized: true });
    });

    it('verifies against a certificate on disk', () => {
      expect(resolveDatabaseSsl({ caPath: write(PEM) })).toEqual({
        ca: PEM,
        rejectUnauthorized: true,
      });
    });

    it('prefers the inline certificate when both are given', () => {
      const ssl = resolveDatabaseSsl({
        caCert: PEM,
        caPath: write('-----BEGIN CERTIFICATE-----\nzzz\n-----END CERTIFICATE-----'),
      });

      expect(ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    });

    it('keeps verification on even when the opt-out is set', () => {
      const ssl = resolveDatabaseSsl({ caCert: PEM, insecureOptOut: true });

      expect(ssl).toMatchObject({ rejectUnauthorized: true });
    });
  });

  describe('without a certificate', () => {
    it('refuses to build a connection at all', () => {
      expect(() => resolveDatabaseSsl({})).toThrow(MissingDatabaseCertificateError);
    });

    it('refuses when the path does not exist', () => {
      expect(() => resolveDatabaseSsl({ caPath: join(dir, 'missing.crt') })).toThrow(
        MissingDatabaseCertificateError,
      );
    });

    it('refuses when the file is empty', () => {
      expect(() => resolveDatabaseSsl({ caPath: write('   ') })).toThrow(
        MissingDatabaseCertificateError,
      );
    });

    it('ignores a blank inline certificate', () => {
      expect(() => resolveDatabaseSsl({ caCert: '   ' })).toThrow(MissingDatabaseCertificateError);
    });

    it('ignores a blank path', () => {
      expect(() => resolveDatabaseSsl({ caPath: '   ' })).toThrow(MissingDatabaseCertificateError);
    });

    it('names the way out in the error message', () => {
      expect(() => resolveDatabaseSsl({})).toThrow(/DATABASE_SSL=disable/);
    });
  });

  describe('explicit opt-out', () => {
    it('drops TLS only when asked by name', () => {
      expect(resolveDatabaseSsl({ insecureOptOut: true })).toBe(false);
    });

    it('never yields TLS that accepts any certificate', () => {
      const outcomes = [
        resolveDatabaseSsl({ caCert: PEM }),
        resolveDatabaseSsl({ insecureOptOut: true }),
      ];

      for (const ssl of outcomes) {
        expect(ssl === false || ssl.rejectUnauthorized === true).toBe(true);
      }
    });
  });
});
