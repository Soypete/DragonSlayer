import { describe, expect, it } from 'vitest';
import { resolve, join } from 'node:path';
import { resolveRepoPath, DEFAULT_DUNGEON } from './cli.js';

const CWD = '/keep/of/the/realm';
const never = () => false;
const always = () => true;

describe('resolveRepoPath — the herald at the gate', () => {
  it('honors --repo <path>', () => {
    expect(resolveRepoPath(['--repo', '../castle'], CWD, never)).toBe(
      resolve(CWD, '../castle'),
    );
  });

  it('honors --repo=<path>', () => {
    expect(resolveRepoPath(['--repo=/abs/castle'], CWD, never)).toBe('/abs/castle');
  });

  it('keeps an absolute --repo absolute', () => {
    expect(resolveRepoPath(['--repo', '/var/moat'], CWD, never)).toBe('/var/moat');
  });

  it('defaults to ./practice-dungeon when it stands', () => {
    expect(resolveRepoPath([], CWD, always)).toBe(join(CWD, DEFAULT_DUNGEON));
  });

  it('falls back to cwd when no dungeon stands', () => {
    expect(resolveRepoPath([], CWD, never)).toBe(CWD);
  });

  it('ignores a --repo flag with no value', () => {
    expect(resolveRepoPath(['--repo'], CWD, never)).toBe(CWD);
    expect(resolveRepoPath(['--repo', '--verbose'], CWD, never)).toBe(CWD);
  });

  it('checks exactly the dungeon path before defaulting', () => {
    const asked: string[] = [];
    resolveRepoPath([], CWD, (p) => {
      asked.push(p);
      return false;
    });
    expect(asked).toEqual([join(CWD, DEFAULT_DUNGEON)]);
  });
});
