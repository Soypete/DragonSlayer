import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadRegistry, registerRepo, registryPath, withRepo } from './registry.js';

describe('the Realm Registry', () => {
  let home: string;
  let priorHome: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'gme-home-'));
    priorHome = process.env.HOME;
    process.env.HOME = home; // os.homedir() honors $HOME on POSIX
  });

  afterEach(() => {
    if (priorHome === undefined) delete process.env.HOME;
    else process.env.HOME = priorHome;
    rmSync(home, { recursive: true, force: true });
  });

  describe('loadRegistry', () => {
    it('yields an empty ledger when none has been drawn up', () => {
      expect(loadRegistry()).toEqual({ version: 1, repos: [] });
    });

    it('yields an empty ledger over a corrupt one', () => {
      mkdirSync(dirname(registryPath()), { recursive: true });
      writeFileSync(registryPath(), '{not json');
      expect(loadRegistry()).toEqual({ version: 1, repos: [] });
    });

    it('drops non-string entries and dedupes resolved paths', () => {
      mkdirSync(dirname(registryPath()), { recursive: true });
      writeFileSync(
        registryPath(),
        JSON.stringify({ version: 1, repos: ['/realm/keep', 42, '/realm/keep/'] })
      );
      expect(loadRegistry().repos).toEqual(['/realm/keep']);
    });
  });

  describe('withRepo (pure)', () => {
    it('charts a new realm as an absolute path', () => {
      const next = withRepo({ version: 1, repos: [] }, '/realm/keep');
      expect(next.repos).toEqual(['/realm/keep']);
    });

    it('returns the same ledger when the realm is already charted', () => {
      const registry = { version: 1 as const, repos: ['/realm/keep'] };
      expect(withRepo(registry, '/realm/keep')).toBe(registry);
    });
  });

  describe('registerRepo', () => {
    it('draws up the ledger on first charting', () => {
      registerRepo('/realm/keep');
      expect(loadRegistry().repos).toEqual(['/realm/keep']);
    });

    it('appends without duplicating', () => {
      registerRepo('/realm/keep');
      registerRepo('/realm/keep');
      registerRepo('/realm/other-keep');
      expect(loadRegistry().repos).toEqual(['/realm/keep', '/realm/other-keep']);
    });

    it('preserves unknown fields a steward wrote by hand', () => {
      mkdirSync(dirname(registryPath()), { recursive: true });
      writeFileSync(
        registryPath(),
        JSON.stringify({ version: 1, repos: ['/realm/keep'], motto: 'no untested line' })
      );
      registerRepo('/realm/other-keep');
      const ledger = JSON.parse(readFileSync(registryPath(), 'utf8')) as Record<
        string,
        unknown
      >;
      expect(ledger.motto).toBe('no untested line');
      expect(ledger.repos).toEqual(['/realm/keep', '/realm/other-keep']);
    });
  });
});
