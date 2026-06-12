/**
 * toolchain.ts — the Armory Inspector.
 *
 * Before any trial is called, the inspector walks the racks: are the binaries
 * the commands need actually on the PATH? `which -a` never lies (and on
 * windows the quartermaster asks `where` instead). The inspector NEVER
 * blocks a quest — a bare rack is reported, not enforced, so stewards with
 * exotic kit can still ride.
 */

import { spawn } from 'node:child_process';
import type { ToolRequirement } from '../types.js';

/** First word of a command — the binary the shell will go looking for. Pure. */
export function commandBinary(command: string): string {
  return command.trim().split(/\s+/)[0] ?? '';
}

/** Pure: which requirements lack a blade on the rack. */
export function missingTools(
  required: ToolRequirement[],
  isInstalled: (binary: string) => boolean
): ToolRequirement[] {
  const verdicts = new Map<string, boolean>();
  return required.filter((req) => {
    if (!verdicts.has(req.binary)) verdicts.set(req.binary, isInstalled(req.binary));
    return verdicts.get(req.binary) === false;
  });
}

/** A name the lookup command can be trusted with — no shell trickery. */
const HONEST_BINARY_NAME = /^[A-Za-z0-9._+-]+$/;

/**
 * Every path the PATH offers for a binary; [] when the rack is bare.
 * Never rejects — a failed inspection reads the same as a missing blade.
 */
export function findTool(binary: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (!HONEST_BINARY_NAME.test(binary)) {
      resolve([]);
      return;
    }
    const lookup =
      process.platform === 'win32'
        ? { cmd: 'where', args: [binary] }
        : { cmd: 'which', args: ['-a', binary] };

    let inspector: ReturnType<typeof spawn>;
    try {
      inspector = spawn(lookup.cmd, lookup.args);
    } catch {
      resolve([]);
      return;
    }

    let report = '';
    inspector.stdout?.on('data', (chunk: Buffer | string) => {
      report += chunk.toString();
    });
    inspector.on('error', () => resolve([]));
    inspector.on('close', (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }
      resolve(
        report
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '')
      );
    });
  });
}

/** Inspect the racks for every requirement; report only what's missing. */
export async function auditArmory(
  required: ToolRequirement[]
): Promise<ToolRequirement[]> {
  const binaries = [...new Set(required.map((req) => req.binary))];
  const sightings = await Promise.all(
    binaries.map(async (binary) => [binary, (await findTool(binary)).length > 0] as const)
  );
  const rack = new Map(sightings);
  return missingTools(required, (binary) => rack.get(binary) === true);
}
