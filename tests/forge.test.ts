import { compileForge } from '../src/forge';

describe('compileForge', () => {
  it('compiles basic Forge document to Typst', () => {
    const source = `
      doc {
        page(margin: "18mm");
        text(font: "Outfit", size: "11pt");
        heading(1, "Invoice");
        paragraph("Hello ", strong("Acme"), ".");
        bullet_list { item("Fast setup"); item("Safe output"); }
      }
    `;
    const result = compileForge(source);
    expect(result).toContain('#set page(margin: 18mm)');
    expect(result).toContain('#set text(font: "Outfit", size: 11pt)');
    expect(result).toContain('= Invoice');
    expect(result).toContain('Hello #strong[Acme].');
    expect(result).toContain('- Fast setup');
  });

  it('escapes text correctly', () => {
    const source = `
      doc {
        paragraph("Hello #1 [World]");
      }
    `;
    const result = compileForge(source);
    expect(result).toContain('Hello \\#1 \\[World\\]');
  });

  it('handles strings with quotes', () => {
    const source = `
      doc {
        paragraph("He said \\"Hello\\"");
      }
    `;
    const result = compileForge(source);
    // Typst markup handles literal quotes fine
    expect(result).toContain('He said "Hello"');
  });


  it('rejects unknown statements', () => {
    expect(() => compileForge('doc { hack(); }')).toThrow('unknown statement');
  });

  it('rejects remote image paths', () => {
    expect(() => compileForge('doc { image(path: "https://evil.com/x.png"); }')).toThrow('local asset path');
  });
});
