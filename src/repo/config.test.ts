import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultConfig,
  guessCommandsFromScripts,
  mergeScrollOverDefaults,
  resolveConfig,
} from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => path.join(here, '__fixtures__', name);

describe('the Quartermaster reads the scroll at the gate', () => {
  it('honors gme.config.json over every divination', async () => {
    const cfg = await resolveConfig(fixture('keep-of-config'));
    expect(cfg.testCommand).toBe('make trial');
    expect(cfg.coverageCommand).toBe('make trial-by-fire');
    expect(cfg.e2eCommand).toBe('make siege');
    expect(cfg.coverageSummaryGlobs).toEqual(['artifacts/coverage-summary.json']);
    // Fields the scroll stays silent on keep their standard-issue values.
    expect(cfg.sourceGlobs).toEqual(defaultConfig(cfg.repoPath).sourceGlobs);
    expect(cfg.excludeGlobs).toContain('**/node_modules/**');
  });

  it('pins repoPath to the absolute fixture path', async () => {
    const cfg = await resolveConfig(fixture('keep-of-config'));
    expect(path.isAbsolute(cfg.repoPath)).toBe(true);
    expect(cfg.repoPath).toBe(path.resolve(fixture('keep-of-config')));
  });
});

describe('the Quartermaster divines from package.json scripts', () => {
  it('reads castle-greyhollow scripts into npm commands', async () => {
    const cfg = await resolveConfig(fixture('castle-greyhollow'));
    expect(cfg.testCommand).toBe('npm test');
    expect(cfg.coverageCommand).toBe('npm run test:coverage');
    expect(cfg.e2eCommand).toBe('npm run test:e2e');
  });

  it('falls back to standard-issue kit in an empty barrow', async () => {
    const cfg = await resolveConfig(fixture('empty-barrow'));
    expect(cfg.testCommand).toBe('npx vitest run');
    expect(cfg.coverageCommand).toBe('npx vitest run --coverage');
    expect(cfg.e2eCommand).toBeUndefined();
    expect(cfg.coverageSummaryGlobs).toEqual([
      'coverage/coverage-summary.json',
      '**/coverage/coverage-summary.json',
    ]);
  });
});

describe('guessCommandsFromScripts (pure divination)', () => {
  it('prefers test:coverage over coverage', () => {
    expect(
      guessCommandsFromScripts({ 'test:coverage': 'a', coverage: 'b' })
        .coverageCommand
    ).toBe('npm run test:coverage');
  });

  it('takes a lone coverage script when test:coverage is absent', () => {
    expect(guessCommandsFromScripts({ coverage: 'nyc mocha' }).coverageCommand).toBe(
      'npm run coverage'
    );
  });

  it('divines nothing from an empty scripts block', () => {
    expect(guessCommandsFromScripts({})).toEqual({});
  });

  it('ignores blank and non-string script entries', () => {
    expect(guessCommandsFromScripts({ test: '   ', coverage: 7 })).toEqual({});
  });
});

describe('mergeScrollOverDefaults (pure merging)', () => {
  const defaults = defaultConfig('/sworn/realm');

  it('rejects fields of the wrong shape', () => {
    const merged = mergeScrollOverDefaults(defaults, {
      testCommand: 42,
      sourceGlobs: 'not-an-array',
      excludeGlobs: ['ok/**', 99],
    });
    expect(merged.testCommand).toBe(defaults.testCommand);
    expect(merged.sourceGlobs).toEqual(defaults.sourceGlobs);
    expect(merged.excludeGlobs).toEqual(defaults.excludeGlobs);
  });

  it('never lets the scroll move the castle (repoPath)', () => {
    const merged = mergeScrollOverDefaults(defaults, {
      repoPath: '/somewhere/treacherous',
    });
    expect(merged.repoPath).toBe('/sworn/realm');
  });
});
