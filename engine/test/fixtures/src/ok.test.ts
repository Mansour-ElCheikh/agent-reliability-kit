// Co-located test for ok.ts. Lives in src/**/*.test.ts → R3 sees it as
// in a declared layer scope (testing-manifest test:unit). R3 does NOT fire.
import { ok } from './ok.js';
if (ok() !== 42) throw new Error('fixture broken');
