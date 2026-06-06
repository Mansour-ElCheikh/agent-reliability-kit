/**
 * Exit codes per canonical/emitter-contract.md §2.
 * Each emitter's CLI returns one of these.
 */
export const EXIT_OK = 0;
export const EXIT_INVOCATION_ERROR = 1;
export const EXIT_INPUT_ERROR = 2;
export const EXIT_MODE_CONFLICT = 3;
export const EXIT_AUTHOR_BUG = 4;

export type ExitCode =
  | typeof EXIT_OK
  | typeof EXIT_INVOCATION_ERROR
  | typeof EXIT_INPUT_ERROR
  | typeof EXIT_MODE_CONFLICT
  | typeof EXIT_AUTHOR_BUG;
