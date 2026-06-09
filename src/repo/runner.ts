/**
 * runner.ts — the Herald of Trials.
 *
 * Carries a command into the repo's courtyard, lets it shout its piece
 * (stdout and stderr together, as battle-cries always mingle), and reports
 * back how the trial went. The herald NEVER falls on his own sword: a
 * failed command resolves with its exit code, it does not reject.
 */

import { spawn } from 'node:child_process';
import type { CommandRun } from '../types.js';

/** Only the last 8000 characters of a battle-cry are worth chronicling. */
export const CHRONICLE_LIMIT = 8000;

/** Tail-truncate a chronicle: keep the freshest `limit` characters. Pure. */
export function tailOfChronicle(text: string, limit: number = CHRONICLE_LIMIT): string {
  return text.length > limit ? text.slice(-limit) : text;
}

/**
 * Run a shell command with cwd set to the repo, streaming combined output
 * to `onOutput` as it arrives. Resolves with a CommandRun whatever happens:
 * nonzero exits, signals, even a command that never drew its blade.
 */
export function runCommand(
  command: string,
  cwd: string,
  onOutput?: (chunk: string) => void
): Promise<CommandRun> {
  const trialBegan = Date.now();

  return new Promise<CommandRun>((resolve) => {
    let chronicle = '';
    let settled = false;

    const absorb = (chunk: Buffer | string): void => {
      const cry = chunk.toString();
      chronicle = tailOfChronicle(chronicle + cry);
      try {
        onOutput?.(cry);
      } catch {
        // A distracted scribe must not end the trial.
      }
    };

    const adjudicate = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      resolve({
        command,
        cwd,
        exitCode,
        output: chronicle,
        durationMs: Date.now() - trialBegan,
      });
    };

    let champion: ReturnType<typeof spawn>;
    try {
      champion = spawn(command, { shell: true, cwd });
    } catch (err) {
      absorb(`the herald could not summon the command: ${(err as Error).message}\n`);
      adjudicate(-1);
      return;
    }

    champion.stdout?.on('data', absorb);
    champion.stderr?.on('data', absorb);
    champion.on('error', (err) => {
      absorb(`the command never drew its blade: ${err.message}\n`);
      adjudicate(-1);
    });
    champion.on('close', (code, signal) => {
      if (signal) {
        absorb(`struck down by signal ${signal}\n`);
      }
      adjudicate(code ?? -1);
    });
  });
}
