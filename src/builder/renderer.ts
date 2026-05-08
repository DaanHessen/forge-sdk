import { AstNode } from './nodes';

/**
 * Renders an array of AST nodes to a complete Typst source document.
 *
 * Nodes are rendered in order. `#set` and `#import` rules are automatically
 * hoisted to the top of the document since Typst evaluates them at parse time.
 */
export function renderAst(nodes: AstNode[]): string {
  // Hoist preamble nodes: imports, show rules, set rules
  const preambleKinds = new Set(['import', 'show-rule', 'set-rule']);
  const preamble = nodes.filter(n => preambleKinds.has(n.kind));
  const body = nodes.filter(n => !preambleKinds.has(n.kind));

  const parts: string[] = [];

  if (preamble.length > 0) {
    parts.push(preamble.map(n => n.toTypst()).join(''));
    parts.push('\n');
  }

  if (body.length > 0) {
    parts.push(body.map(n => n.toTypst()).join(''));
  }

  return parts.join('');
}
