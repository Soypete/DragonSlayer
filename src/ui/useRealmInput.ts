/**
 * useInput, but courteous: stands down when the terminal cannot grant
 * raw mode (e.g. piped stdin), so a TTY-less boot still renders cleanly
 * instead of throwing Ink's raw-mode error.
 */

import { useInput, useStdin } from 'ink';

type InputHandler = Parameters<typeof useInput>[0];

export function useRealmInput(handler: InputHandler, isActive = true): void {
  const { isRawModeSupported } = useStdin();
  // Coerce: Ink reports stdin.isTTY here, which is `undefined` (not false)
  // for piped stdin — and useInput only stands down when isActive === false.
  useInput(handler, { isActive: Boolean(isRawModeSupported) && isActive });
}
