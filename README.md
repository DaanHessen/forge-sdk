# Typeforge API SDK (TypeScript)

The official Node.js/TypeScript SDK for [Typeforge API](https://github.com/DaanHessen/Typeforge-api).
GitHub: [DaanHessen/typeforge-sdk](https://github.com/DaanHessen/typeforge-sdk)

## Features

- 📄 **Render stored templates** with dynamic JSON data
- 📦 **Bundle and render local Typst projects** — zero manual file management
- 🏗️ **Build documents in code** with a fully typed AST builder
- ⚒️ **Compile Typeforge locally** into Typst before rendering
- 🔒 Zero runtime dependencies (uses Node.js built-ins)
- 🌐 Works in Node.js 18+

---

## Installation

```bash
npm install typeforge-sdk
```

---

## Quick Start

```typescript
import { TypeforgeClient } from 'typeforge-sdk';

const client = new TypeforgeClient({ apiKey: 'sk_YOUR_API_KEY' });
```

---

## Usage

### 1. Render a Stored Template

Use a template you've uploaded to your Typeforge account and inject data:

```typescript
const result = await client.render({
  templateId: 'invoice',
  data: {
    customer: 'Acme Corp',
    total: 1500.00,
    items: [{ name: 'Widget', qty: 10, price: 150 }],
  },
});

await result.save('invoice.pdf');
console.log(`Generated ${result.size} byte PDF`);
```

---

### 2. Render a Local Typst Project

Point to any `.typ` file on disk. The SDK automatically bundles all auxiliary files (imports, images, fonts) and sends them to the API:

```typescript
const result = await client.renderLocal('./my-poster/example.typ', {
  data: { title: 'My Research Poster' },
});

await result.save('poster.pdf');
```

Works out of the box with multi-file Typst projects like [typst-poster](https://github.com/pncnmnp/typst-poster):

```
my-poster/
  example.typ    â† entry point
  poster.typ     â† #import "../poster.typ"
  images/
    logo.png
    figure1.png
```

```typescript
await client.renderLocal('./my-poster/example.typ');
```

---

### 3. Build Documents Programmatically

Use `TypstBuilder` to construct a full Typst document in TypeScript without writing any `.typ` files:

```typescript
import { TypstBuilder, bold, italic, link } from 'typeforge-sdk';

const doc = new TypstBuilder()
  // Document setup
  .setPage('margin: 2cm')
  .setFont('font: "New Computer Modern", size: 12pt')
  .setHeading('numbering: "1."')

  // Content
  .heading('Quarterly Report â€” Q2 2025')
  .paragraph([
    'Revenue grew by ',
    bold('42%'),
    ' this quarter, driven primarily by ',
    italic('enterprise subscriptions'),
    '.',
  ])
  .horizontalRule()

  .heading('Revenue Breakdown', 2)
  .table(
    ['Product',    'Revenue',   'Units'],
    [
      ['Widget A', '$10,000',   '200'],
      ['Widget B', '$8,500',    '170'],
      ['Widget C', '$3,200',    '64'],
    ]
  )

  .heading('Key Highlights', 2)
  .list([
    'Launched three new enterprise customers.',
    ['Net Promoter Score increased to ', bold('72'), '.'],
    'Infrastructure costs reduced by 18%.',
  ])

  .math('\\text{Growth} = \\frac{Q2 - Q1}{Q1} \\times 100\\%')

  .heading('Code Example', 2)
  .codeBlock('const pdf = await client.render({ templateId: "invoice" });', 'typescript')

  .build();

const result = await client.render({ content: doc.toTypst() });
await result.save('report.pdf');
```

---

### 4. Compile Typeforge Locally

Use the constrained Rust-flavored Typeforge DSL when you want a smaller, safer authoring surface. Compilation happens inside the SDK, then the API receives plain Typst:

```typescript
const Typeforge = `
doc {
  page(margin: "18mm");
  text(font: "Outfit", size: "11pt");
  heading(1, "Invoice");
  paragraph("Hello ", strong("{{customer}}"), ".");
  bullet_list {
    item("Fast setup");
    item("Safe output");
  }
}
`;

const result = await client.renderTypeforge(Typeforge, {
  data: { customer: 'Acme Corp' },
});

await result.save('invoice.pdf');
```

---

### 5. Mix Templates and Builder

Load an existing template and extend it with dynamically generated content:

```typescript
const appendix = new TypstBuilder()
  .heading('Appendix A — Raw Data', 1)
  .table(headers, rows)
  .build();

const result = await client.render({
  templateId: 'report-template',
  content: appendix.toTypst(),        // appended after the template
  data: { date: '2025-06-01' },
});
```

---

## API Reference

### `TypeforgeClient`

| Method | Description |
|---|---|
| `render(options)` | Render a PDF from a template ID or raw content |
| `renderTypeforge(source, options?)` | Compile Typeforge locally, then render the resulting Typst |
| `renderLocal(path, options?)` | Bundle and render a local Typst project |

### `TypstBuilder` — Block Methods

| Method | Typst output |
|---|---|
| `.heading(text, level?)` | `= Heading` |
| `.paragraph(content)` | `Text content\n\n` |
| `.math(expression, display?)` | `$ expr $` |
| `.codeBlock(code, lang?)` | `#raw(block: true, ...)` |
| `.list(items)` | `- item` |
| `.orderedList(items)` | `+ item` |
| `.table(headers, rows)` | `#table(...)` |
| `.image(path, options?)` | `#image(...)` / `#figure(...)` |
| `.block(builderFn, options?)` | `#block(fill: ..., [...])` |
| `.align(alignment, builderFn)` | `#align(center)[...]` |
| `.pageBreak()` | `#pagebreak()` |
| `.horizontalRule()` | `#line(length: 100%)` |
| `.raw(typst)` | Raw Typst passthrough |

### `TypstBuilder` — Preamble Methods

| Method | Typst output |
|---|---|
| `.import(path, items?)` | `#import "path": *` |
| `.show(expression)` | `#show: expression` |
| `.set(expression)` | `#set expression` |
| `.setPage(args)` | `#set page(args)` |
| `.setFont(args)` | `#set text(args)` |
| `.setHeading(args)` | `#set heading(args)` |

### Inline Helpers

```typescript
import { bold, italic, code, link } from 'typeforge-sdk';

builder.paragraph(['See ', link('https://typeforge.com', 'Typeforge'), ' for details.']);
builder.paragraph(['This is ', bold('important'), ' and ', italic('subtle'), '.']);
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `TYPEFORGE_TEST_API_KEY` | API key for integration tests |
| `TYPEFORGE_TEST_BASE_URL` | Override API URL for tests (default: `http://localhost:3000`) |

---

## License

MIT

