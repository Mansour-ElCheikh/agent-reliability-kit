// Imports 'vscode' but is NOT in approved_files (only src/boundary.ts is).
// → R4_boundary_import_isolation FIRES (error).
// Also has no co-located test → R2 fires too.
import * as vscode from 'vscode';
export const leak = (): unknown => vscode;
