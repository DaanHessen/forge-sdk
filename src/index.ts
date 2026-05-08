/**
 * ForgeAPI â€” Official Node.js SDK for the ForgeAPI PDF rendering API.
 *
 * @example
 * ```ts
 * import { ForgeAPIClient, TypstBuilder, bold, italic } from 'forge-sdk';
 *
 * const client = new ForgeAPIClient({ apiKey: 'sk_...' });
 *
 * // 1. Render a stored template with data
 * const result = await client.render({
 *   templateId: 'invoice',
 *   data: { customer: 'Acme Corp', total: 1500 },
 * });
 * await result.save('invoice.pdf');
 *
 * // 2. Render a local Typst project (auto-bundles all files)
 * const result = await client.renderLocal('./my-poster/example.typ');
 * await result.save('poster.pdf');
 *
 * // 3. Build a document programmatically
 * const doc = new TypstBuilder()
 *   .setPage('margin: 2cm')
 *   .setFont('font: "New Computer Modern", size: 12pt')
 *   .heading('Quarterly Report')
 *   .paragraph(['Revenue grew by ', bold('42%'), ' this quarter.'])
 *   .table(
 *     ['Product', 'Revenue', 'Units'],
 *     [['Widget A', '$10,000', '200'], ['Widget B', '$8,500', '170']]
 *   )
 *   .build();
 *
 * const result = await client.render({ content: doc.toTypst() });
 * await result.save('report.pdf');
 * ```
 */

// Client
export { ForgeAPIClient, ForgeAPIApiError } from './client';

// Builder â€” fluent API
export { TypstBuilder, TypstDocument } from './builder/index';

// Builder â€” inline helpers
export { bold, italic, code, link } from './builder/index';

// Builder â€” AST nodes (for advanced usage)
export {
  // Inline
  TextNode,
  BoldNode,
  ItalicNode,
  InlineCodeNode,
  LinkNode,
  // Block
  HeadingNode,
  ParagraphNode,
  MathNode,
  CodeBlockNode,
  ListNode,
  TableNode,
  ImageNode,
  BlockNode,
  PageBreakNode,
  HorizontalRuleNode,
  // Preamble
  ImportNode,
  ShowRuleNode,
  SetRuleNode,
  // Layout
  AlignNode,
  // Escape hatch
  RawTypstNode,
  // Helpers
  renderInlineContents,
} from './builder/nodes';

// Renderer
export { renderAst } from './builder/renderer';
export { compileForge, ForgeCompileError } from './forge';

// Utils
export { bundleProject } from './utils/bundle';

// Types
export type {
  ClientOptions,
  RenderOptions,
  RenderForgeOptions,
  RenderLocalOptions,
  RenderResult,
  ForgeAPIError,
} from './types';

export type {
  AstNode,
  InlineContent,
  InlineNode,
} from './builder/nodes';
