/**
 * Nunjucks environment factory with defensive delimiters per design D3.
 * Default Jinja2/Nunjucks delimiters (`{{` `}}`) collide with markdown / code in
 * canonical bodies, so we use uncommon ones: `<<` `>>` (variables), `<%` `%>` (blocks).
 */

import nunjucks from 'nunjucks';
import path from 'node:path';

export function makeNunjucksEnv(templateDir: string): nunjucks.Environment {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.resolve(templateDir)), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
    tags: {
      variableStart: '<<',
      variableEnd: '>>',
      blockStart: '<%',
      blockEnd: '%>',
      commentStart: '<#',
      commentEnd: '#>',
    },
  });
  return env;
}
