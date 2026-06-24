/**
 * Adopter-extensible predicate loader. Reads engine/extensions/*.{ts,js,mjs}
 * (or .ts/.js anywhere via the --extensions flag) and registers each exported
 * function as a predicate under its function name.
 *
 * For v0.1, the loader auto-discovers files under <engine-or-adopter>/extensions/
 * matching *.predicates.{js,mjs} (compiled .ts → .js handled by build step).
 * Adopters not using TS can drop .mjs files directly.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Predicate } from './types.js';
import type { PredicateRegistry } from './predicates.js';

const EXTENSION_PATTERN = /\.predicates\.(m?js)$/;

export async function loadExtensions(
  registry: PredicateRegistry,
  extensionsDir: string,
): Promise<string[]> {
  const loaded: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(extensionsDir);
  } catch {
    return loaded; // dir doesn't exist; that's fine
  }
  for (const entry of entries) {
    if (!EXTENSION_PATTERN.test(entry)) continue;
    const fullPath = path.resolve(extensionsDir, entry);
    const moduleUrl = pathToFileURL(fullPath).href;
    let mod: Record<string, unknown>;
    try {
      mod = await import(moduleUrl);
    } catch (e) {
      throw new Error(
        `Failed to import predicate extension ${fullPath}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === 'function') {
        registry.register(name, value as Predicate);
        loaded.push(name);
      }
    }
  }
  return loaded;
}
