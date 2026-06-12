import { describe, expect, it } from 'vitest';
import type { ToolRequirement } from '../types.js';
import { auditArmory, commandBinary, findTool, missingTools } from './toolchain.js';

const req = (binary: string, neededFor: 'tests' | 'coverage' = 'tests'): ToolRequirement => ({
  binary,
  installUrl: `https://example.invalid/install/${binary}`,
  neededFor,
});

describe('commandBinary (pure)', () => {
  it('reads the binary off the front of a command', () => {
    expect(commandBinary('go test ./...')).toBe('go');
    expect(commandBinary('  cargo llvm-cov --json')).toBe('cargo');
  });

  it('shrugs at an empty command', () => {
    expect(commandBinary('')).toBe('');
    expect(commandBinary('   ')).toBe('');
  });
});

describe('missingTools (pure)', () => {
  it('reports only the bare racks', () => {
    const racks = new Set(['go']);
    const missing = missingTools([req('go'), req('cargo-llvm-cov', 'coverage')], (b) =>
      racks.has(b)
    );
    expect(missing.map((m) => m.binary)).toEqual(['cargo-llvm-cov']);
  });

  it('reports nothing when the armory is fully stocked', () => {
    expect(missingTools([req('go')], () => true)).toEqual([]);
  });

  it('keeps every duty a missing binary was needed for', () => {
    const missing = missingTools([req('cargo'), req('cargo', 'coverage')], () => false);
    expect(missing).toHaveLength(2);
  });
});

describe('findTool (the inspector walks the racks)', () => {
  it('finds node, which must exist wherever these trials run', async () => {
    const paths = await findTool('node');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('finds nothing for a blade no smith ever forged', async () => {
    expect(await findTool('gme-no-such-binary-9000')).toEqual([]);
  });

  it('refuses dishonest names rather than passing them to a shell', async () => {
    expect(await findTool('node; rm -rf /')).toEqual([]);
    expect(await findTool('$(whoami)')).toEqual([]);
    expect(await findTool('')).toEqual([]);
  });
});

describe('auditArmory (IO)', () => {
  it('reports the missing and stays silent on the present', async () => {
    const missing = await auditArmory([
      req('node'),
      req('gme-no-such-binary-9000', 'coverage'),
    ]);
    expect(missing.map((m) => m.binary)).toEqual(['gme-no-such-binary-9000']);
  });

  it('reports nothing for an empty requisition', async () => {
    expect(await auditArmory([])).toEqual([]);
  });
});
