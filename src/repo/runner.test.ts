import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHRONICLE_LIMIT, runCommand, tailOfChronicle } from './runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('tailOfChronicle (pure)', () => {
  it('leaves short chronicles intact', () => {
    expect(tailOfChronicle('huzzah', 10)).toBe('huzzah');
  });

  it('keeps only the freshest characters of a long chronicle', () => {
    expect(tailOfChronicle('abcdefgh', 3)).toBe('fgh');
  });
});

describe('runCommand, the Herald of Trials', () => {
  it('resolves (never rejects) on a nonzero exit, carrying the code', async () => {
    const run = await runCommand(
      `node -e 'process.stdout.write("huzzah"); process.exit(3)'`,
      here
    );
    expect(run.exitCode).toBe(3);
    expect(run.output).toContain('huzzah');
    expect(run.command).toContain('huzzah');
    expect(run.cwd).toBe(here);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('mingles stderr into the chronicle like any battle-cry', async () => {
    const run = await runCommand(
      `node -e 'console.error("woe and lamentation"); process.exit(0)'`,
      here
    );
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain('woe and lamentation');
  });

  it('resolves even when the command never drew its blade', async () => {
    const run = await runCommand(
      'definitely-not-a-real-command-in-this-realm-xyz',
      here
    );
    expect(run.exitCode).not.toBe(0);
  });

  it('tail-truncates the stored chronicle to the limit, keeping the end', async () => {
    const run = await runCommand(
      `node -e 'process.stdout.write("x".repeat(20000) + "THE-FINAL-WORD")'`,
      here
    );
    expect(run.exitCode).toBe(0);
    expect(run.output.length).toBeLessThanOrEqual(CHRONICLE_LIMIT);
    expect(run.output.endsWith('THE-FINAL-WORD')).toBe(true);
  });

  it('streams chunks to onOutput as they arrive', async () => {
    const heard: string[] = [];
    await runCommand(
      `node -e 'process.stdout.write("first-cry "); process.stdout.write("second-cry")'`,
      here,
      (chunk) => heard.push(chunk)
    );
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.join('')).toContain('first-cry');
    expect(heard.join('')).toContain('second-cry');
  });

  it('survives a scribe (onOutput) that throws', async () => {
    const run = await runCommand(
      `node -e 'process.stdout.write("steady on")'`,
      here,
      () => {
        throw new Error('the scribe fainted');
      }
    );
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain('steady on');
  });
});
