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

describe('the Realm Linguist guides the ledger', () => {
  it('hears go first at the polyglot tower-of-babel gate', async () => {
    const cfg = await resolveConfig(fixture('tower-of-babel'));
    expect(cfg.language).toBe('go');
    // A non-js realm gets no package.json divination, even with scripts present.
    expect(cfg.testCommand).not.toBe('npm test');
  });

  it('keeps js realms exactly as before', async () => {
    const cfg = await resolveConfig(fixture('castle-greyhollow'));
    expect(cfg.language).toBe('js');
    expect(cfg.coverageFormat).toBe('istanbul-summary');
    expect(cfg.testGlobs.length).toBeGreaterThan(0);
  });

  it('a bare barrow still defaults to the js kit', async () => {
    const cfg = await resolveConfig(fixture('empty-barrow'));
    expect(cfg.language).toBe('js');
    expect(cfg.coverageFormat).toBe('istanbul-summary');
  });
});

describe('the scroll may declare the tongue outright', () => {
  const defaults = defaultConfig('/sworn/realm');

  it('honors a declared language', () => {
    expect(mergeScrollOverDefaults(defaults, { language: 'python' }).language).toBe(
      'python'
    );
  });

  it('rejects a tongue nobody speaks', () => {
    expect(mergeScrollOverDefaults(defaults, { language: 'cobol' }).language).toBe(
      'js'
    );
  });

  it('honors a declared dialect and custom drill yards', () => {
    const merged = mergeScrollOverDefaults(defaults, {
      coverageFormat: 'coverage-py-json',
      testGlobs: ['drills/**'],
    });
    expect(merged.coverageFormat).toBe('coverage-py-json');
    expect(merged.testGlobs).toEqual(['drills/**']);
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

  it('accepts well-shaped packages and excludePackages globs', () => {
    const merged = mergeScrollOverDefaults(defaults, {
      packages: ['packages/*', '.'],
      excludePackages: ['packages/legacy-*'],
    });
    expect(merged.packages).toEqual(['packages/*', '.']);
    expect(merged.excludePackages).toEqual(['packages/legacy-*']);
  });

  it('rejects ill-shaped packages globs and leaves them unset', () => {
    const merged = mergeScrollOverDefaults(defaults, {
      packages: 'packages/*',
      excludePackages: [42],
    });
    expect(merged.packages).toBeUndefined();
    expect(merged.excludePackages).toBeUndefined();
  });
});

describe('the Quartermaster sniffs the test script for a known runner', () => {
  it('divines a jest coverage command from a jest trial', () => {
    const divined = guessCommandsFromScripts({ test: 'jest --runInBand' });
    expect(divined.testCommand).toBe('npm test');
    expect(divined.coverageCommand).toBe(
      'npx jest --coverage --coverageReporters=json-summary'
    );
  });

  it('wraps the node native runner in c8 when "node --test" appears', () => {
    const divined = guessCommandsFromScripts({ test: 'node --test ./test' });
    expect(divined.coverageCommand).toBe(
      'npx c8 --reporter=json-summary node --test'
    );
  });

  it('recognizes the node:test spelling too', () => {
    const divined = guessCommandsFromScripts({
      test: 'glob -c "node --import tsx" node:test',
    });
    expect(divined.coverageCommand).toBe(
      'npx c8 --reporter=json-summary node --test'
    );
  });
});

describe('explicit coverage scripts outrank the sniffed runner', () => {
  it('test:coverage wins even when the trial smells of jest', () => {
    const divined = guessCommandsFromScripts({
      test: 'jest',
      'test:coverage': 'jest --coverage',
    });
    expect(divined.coverageCommand).toBe('npm run test:coverage');
  });

  it('a lone coverage script wins over a node --test trial', () => {
    const divined = guessCommandsFromScripts({
      test: 'node --test',
      coverage: 'c8 node --test',
    });
    expect(divined.coverageCommand).toBe('npm run coverage');
  });
});

describe('the sniff stays its hand when the kit already serves', () => {
  it('a vitest trial divines no extra coverage command', () => {
    const divined = guessCommandsFromScripts({ test: 'vitest run' });
    expect(divined.testCommand).toBe('npm test');
    expect(divined.coverageCommand).toBeUndefined();
  });

  it('an unknown runner divines no coverage command either', () => {
    const divined = guessCommandsFromScripts({ test: 'mocha spec/' });
    expect(divined.coverageCommand).toBeUndefined();
  });

  it('ignores blank and non-string test scripts entirely', () => {
    expect(guessCommandsFromScripts({ test: '   ' })).toEqual({});
    expect(guessCommandsFromScripts({ test: 42 })).toEqual({});
    expect(guessCommandsFromScripts({ test: ['jest'] })).toEqual({});
  });
});
