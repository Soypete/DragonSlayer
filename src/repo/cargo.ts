/**
 * cargo.ts — a small envoy to Cargo itself.
 *
 * Dragonslayer does not try to understand Cargo workspaces from TOML. Cargo
 * already knows the resolved package graph, including members, excludes and
 * glob expansion, so we ask `cargo metadata --no-deps` and translate that into
 * the source/test globs the cartographer needs.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';

export interface RustWorkspaceGlobs {
  sourceGlobs: string[];
  testGlobs: string[];
}

interface CargoMetadataPackage {
  id: string;
  manifest_path: string;
}

interface CargoMetadata {
  packages: CargoMetadataPackage[];
  workspace_members: string[];
}

function isCargoMetadataPackage(value: unknown): value is CargoMetadataPackage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const pkg = value as Record<string, unknown>;
  return typeof pkg.id === 'string' && typeof pkg.manifest_path === 'string';
}

export function parseCargoMetadata(raw: string): CargoMetadata | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const doc = parsed as Record<string, unknown>;
    if (
      !Array.isArray(doc.packages) ||
      !doc.packages.every(isCargoMetadataPackage) ||
      !Array.isArray(doc.workspace_members) ||
      !doc.workspace_members.every((id) => typeof id === 'string')
    ) {
      return null;
    }
    return {
      packages: doc.packages,
      workspace_members: doc.workspace_members,
    };
  } catch {
    return null;
  }
}

export function cargoMemberRoots(raw: string, repoPath: string): string[] {
  const metadata = parseCargoMetadata(raw);
  if (!metadata) return [];

  const byId = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const roots: string[] = [];
  for (const memberId of metadata.workspace_members) {
    const pkg = byId.get(memberId);
    if (!pkg) continue;
    const dir = path.dirname(pkg.manifest_path);
    const rel = path.relative(repoPath, dir).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
    roots.push(rel);
  }
  return [...new Set(roots)];
}

export function rustWorkspaceGlobsFromRoots(roots: string[]): RustWorkspaceGlobs | null {
  if (roots.length <= 1) return null;
  return {
    sourceGlobs: roots.map((root) =>
      root === '' ? 'src/**/*.rs' : `${root}/src/**/*.rs`
    ),
    testGlobs: roots.flatMap((root) => [
      root === '' ? 'tests/**/*.rs' : `${root}/tests/**/*.rs`,
      root === '' ? 'src/**/*_tests.rs' : `${root}/src/**/*_tests.rs`,
    ]),
  };
}

function runCargoMetadata(repoPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('cargo', ['metadata', '--no-deps', '--format-version', '1'], {
        cwd: repoPath,
      });
    } catch {
      resolve(null);
      return;
    }

    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? stdout : null));
  });
}

export async function rustWorkspaceGlobs(
  repoPath: string
): Promise<RustWorkspaceGlobs | null> {
  const raw = await runCargoMetadata(repoPath);
  if (!raw) return null;
  return rustWorkspaceGlobsFromRoots(cargoMemberRoots(raw, repoPath));
}

