import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectLanguage } from './detect.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => path.join(here, '__fixtures__', name);

describe('the Realm Linguist names each tongue from a lone banner', () => {
  it('go.mod flies the gopher banner', () => {
    expect(detectLanguage(['go.mod', 'main.go', 'README.md'])).toBe('go');
  });

  it('Cargo.toml flies the crab banner', () => {
    expect(detectLanguage(['Cargo.toml', 'src'])).toBe('rust');
  });

  it.each(['pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt'])(
    '%s flies the serpent banner',
    (manifest) => {
      expect(detectLanguage([manifest, 'src'])).toBe('python');
    }
  );

  it('package.json flies the old npm banner', () => {
    expect(detectLanguage(['package.json', 'src'])).toBe('js');
  });
});

describe('precedence when many banners fly at one gate', () => {
  it('go outranks every other banner', () => {
    expect(
      detectLanguage(['go.mod', 'Cargo.toml', 'pyproject.toml', 'package.json'])
    ).toBe('go');
  });

  it('rust outranks python and js', () => {
    expect(detectLanguage(['Cargo.toml', 'setup.py', 'package.json'])).toBe('rust');
  });

  it('python outranks a package.json flown as mere tooling', () => {
    expect(detectLanguage(['requirements.txt', 'package.json'])).toBe('python');
  });

  it('the tower-of-babel fixture speaks go first', () => {
    expect(detectLanguage(readdirSync(fixture('tower-of-babel')))).toBe('go');
  });
});

describe('a bare gate', () => {
  it('defaults to js, the old standard-issue assumption', () => {
    expect(detectLanguage([])).toBe('js');
    expect(detectLanguage(['README.md', '.gitignore'])).toBe('js');
  });
});
