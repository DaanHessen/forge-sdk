/**
 * AST node interface and all concrete node types for the Typst builder.
 *
 * Each node knows how to render itself to valid Typst source via `toTypst()`.
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

/** Every AST node must implement this interface. */
export interface AstNode {
  readonly kind: string;
  toTypst(): string;
}

// ---------------------------------------------------------------------------
// Inline content (used inside paragraphs, headings, etc.)
// ---------------------------------------------------------------------------

/** Represents any piece of content that can appear inline. */
export type InlineContent = string | InlineNode;

/** An AST node that renders as inline content. */
export interface InlineNode extends AstNode {
  readonly isInline: true;
}

/** Renders plain text with Typst special characters escaped. */
export class TextNode implements InlineNode {
  readonly kind = 'text';
  readonly isInline = true as const;

  constructor(private text: string) {}

  toTypst(): string {
    // Escape Typst special characters: # [ ] \ @ *
    return this.text
      .replace(/\\/g, '\\\\')
      .replace(/#/g, '\\#')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/@/g, '\\@');
  }
}

/** Renders **bold** text: `#strong[...]` */
export class BoldNode implements InlineNode {
  readonly kind = 'bold';
  readonly isInline = true as const;

  constructor(private content: InlineContent[]) {}

  toTypst(): string {
    return `#strong[${renderInlineContents(this.content)}]`;
  }
}

/** Renders _italic_ text: `#emph[...]` */
export class ItalicNode implements InlineNode {
  readonly kind = 'italic';
  readonly isInline = true as const;

  constructor(private content: InlineContent[]) {}

  toTypst(): string {
    return `#emph[${renderInlineContents(this.content)}]`;
  }
}

/** Renders `inline code`: `#raw("...")` */
export class InlineCodeNode implements InlineNode {
  readonly kind = 'inline-code';
  readonly isInline = true as const;

  constructor(private code: string) {}

  toTypst(): string {
    const escaped = this.code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `#raw("${escaped}")`;
  }
}

/** Renders a hyperlink: `#link("url")[text]` */
export class LinkNode implements InlineNode {
  readonly kind = 'link';
  readonly isInline = true as const;

  constructor(private url: string, private label?: string) {}

  toTypst(): string {
    if (this.label) {
      return `#link("${this.url}")[${new TextNode(this.label).toTypst()}]`;
    }
    return `#link("${this.url}")`;
  }
}

// ---------------------------------------------------------------------------
// Block-level nodes
// ---------------------------------------------------------------------------

/** A section heading: `= Title`, `== Title`, etc. */
export class HeadingNode implements AstNode {
  readonly kind = 'heading';

  constructor(
    private content: InlineContent[],
    private level: 1 | 2 | 3 | 4 | 5 | 6 = 1
  ) {}

  toTypst(): string {
    const marks = '='.repeat(this.level);
    return `${marks} ${renderInlineContents(this.content)}\n`;
  }
}

/** A paragraph of text. */
export class ParagraphNode implements AstNode {
  readonly kind = 'paragraph';

  constructor(private content: InlineContent[]) {}

  toTypst(): string {
    return `${renderInlineContents(this.content)}\n\n`;
  }
}

/** A display or inline math expression. */
export class MathNode implements AstNode {
  readonly kind = 'math';

  constructor(private expression: string, private display = true) {}

  toTypst(): string {
    if (this.display) {
      return `$ ${this.expression} $\n\n`;
    }
    return `$${this.expression}$`;
  }
}

/** A fenced code block. */
export class CodeBlockNode implements AstNode {
  readonly kind = 'code-block';

  constructor(private code: string, private language = '') {}

  toTypst(): string {
    const langAttr = this.language ? `, lang: "${this.language}"` : '';
    const escaped = this.code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `#raw(block: true${langAttr}, "${escaped}")\n\n`;
  }
}

/** An ordered (`+`) or unordered (`-`) list. */
export class ListNode implements AstNode {
  readonly kind = 'list';

  constructor(
    private items: InlineContent[][],
    private ordered = false
  ) {}

  toTypst(): string {
    const marker = this.ordered ? '+' : '-';
    const lines = this.items.map(item => `${marker} ${renderInlineContents(item)}`);
    return lines.join('\n') + '\n\n';
  }
}

/** A table with column headers and rows. */
export class TableNode implements AstNode {
  readonly kind = 'table';

  constructor(
    private headers: string[],
    private rows: string[][]
  ) {}

  toTypst(): string {
    const numCols = this.headers.length;
    const headerCells = this.headers.map(h => `  [*${new TextNode(h).toTypst()}*]`).join(',\n');
    const rowCells = this.rows.map(row =>
      row.map(cell => `  [${new TextNode(cell).toTypst()}]`).join(',\n')
    ).join(',\n');
    const allCells = [headerCells, rowCells].filter(Boolean).join(',\n');
    return `#table(\n  columns: ${numCols},\n${allCells}\n)\n\n`;
  }
}

/** An image embed. */
export class ImageNode implements AstNode {
  readonly kind = 'image';

  constructor(
    private path: string,
    private options: { width?: string; caption?: string } = {}
  ) {}

  toTypst(): string {
    const widthAttr = this.options.width ? `, width: ${this.options.width}` : '';
    const imgCall = `#image("${this.path}"${widthAttr})`;
    if (this.options.caption) {
      const escaped = new TextNode(this.options.caption).toTypst();
      return `#figure(\n  ${imgCall},\n  caption: [${escaped}]\n)\n\n`;
    }
    return imgCall + '\n\n';
  }
}

/** A styled block container: `#block(fill: ..., inset: ..., [...])` */
export class BlockNode implements AstNode {
  readonly kind = 'block';

  constructor(
    private children: AstNode[],
    private options: { fill?: string; inset?: string; radius?: string } = {}
  ) {}

  toTypst(): string {
    const attrs: string[] = [];
    if (this.options.fill) attrs.push(`fill: ${this.options.fill}`);
    if (this.options.inset) attrs.push(`inset: ${this.options.inset}`);
    if (this.options.radius) attrs.push(`radius: ${this.options.radius}`);
    const inner = this.children.map(c => c.toTypst()).join('');
    const attrStr = attrs.length ? attrs.join(', ') + ', ' : '';
    return `#block(${attrStr}[\n${inner}])\n\n`;
  }
}

/** A page break: `#pagebreak()` */
export class PageBreakNode implements AstNode {
  readonly kind = 'page-break';

  toTypst(): string {
    return '#pagebreak()\n\n';
  }
}

/** A horizontal rule: `#line(length: 100%)` */
export class HorizontalRuleNode implements AstNode {
  readonly kind = 'horizontal-rule';

  toTypst(): string {
    return '#line(length: 100%)\n\n';
  }
}

/** An `#import` statement. */
export class ImportNode implements AstNode {
  readonly kind = 'import';

  constructor(
    private path: string,
    private items: string[] | '*' = '*'
  ) {}

  toTypst(): string {
    const items = this.items === '*' ? '*' : this.items.join(', ');
    return `#import "${this.path}": ${items}\n`;
  }
}

/** A `#show` rule. */
export class ShowRuleNode implements AstNode {
  readonly kind = 'show-rule';

  constructor(private expression: string) {}

  toTypst(): string {
    return `#show: ${this.expression}\n`;
  }
}

/** A `#set` rule. */
export class SetRuleNode implements AstNode {
  readonly kind = 'set-rule';

  constructor(private expression: string) {}

  toTypst(): string {
    return `#set ${this.expression}\n`;
  }
}

/** Alignment wrapper: `#align(center)[...]` */
export class AlignNode implements AstNode {
  readonly kind = 'align';

  constructor(
    private alignment: 'left' | 'center' | 'right',
    private children: AstNode[]
  ) {}

  toTypst(): string {
    const inner = this.children.map(c => c.toTypst()).join('');
    return `#align(${this.alignment})[\n${inner}]\n\n`;
  }
}

/** Raw Typst source code — escape hatch for anything not covered above. */
export class RawTypstNode implements AstNode {
  readonly kind = 'raw-typst';

  constructor(private source: string) {}

  toTypst(): string {
    return this.source.endsWith('\n') ? this.source : this.source + '\n';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders a mixed array of strings and InlineNodes to a Typst string. */
export function renderInlineContents(contents: InlineContent[]): string {
  return contents.map(c => {
    if (typeof c === 'string') return new TextNode(c).toTypst();
    return c.toTypst();
  }).join('');
}


