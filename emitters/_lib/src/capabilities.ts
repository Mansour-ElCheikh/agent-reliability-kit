/**
 * Capability resolution: matches a canonical spec's `requires.*` against a tool's capabilities.
 * Ported from scaffold_emit.py with the UNIVERSAL_CAPABILITIES default (F11) preserved.
 */

import type { CanonicalSpec, ToolCapabilityEntry } from './canonical.js';

/**
 * Capabilities universal across coding agents — every tool can read, write, and
 * invoke shell unless declared otherwise. Tool-capabilities.yaml only enumerates
 * differentiating capabilities; missing universal ones default to supports=true.
 * See F11 in docs/findings/wave4-self-bootstrap.md.
 */
export const UNIVERSAL_CAPABILITIES = new Set(['filesystem_writes', 'read_only_tools', 'bash_invocation']);

export interface CapabilityResolution {
  canEmit: boolean;
  degradations: Array<[capability: string, degradesTo: string]>;
  skipReason: string | null;
}

export function resolveCapabilities(spec: CanonicalSpec, toolCaps: ToolCapabilityEntry): CapabilityResolution {
  const degradations: Array<[string, string]> = [];
  const requiresBlock = spec.frontmatter.requires ?? {};

  for (const [capability, requirement] of Object.entries(requiresBlock)) {
    const level = requirement?.level ?? 'not_needed';
    const degradesTo = requirement?.degrades_to;

    if (level === 'not_needed') continue;

    const toolCap = (toolCaps as Record<string, unknown>)[capability];
    let supports: boolean | 'partial';
    if (toolCap && typeof toolCap === 'object' && 'supports' in toolCap) {
      supports = (toolCap as { supports: boolean | 'partial' }).supports;
    } else if (UNIVERSAL_CAPABILITIES.has(capability)) {
      supports = true;
    } else {
      // Unknown capability + not universal + tool doesn't declare it: fail loud.
      supports = false;
    }

    if (supports === true) continue;

    if (supports === 'partial') {
      // Per emitter-contract §4: partial = treat as supported unless emitter
      // explicitly checks the underlying features. v0.1 emitters accept partial.
      continue;
    }

    // supports === false
    if (degradesTo) {
      degradations.push([capability, degradesTo]);
    } else if (level === 'required') {
      return {
        canEmit: false,
        degradations: [],
        skipReason: `${capability} required, not supported, no degrades_to declared`,
      };
    } else if (level === 'preferred') {
      degradations.push([capability, 'omit']);
    }
  }

  return { canEmit: true, degradations, skipReason: null };
}
