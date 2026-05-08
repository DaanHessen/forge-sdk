import {
  TypstBuilder,
  bold,
  italic,
  code,
  link,
  compileForge,
  ForgeCompileError,
  HeadingNode,
  ParagraphNode,
  TableNode,
  ListNode,
  MathNode,
  CodeBlockNode,
  ImageNode,
  BlockNode,
  ImportNode,
  ShowRuleNode,
  SetRuleNode,
  RawTypstNode,
  renderAst,
} from '../src/index';

// ---------------------------------------------------------------------------
// Individual node tests
// ---------------------------------------------------------------------------

describe('HeadingNode', () => {
  it('renders level 1 heading', () => {
    const node = new HeadingNode(['Hello World'], 1);
    expect(node.toTypst()).toBe('= Hello World\n');
  });

  it('renders level 3 heading', () => {
    const node = new HeadingNode(['Sub-section'], 3);
    expect(node.toTypst()).toBe('=== Sub-section\n');
  });

  it('escapes special chars in heading', () => {
    const node = new HeadingNode(['Hello #world'], 1);
    expect(node.toTypst()).toBe('= Hello \\#world\n');
  });
});

describe('ParagraphNode', () => {
  it('renders plain paragraph', () => {
    const node = new ParagraphNode(['Hello paragraph.']);
    expect(node.toTypst()).toBe('Hello paragraph.\n\n');
  });

  it('renders paragraph with inline nodes', () => {
    const node = new ParagraphNode(['Revenue grew by ', bold('42%'), '.']);
    expect(node.toTypst()).toBe('Revenue grew by #strong[42%].\n\n');
  });
});

describe('Inline nodes', () => {
  it('bold()', () => expect(bold('hello').toTypst()).toBe('#strong[hello]'));
  it('italic()', () => expect(italic('world').toTypst()).toBe('#emph[world]'));
  it('code()', () => expect(code('npm install').toTypst()).toBe('#raw("npm install")'));
  it('link() without label', () => expect(link('https://ForgeAPI.com').toTypst()).toBe('#link("https://ForgeAPI.com")'));
  it('link() with label', () => expect(link('https://ForgeAPI.com', 'ForgeAPI').toTypst()).toBe('#link("https://ForgeAPI.com")[ForgeAPI]'));
});

describe('MathNode', () => {
  it('renders display math', () => {
    const node = new MathNode('E = m c^2');
    expect(node.toTypst()).toBe('$ E = m c^2 $\n\n');
  });

  it('renders inline math', () => {
    const node = new MathNode('alpha + beta', false);
    expect(node.toTypst()).toBe('$alpha + beta$');
  });
});

describe('CodeBlockNode', () => {
  it('renders code block without language', () => {
    const node = new CodeBlockNode('let x = 1;');
    expect(node.toTypst()).toBe('#raw(block: true, "let x = 1;")\n\n');
  });

  it('renders code block with language', () => {
    const node = new CodeBlockNode('fn main() {}', 'rust');
    expect(node.toTypst()).toBe('#raw(block: true, lang: "rust", "fn main() {}")\n\n');
  });
});

describe('ListNode', () => {
  it('renders unordered list', () => {
    const node = new ListNode([['Item A'], ['Item B']], false);
    expect(node.toTypst()).toBe('- Item A\n- Item B\n\n');
  });

  it('renders ordered list', () => {
    const node = new ListNode([['First'], ['Second']], true);
    expect(node.toTypst()).toBe('+ First\n+ Second\n\n');
  });
});

describe('TableNode', () => {
  it('renders table with headers and rows', () => {
    const node = new TableNode(['Name', 'Score'], [['Alice', '95'], ['Bob', '82']]);
    const result = node.toTypst();
    expect(result).toContain('columns: 2');
    expect(result).toContain('[*Name*]');
    expect(result).toContain('[Alice]');
  });
});

describe('ImageNode', () => {
  it('renders image without options', () => {
    const node = new ImageNode('logo.png');
    expect(node.toTypst()).toBe('#image("logo.png")\n\n');
  });

  it('renders image with width', () => {
    const node = new ImageNode('logo.png', { width: '50%' });
    expect(node.toTypst()).toBe('#image("logo.png", width: 50%)\n\n');
  });

  it('renders image with caption as figure', () => {
    const node = new ImageNode('logo.png', { caption: 'Our logo' });
    const result = node.toTypst();
    expect(result).toContain('#figure(');
    expect(result).toContain('caption:');
  });
});

describe('ImportNode', () => {
  it('renders wildcard import', () => {
    const node = new ImportNode('../poster.typ');
    expect(node.toTypst()).toBe('#import "../poster.typ": *\n');
  });

  it('renders named import', () => {
    const node = new ImportNode('../theme.typ', ['primary', 'secondary']);
    expect(node.toTypst()).toBe('#import "../theme.typ": primary, secondary\n');
  });
});

describe('SetRuleNode / ShowRuleNode', () => {
  it('renders set rule', () => {
    const node = new SetRuleNode('text(font: "Outfit", size: 12pt)');
    expect(node.toTypst()).toBe('#set text(font: "Outfit", size: 12pt)\n');
  });

  it('renders show rule', () => {
    const node = new ShowRuleNode('poster.with(title: "My Poster")');
    expect(node.toTypst()).toBe('#show: poster.with(title: "My Poster")\n');
  });
});

describe('RawTypstNode', () => {
  it('passes source through as-is', () => {
    const node = new RawTypstNode('#my-custom-function(arg: true)');
    expect(node.toTypst()).toBe('#my-custom-function(arg: true)\n');
  });
});

// ---------------------------------------------------------------------------
// Renderer: preamble hoisting
// ---------------------------------------------------------------------------

describe('renderAst (preamble hoisting)', () => {
  it('hoists imports and set rules to the top', () => {
    const result = renderAst([
      new ParagraphNode(['Hello']),
      new SetRuleNode('text(size: 12pt)'),
      new ImportNode('../theme.typ'),
      new ParagraphNode(['World']),
    ]);

    const lines = result.split('\n');
    const importLine = lines.findIndex(l => l.startsWith('#import'));
    const setLine = lines.findIndex(l => l.startsWith('#set'));
    const helloLine = lines.findIndex(l => l.includes('Hello'));

    expect(importLine).toBeLessThan(helloLine);
    expect(setLine).toBeLessThan(helloLine);
  });
});

// ---------------------------------------------------------------------------
// TypstBuilder integration
// ---------------------------------------------------------------------------

describe('TypstBuilder', () => {
  it('produces valid Typst for a simple document', () => {
    const doc = new TypstBuilder()
      .setPage('margin: 2cm')
      .setFont('size: 12pt')
      .heading('My Report')
      .paragraph(['Revenue: ', bold('$10,000'), '.'])
      .table(['Item', 'Amount'], [['Widget', '$10,000']])
      .build();

    const source = doc.toTypst();
    expect(source).toContain('#set page(margin: 2cm)');
    expect(source).toContain('#set text(size: 12pt)');
    expect(source).toContain('= My Report');
    expect(source).toContain('#strong[$10,000]');
    expect(source).toContain('columns: 2');
  });

  it('supports nested block builder', () => {
    const doc = new TypstBuilder()
      .block(
        b => b.paragraph('I am inside a block.'),
        { fill: 'luma(230)', inset: '8pt', radius: '4pt' }
      )
      .build();

    const source = doc.toTypst();
    expect(source).toContain('#block(fill: luma(230), inset: 8pt, radius: 4pt,');
    expect(source).toContain('I am inside a block.');
  });

  it('supports import + show rule (template usage pattern)', () => {
    const doc = new TypstBuilder()
      .import('../poster.typ')
      .show('poster.with(title: "My Poster")')
      .heading('Section One')
      .build();

    const source = doc.toTypst();
    expect(source).toContain('#import "../poster.typ": *');
    expect(source).toContain('#show: poster.with(title: "My Poster")');
    // Import should come before section heading
    const importIdx = source.indexOf('#import');
    const headingIdx = source.indexOf('= Section One');
    expect(importIdx).toBeLessThan(headingIdx);
  });
});

describe('compileForge', () => {
  it('compiles a basic Forge document to Typst', () => {
    const source = `
doc {
  page(margin: "18mm");
  text(font: "Outfit", size: "11pt");
  heading(1, "Invoice");
  paragraph("Hello ", strong("World"), ".");
}
`;
    const typst = compileForge(source);
    expect(typst).toContain('#set page(margin: 18mm)');
    expect(typst).toContain('= Invoice');
    expect(typst).toContain('#strong[World]');
  });

  it('rejects unsupported statements', () => {
    expect(() => compileForge('doc { shell("rm -rf /"); }')).toThrow(ForgeCompileError);
  });
});
