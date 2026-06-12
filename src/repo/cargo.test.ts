import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cargoMemberRoots,
  parseCargoMetadata,
  rustWorkspaceGlobs,
  rustWorkspaceGlobsFromRoots,
} from './cargo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => path.join(here, '__fixtures__', name);

describe('Cargo workspace metadata', () => {
  it('parses the useful shape and rejects malformed metadata', () => {
    expect(
      parseCargoMetadata(
        JSON.stringify({
          packages: [{ id: 'a', manifest_path: '/realm/a/Cargo.toml' }],
          workspace_members: ['a'],
        })
      )
    ).toEqual({
      packages: [{ id: 'a', manifest_path: '/realm/a/Cargo.toml' }],
      workspace_members: ['a'],
    });
    expect(parseCargoMetadata('not json')).toBeNull();
    expect(parseCargoMetadata('{"packages":[]}')).toBeNull();
  });

  it('turns workspace member manifest paths into repo-relative roots', () => {
    const raw = JSON.stringify({
      packages: [
        {
          id: 'core',
          manifest_path: '/realm/workspace-crab/crates/core/Cargo.toml',
        },
        {
          id: 'cli',
          manifest_path: '/realm/workspace-crab/crates/cli/Cargo.toml',
        },
        {
          id: 'outside',
          manifest_path: '/elsewhere/outside/Cargo.toml',
        },
      ],
      workspace_members: ['core', 'cli', 'outside'],
    });
    expect(cargoMemberRoots(raw, '/realm/workspace-crab')).toEqual([
      'crates/core',
      'crates/cli',
    ]);
  });

  it('builds source and test globs only for multi-member workspaces', () => {
    expect(rustWorkspaceGlobsFromRoots(['crates/core'])).toBeNull();
    expect(rustWorkspaceGlobsFromRoots(['crates/core', 'crates/cli'])).toEqual({
      sourceGlobs: ['crates/core/src/**/*.rs', 'crates/cli/src/**/*.rs'],
      testGlobs: [
        'crates/core/tests/**/*.rs',
        'crates/core/src/**/*_tests.rs',
        'crates/cli/tests/**/*.rs',
        'crates/cli/src/**/*_tests.rs',
      ],
    });
  });

  it('asks Cargo to resolve a real fixture workspace', async () => {
    expect(await rustWorkspaceGlobs(fixture('workspace-crab'))).toEqual({
      sourceGlobs: ['crates/core/src/**/*.rs', 'crates/cli/src/**/*.rs'],
      testGlobs: [
        'crates/core/tests/**/*.rs',
        'crates/core/src/**/*_tests.rs',
        'crates/cli/tests/**/*.rs',
        'crates/cli/src/**/*_tests.rs',
      ],
    });
  });
});

