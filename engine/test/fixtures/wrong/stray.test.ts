// A *.test.ts OUTSIDE any declared testing-manifest scope (only src/**/*.test.ts
// is declared). → R3_testing_manifest_alignment FIRES (error).
export const stray = true;
