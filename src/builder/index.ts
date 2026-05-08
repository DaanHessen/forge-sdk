import {
  AstNode,
  InlineContent,
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
  ImportNode,
  ShowRuleNode,
  SetRuleNode,
  AlignNode,
  RawTypstNode,
  BoldNode,
  ItalicNode,
  InlineCodeNode,
  LinkNode,
} from './nodes';
import { renderAst } from './renderer';

/**
 * A compiled Typst document. Call `.toTypst()` to get the source string.
 */
export class TypstDocument {
  constructor(private nodes: AstNode[]) {}

  /** Returns the full Typst source code for this document. */
  toTypst(): string {
    return renderAst(this.nodes);
  }

  /** Returns all nodes in this document (useful for inspection/testing). */
  getNodes(): AstNode[] {
    return [...this.nodes];
  }
}

/**
 * A fluent builder for constructing Typst documents programmatically.
 *
 * @example
 * ```ts
 * const doc = new TypstBuilder()
 *   .setPage('margin: 2cm')
 *   .setFont('size: 12pt')
 *   .heading('My Report')
 *   .paragraph('This report was generated automatically.')
 *   .table(['Name', 'Score'], [['Alice', '95'], ['Bob', '82']])
 *   .build();
 *
 * const typst = doc.toTypst();
 * const pdf = await client.render({ content: typst, data: {} });
 * ```
 */
export class TypstBuilder {
  private nodes: AstNode[] = [];

  // ---------------------------------------------------------------------------
  // Preamble: imports, show rules, set rules
  // ---------------------------------------------------------------------------

  /** Add `#import "path": items` */
  import(path: string, items: string[] | '*' = '*'): this {
    this.nodes.push(new ImportNode(path, items));
    return this;
  }

  /** Add a `#show: expression` rule (e.g., for applying a template function). */
  show(expression: string): this {
    this.nodes.push(new ShowRuleNode(expression));
    return this;
  }

  /** Add a generic `#set expression` rule. */
  set(expression: string): this {
    this.nodes.push(new SetRuleNode(expression));
    return this;
  }

  /** Shorthand: `#set page(...)` */
  setPage(args: string): this {
    return this.set(`page(${args})`);
  }

  /** Shorthand: `#set text(...)` */
  setFont(args: string): this {
    return this.set(`text(${args})`);
  }

  /** Shorthand: `#set heading(...)` */
  setHeading(args: string): this {
    return this.set(`heading(${args})`);
  }

  // ---------------------------------------------------------------------------
  // Block-level content
  // ---------------------------------------------------------------------------

  /**
   * Add a heading.
   * @param content - Text or inline nodes.
   * @param level   - Heading level 1–6 (default: 1).
   */
  heading(content: InlineContent | InlineContent[], level: 1 | 2 | 3 | 4 | 5 | 6 = 1): this {
    const items = Array.isArray(content) ? content : [content];
    this.nodes.push(new HeadingNode(items, level));
    return this;
  }

  /**
   * Add a paragraph.
   * @param content - Text or a mix of text and inline nodes.
   */
  paragraph(content: InlineContent | InlineContent[]): this {
    const items = Array.isArray(content) ? content : [content];
    this.nodes.push(new ParagraphNode(items));
    return this;
  }

  /** Add a display math equation. */
  math(expression: string, display = true): this {
    this.nodes.push(new MathNode(expression, display));
    return this;
  }

  /** Add a fenced code block. */
  codeBlock(code: string, language = ''): this {
    this.nodes.push(new CodeBlockNode(code, language));
    return this;
  }

  /**
   * Add an unordered list.
   * @param items - Each item is a string or array of inline content.
   */
  list(items: (string | InlineContent[])[]): this {
    const normalized = items.map(item => (Array.isArray(item) ? item : [item]));
    this.nodes.push(new ListNode(normalized, false));
    return this;
  }

  /**
   * Add an ordered (numbered) list.
   * @param items - Each item is a string or array of inline content.
   */
  orderedList(items: (string | InlineContent[])[]): this {
    const normalized = items.map(item => (Array.isArray(item) ? item : [item]));
    this.nodes.push(new ListNode(normalized, true));
    return this;
  }

  /**
   * Add a table.
   * @param headers - Column header strings.
   * @param rows    - 2D array of cell strings.
   */
  table(headers: string[], rows: string[][]): this {
    this.nodes.push(new TableNode(headers, rows));
    return this;
  }

  /**
   * Add an image.
   * @param path    - Path to the image (relative to project root or assets dir).
   * @param options - Optional width (e.g., "50%") and caption.
   */
  image(path: string, options: { width?: string; caption?: string } = {}): this {
    this.nodes.push(new ImageNode(path, options));
    return this;
  }

  /**
   * Add a styled block container.
   * @param builderFn - Callback to fill the block using a nested builder.
   * @param options   - Optional fill, inset, radius (Typst color/length strings).
   */
  block(
    builderFn: (b: TypstBuilder) => TypstBuilder,
    options: { fill?: string; inset?: string; radius?: string } = {}
  ): this {
    const inner = new TypstBuilder();
    builderFn(inner);
    const doc = inner.build();
    this.nodes.push(new BlockNode(doc.getNodes(), options));
    return this;
  }

  /**
   * Add an alignment wrapper.
   * @param alignment - 'left' | 'center' | 'right'
   * @param builderFn - Callback to fill the aligned section.
   */
  align(
    alignment: 'left' | 'center' | 'right',
    builderFn: (b: TypstBuilder) => TypstBuilder
  ): this {
    const inner = new TypstBuilder();
    builderFn(inner);
    const doc = inner.build();
    this.nodes.push(new AlignNode(alignment, doc.getNodes()));
    return this;
  }

  /** Add a page break. */
  pageBreak(): this {
    this.nodes.push(new PageBreakNode());
    return this;
  }

  /** Add a horizontal rule line. */
  horizontalRule(): this {
    this.nodes.push(new HorizontalRuleNode());
    return this;
  }

  /**
   * Inject raw Typst source. Use this as an escape hatch for features not
   * yet covered by the builder API.
   */
  raw(typstSource: string): this {
    this.nodes.push(new RawTypstNode(typstSource));
    return this;
  }

  /** Compile all nodes into a TypstDocument. */
  build(): TypstDocument {
    return new TypstDocument([...this.nodes]);
  }
}

// ---------------------------------------------------------------------------
// Inline helper factories (for composing rich inline content)
// ---------------------------------------------------------------------------

/** Creates a bold inline node. */
export function bold(content: string | InlineContent[]): BoldNode {
  const items = Array.isArray(content) ? content : [content];
  return new BoldNode(items);
}

/** Creates an italic inline node. */
export function italic(content: string | InlineContent[]): ItalicNode {
  const items = Array.isArray(content) ? content : [content];
  return new ItalicNode(items);
}

/** Creates an inline code node. */
export function code(content: string): InlineCodeNode {
  return new InlineCodeNode(content);
}

/** Creates a hyperlink inline node. */
export function link(url: string, label?: string): LinkNode {
  return new LinkNode(url, label);
}


