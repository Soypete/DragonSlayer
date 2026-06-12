import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultConfig, resolveConfig } from '../config.js';
import { scanRepo } from '../scanner.js';
import { adapterForFormat, adapterForLanguage } from './adapter.js';
import { emptyMetric } from './metrics.js';
import { pythonAdapter } from './python.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SPIRE = path.join(here, '..', '__fixtures__', 'serpents-spire');

const ctx = {
  repoPath: '/realm/spire',
  source: 'coverage.json',
  generatedAt: 777,
};

describe('the serpent interpreter stands sworn at the guild', () => {
  it('answers for the coverage-py-json dialect', () => {
    expect(adapterForFormat('coverage-py-json')).toBe(pythonAdapter);
  });

  it('answers for the python tongue', () => {
    expect(adapterForLanguage('python')).toBe(pythonAdapter);
  });

  it('equips the standard-issue pytest kit', () => {
    expect(pythonAdapter.defaults.testCommand).toBe('pytest');
    expect(pythonAdapter.defaults.coverageCommand).toBe(
      'pytest --cov --cov-report=json'
    );
    expect(pythonAdapter.requiredTools.map((t) => t.binary)).toEqual([
      'pytest',
      'pytest',
    ]);
  });
});

describe('the serpent interpreter reads the serpents-spire proof', () => {
  const raw = readFileSync(path.join(SPIRE, 'coverage.json'), 'utf8');

  it('parses the report into sorted repo-relative files', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx);
    expect(data).not.toBeNull();
    expect(data!.files.map((f) => f.path)).toEqual([
      'spire/scales.py',
      'spire/venom.py',
    ]);
    expect(data!.source).toBe('coverage.json');
    expect(data!.generatedAt).toBe(777);
  });

  it('weighs lines from the executed/missing lists', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    const [scales, venom] = data.files;
    expect(venom!.lines).toEqual({ total: 6, covered: 6, pct: 100 });
    expect(scales!.lines).toEqual({ total: 10, covered: 7, pct: 70 });
  });

  it('weighs statements from the summary block', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    const [scales, venom] = data.files;
    expect(venom!.statements).toEqual({ total: 6, covered: 6, pct: 100 });
    expect(scales!.statements).toEqual({ total: 10, covered: 7, pct: 70 });
  });

  it('weighs branches when spoken of, and leaves them unweighed when not', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    const [scales, venom] = data.files;
    expect(scales!.branches).toEqual({ total: 4, covered: 2, pct: 50 });
    expect(venom!.branches).toEqual(emptyMetric());
  });

  it('never weighs functions — the serpent tongue has no word for them', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    for (const file of data.files) {
      expect(file.functions).toEqual(emptyMetric());
    }
  });

  it('sums totals from the files, not the report’s own totals block', () => {
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    expect(data.totals.lines).toEqual({ total: 16, covered: 13, pct: 81.25 });
    expect(data.totals.statements).toEqual({ total: 16, covered: 13, pct: 81.25 });
    expect(data.totals.branches).toEqual({ total: 4, covered: 2, pct: 50 });
    expect(data.totals.functions).toEqual({ total: 0, covered: 0, pct: 0 });
  });
});

describe('the serpent interpreter and strange accents', () => {
  it('translates windows separators and absolute paths', () => {
    const raw = JSON.stringify({
      files: {
        'spire\\venom.py': {
          executed_lines: [1],
          missing_lines: [],
          summary: { covered_lines: 1, num_statements: 1, percent_covered: 100 },
        },
        '/realm/spire/spire/scales.py': {
          executed_lines: [1],
          missing_lines: [2],
          summary: { covered_lines: 1, num_statements: 2, percent_covered: 50 },
        },
      },
    });
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    expect(data.files.map((f) => f.path)).toEqual([
      'spire/scales.py',
      'spire/venom.py',
    ]);
  });

  it('tolerates missing executed/missing line lists (treated as empty)', () => {
    const raw = JSON.stringify({
      files: {
        'spire/hollow.py': {
          summary: { covered_lines: 0, num_statements: 0, percent_covered: 100 },
        },
      },
    });
    const data = pythonAdapter.parseCoverage(raw, ctx)!;
    // Empty ground is fully proven per file — no immortal dragons.
    expect(data.files[0]!.lines).toEqual({ total: 0, covered: 0, pct: 100 });
  });

  it('scores an empty realm 0, never a hollow 100', () => {
    const data = pythonAdapter.parseCoverage(JSON.stringify({ files: {} }), ctx)!;
    expect(data.files).toEqual([]);
    expect(data.totals.lines).toEqual({ total: 0, covered: 0, pct: 0 });
    expect(data.totals.statements.pct).toBe(0);
  });

  it('returns null for forged or water-damaged proofs', () => {
    expect(pythonAdapter.parseCoverage('not json at all', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('null', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('[1,2,3]', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('{}', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('{"files": 7}', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('{"files": [1]}', ctx)).toBeNull();
    expect(pythonAdapter.parseCoverage('{"files": null}', ctx)).toBeNull();
  });
});

describe('the Quartermaster reads the serpents-spire gate', () => {
  it('detects python and equips the pytest kit', async () => {
    const cfg = await resolveConfig(SPIRE);
    expect(cfg.language).toBe('python');
    expect(cfg.coverageFormat).toBe('coverage-py-json');
    expect(cfg.testCommand).toBe('pytest');
    expect(cfg.coverageCommand).toBe('pytest --cov --cov-report=json');
    expect(cfg.coverageSummaryGlobs).toEqual(['coverage.json']);
  });
});

describe('the Royal Cartographer surveys the serpents-spire', () => {
  it('unearths the committed coverage.json with repo-relative paths', async () => {
    const scan = await scanRepo(defaultConfig(SPIRE, 'python'));
    expect(scan.coverage).not.toBeNull();
    expect(scan.coverage!.source).toBe('coverage.json');
    expect(scan.coverage!.files.map((f) => f.path)).toEqual([
      'spire/scales.py',
      'spire/venom.py',
    ]);
    expect(scan.coverage!.totals.lines).toEqual({
      total: 16,
      covered: 13,
      pct: 81.25,
    });
    expect(scan.language).toBe('python');
  });

  it('keeps the drill yards (tests/) out of the dragon census', async () => {
    const scan = await scanRepo(defaultConfig(SPIRE, 'python'));
    expect(scan.sourceFiles).toEqual(['spire/scales.py', 'spire/venom.py']);
    expect(scan.testFiles).toEqual(['tests/test_venom.py']);
  });
});
