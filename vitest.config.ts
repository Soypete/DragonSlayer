import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Never glob Stryker's sandbox copies of the project (or other build output).
    exclude: ['**/node_modules/**', '**/dist/**', '**/.stryker-tmp/**', '**/reports/**'],
    // Several suites (the Chronicle/state and App tests) swap process.env.HOME to
    // sandbox the save vault. HOME is a process global, so those files must never
    // share a process — isolate every test file in its own forked process. This
    // is also what lets the Stryker mutation runner execute the whole suite at
    // once without vaults leaking between files.
    pool: 'forks',
    isolate: true,
  },
});
