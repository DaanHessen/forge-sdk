type Kind =
  | { type: 'ident'; value: string }
  | { type: 'string'; value: string }
  | { type: 'int'; value: number }
  | { type: 'lparen' | 'rparen' | 'lbrace' | 'rbrace' | 'lbracket' | 'rbracket' | 'colon' | 'comma' | 'semi' | 'eof' };

type Token = Kind & { line: number; column: number };

type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; items: Inline[] }
  | { kind: 'em'; items: Inline[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; url: string; label: Inline[] }
  | { kind: 'text_span'; props: Prop[]; content: Inline[] };

type Value =
  | { kind: 'string'; value: string }
  | { kind: 'int'; value: number }
  | { kind: 'strings'; value: string[] }
  | { kind: 'matrix'; value: string[][] };

type Prop = { name: string; value: Value };

type Stmt =
  | { kind: 'page' | 'text'; props: Prop[] }
  | { kind: 'heading'; level: number; content: Inline[] }
  | { kind: 'paragraph'; content: Inline[] }
  | { kind: 'bullet_list' | 'number_list'; items: Inline[][] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'grid_table'; columns: number; body: Stmt[] }
  | { kind: 'code_block'; language?: string; body: string }
  | { kind: 'image'; path: string; width?: string; caption?: string }
  | { kind: 'rule'; props: Prop[] }
  | { kind: 'page_break' }
  | { kind: 'spacer'; value: string }
  | { kind: 'align'; direction: string; body: Stmt[] }
  | { kind: 'columns'; count: number; body: Stmt[] }
  | { kind: 'show_if'; path: string; body: Stmt[] }
  | { kind: 'container'; fill?: string; radius?: string; body: Stmt[] }
  | { kind: 'style'; name: string; body: Stmt[] }
  | { kind: 'define_style'; name: string; props: Prop[] }
  | { kind: 'block'; body: Stmt[] };

export class TypeforgeCompileError extends Error {
  constructor(message: string, public readonly line: number, public readonly column: number) {
    super(`Typeforge syntax error at line ${line}, column ${column}: ${message}`);
    this.name = 'TypeforgeCompileError';
  }
}

export function compileTypeforge(source: string): string {
  if (source.length > 500_000) {
    throw new Error('Forge source exceeds maximum size of 500KB');
  }
  const parser = new Parser(tokenize(source));
  return renderDocument(parser.parseDocument());
}

function tokenize(source: string): Token[] {
  const chars = [...source];
  const out: Token[] = [];
  let i = 0, line = 1, column = 1;
  const push = (token: Kind) => { out.push({ ...token, line, column }); i += 1; column += 1; };

  while (i < chars.length) {
    const ch = chars[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { i += 1; column += 1; continue; }
    if (ch === '\n') { i += 1; line += 1; column = 1; continue; }
    if (ch === '/' && chars[i + 1] === '/') { i += 2; column += 2; while (i < chars.length && chars[i] !== '\n') { i += 1; column += 1; } continue; }
    if (ch === '(') { push({ type: 'lparen' }); continue; }
    if (ch === ')') { push({ type: 'rparen' }); continue; }
    if (ch === '{') { push({ type: 'lbrace' }); continue; }
    if (ch === '}') { push({ type: 'rbrace' }); continue; }
    if (ch === '[') { push({ type: 'lbracket' }); continue; }
    if (ch === ']') { push({ type: 'rbracket' }); continue; }
    if (ch === ':') { push({ type: 'colon' }); continue; }
    if (ch === ',') { push({ type: 'comma' }); continue; }
    if (ch === ';') { push({ type: 'semi' }); continue; }
    if (ch === '"') {
      const startLine = line, startColumn = column;
      i += 1; column += 1;
      let value = '';
      while (i < chars.length) {
        const current = chars[i];
        if (current === '"') { i += 1; column += 1; out.push({ type: 'string', value, line: startLine, column: startColumn }); break; }
        if (current === '\\') {
          i += 1; column += 1;
          if (i >= chars.length) throw new TypeforgeCompileError('unterminated string literal', startLine, startColumn);
          const escaped = chars[i];
          value += ({ '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? '';
          if (!['"', '\\', 'n', 'r', 't'].includes(escaped)) throw new TypeforgeCompileError(`unsupported escape sequence \\${escaped}`, line, column);
          i += 1; column += 1;
          continue;
        }
        if (current === '\n') throw new TypeforgeCompileError('string literals must stay on one line', startLine, startColumn);
        value += current; i += 1; column += 1;
      }
      if (out[out.length - 1]?.type !== 'string') throw new TypeforgeCompileError('unterminated string literal', startLine, startColumn);
      continue;
    }
    if (/\d/.test(ch)) {
      const start = i, startColumn = column;
      while (i < chars.length && /\d/.test(chars[i])) { i += 1; column += 1; }
      out.push({ type: 'int', value: Number(chars.slice(start, i).join('')), line, column: startColumn });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i, startColumn = column;
      while (i < chars.length && /[A-Za-z0-9_]/.test(chars[i])) { i += 1; column += 1; }
      out.push({ type: 'ident', value: chars.slice(start, i).join(''), line, column: startColumn });
      continue;
    }
    throw new TypeforgeCompileError(`unexpected character '${ch}'`, line, column);
  }

  out.push({ type: 'eof', line, column });
  return out;
}

class Parser {
  constructor(private readonly tokens: Token[], private index = 0) {}

  parseDocument(): Stmt[] {
    if (this.peekIdent('doc')) {
      this.bump();
      this.expect('lbrace', "expected '{' after doc");
      const stmts = this.parseUntil('rbrace', 0);
      this.expect('rbrace', "expected '}' after doc block");
      this.expect('eof', 'expected end of file');
      return stmts;
    }
    const stmts = this.parseUntil('eof', 0);
    this.expect('eof', 'expected end of file');
    return stmts;
  }

  private parseUntil(end: Token['type'], depth: number): Stmt[] {
    if (depth > 32) throw this.fail('nesting limit exceeded');
    const stmts: Stmt[] = [];
    while (!this.same(end) && !this.same('eof')) stmts.push(this.parseStmt(depth + 1));
    return stmts;
  }

  private parseStmt(depth: number): Stmt {
    const name = this.expectIdent();
    if (name === 'doc') {
      this.expect('lbrace', "expected '{' after doc");
      const body = this.parseUntil('rbrace', depth);
      this.expect('rbrace', "expected '}' after doc block");
      return { kind: 'block', body };
    }
    if (name === 'page' || name === 'text') return { kind: name, props: this.parsePropsCall() };
    if (name === 'heading') return this.parseHeading();
    if (name === 'paragraph') return this.parseParagraph();
    if (name === 'bullet_list') return { kind: 'bullet_list', items: this.parseList(depth) };
    if (name === 'number_list') return { kind: 'number_list', items: this.parseList(depth) };
    if (name === 'table') return this.parseTableOrGrid(depth);
    if (name === 'code_block') return this.parseCodeBlock();
    if (name === 'image') return this.parseImage();
    if (name === 'rule') {
      const props = this.same('lparen') ? this.parsePropsCall() : (this.emptyCall(), []);
      return { kind: 'rule', props };
    }
    if (name === 'page_break') { this.emptyCall(); return { kind: 'page_break' }; }
    if (name === 'align') return this.parseAlign(depth);
    if (name === 'columns') return this.parseColumns(depth);
    if (name === 'show_if') return this.parseShowIf(depth);
    if (name === 'container') return this.parseContainer(depth);
    if (name === 'style') return this.parseStyle(depth);
    if (name === 'define_style') return this.parseDefineStyle();
    throw this.fail(`unknown statement '${name}'`);
  }

  private parseTableOrGrid(depth: number): Stmt {
    const props = this.parsePropsCallNoSemi();
    if (this.eat('semi')) {
      const headers = this.getProp<string[]>('table', props, 'headers', 'strings') ?? [];
      const rows = this.getProp<string[][]>('table', props, 'rows', 'matrix') ?? [];
      return { kind: 'table', headers, rows };
    } else {
      const columns = this.getProp<number>('table', props, 'columns', 'int') ?? 1;
      this.expect('lbrace', "expected '{' after table grid declaration");
      const body = this.parseUntil('rbrace', depth);
      this.expect('rbrace', "expected '}' after table block");
      return { kind: 'grid_table', columns, body };
    }
  }

  private parsePropsCall(): Prop[] {
    this.expect('lparen', "expected '('");
    const props = this.parseProps();
    this.expect('rparen', "expected ')'");
    this.expect('semi', "expected ';'");
    return props;
  }

  private parseProps(): Prop[] {
    const props: Prop[] = [];
    if (this.same('rparen')) return props;
    for (;;) {
      if (!this.peekProp()) break;
      const name = this.expectIdent();
      this.expect('colon', "expected ':' after property name");
      props.push({ name, value: this.parseValue() });
      if (this.eat('comma')) {
        if (this.same('rparen') || !this.peekProp()) break;
        continue;
      }
      break;
    }
    return props;
  }

  private peekProp(): boolean {
    const current = this.current();
    if (current.type === 'ident') {
      const next = this.tokens[this.index + 1];
      return next && next.type === 'colon';
    }
    return false;
  }

  private parseHeading(): Stmt {
    this.expect('lparen', "expected '(' after heading");
    let level = 1;
    if (this.current().type === 'int') { level = Math.min(6, Math.max(1, this.currentInt())); this.bump(); this.expect('comma', "expected ',' after heading level"); }
    const content = this.parseInlineArgs();
    this.expect('rparen', "expected ')' after heading");
    this.expect('semi', "expected ';' after heading");
    return { kind: 'heading', level, content };
  }

  private parseParagraph(): Stmt {
    this.expect('lparen', "expected '(' after paragraph");
    const content = this.parseInlineArgs();
    this.expect('rparen', "expected ')' after paragraph");
    this.expect('semi', "expected ';' after paragraph");
    return { kind: 'paragraph', content };
  }

  private parseList(depth: number): Inline[][] {
    this.expect('lbrace', "expected '{' after list declaration");
    const items: Inline[][] = [];
    while (!this.same('rbrace')) {
      if (this.expectIdent() !== 'item') throw this.fail('only item(...) allowed inside list blocks');
      this.expect('lparen', "expected '(' after item");
      items.push(this.parseInlineArgs());
      this.expect('rparen', "expected ')' after item");
      this.expect('semi', "expected ';' after item");
      if (items.length > 512 || depth > 32) throw this.fail('list is too large');
    }
    this.expect('rbrace', "expected '}' after list block");
    return items;
  }

  private parseCodeBlock(): Stmt {
    const props = this.parsePropsCall();
    const language = this.getProp<string>('code_block', props, 'lang', 'string');
    const body = this.getProp<string>('code_block', props, 'body', 'string');
    if (!body) throw this.fail('code_block requires body: "..."');
    return { kind: 'code_block', language: language ?? undefined, body };
  }

  private parseImage(): Stmt {
    const props = this.parsePropsCall();
    const path = this.getProp<string>('image', props, 'path', 'string');
    if (!path) throw this.fail('image requires path: "..."');
    if (path.includes('\0') || path.startsWith('http://') || path.startsWith('https://')) throw this.fail('image path must be a local asset path');
    return {
      kind: 'image',
      path,
      width: this.getProp<string>('image', props, 'width', 'string') ?? undefined,
      caption: this.getProp<string>('image', props, 'caption', 'string') ?? undefined,
    };
  }

  private parseAlign(depth: number): Stmt {
    this.expect('lparen', "expected '(' after align");
    const direction = this.expectString();
    this.expect('rparen', "expected ')' after align");
    this.expect('lbrace', "expected '{' after align");
    const body = this.parseUntil('rbrace', depth);
    this.expect('rbrace', "expected '}' after align block");
    return { kind: 'align', direction, body };
  }

  private parseColumns(depth: number): Stmt {
    this.expect('lparen', "expected '(' after columns");
    const count = this.expectInt();
    this.expect('rparen', "expected ')' after columns");
    this.expect('lbrace', "expected '{' after columns");
    const body = this.parseUntil('rbrace', depth);
    this.expect('rbrace', "expected '}' after columns block");
    return { kind: 'columns', count, body };
  }

  private parseShowIf(depth: number): Stmt {
    this.expect('lparen', "expected '(' after show_if");
    const path = this.expectString();
    this.expect('rparen', "expected ')' after show_if");
    this.expect('lbrace', "expected '{' after show_if");
    const body = this.parseUntil('rbrace', depth);
    this.expect('rbrace', "expected '}' after show_if block");
    return { kind: 'show_if', path, body };
  }

  private parseContainer(depth: number): Stmt {
    const props = this.parsePropsCallNoSemi();
    const fill = this.getProp<string>('container', props, 'fill', 'string');
    const radius = this.getProp<string>('container', props, 'radius', 'string');
    this.expect('lbrace', "expected '{' after container");
    const body = this.parseUntil('rbrace', depth);
    this.expect('rbrace', "expected '}' after container block");
    return { kind: 'container', fill: fill ?? undefined, radius: radius ?? undefined, body };
  }

  private parseStyle(depth: number): Stmt {
    this.expect('lparen', "expected '(' after style");
    const name = this.expectString();
    this.expect('rparen', "expected ')' after style");
    this.expect('lbrace', "expected '{' after style");
    const body = this.parseUntil('rbrace', depth);
    this.expect('rbrace', "expected '}' after style block");
    return { kind: 'style', name, body };
  }

  private parseDefineStyle(): Stmt {
    this.expect('lparen', "expected '(' after define_style");
    const name = this.expectString();
    this.expect('comma', "expected ',' after style name");
    const props = this.parseProps();
    this.expect('rparen', "expected ')' after define_style");
    this.expect('semi', "expected ';'");
    return { kind: 'define_style', name, props };
  }

  private parsePropsCallNoSemi(): Prop[] {
    this.expect('lparen', "expected '('");
    const props = this.parseProps();
    this.expect('rparen', "expected ')'");
    return props;
  }

  private parseInlineArgs(): Inline[] {
    if (this.same('rparen')) throw this.fail('at least one value is required');
    const items: Inline[] = [];
    for (;;) {
      items.push(this.parseInline());
      if (!this.eat('comma')) break;
      if (this.same('rparen')) break;
    }
    return items;
  }

  private parseInline(): Inline {
    if (this.current().type === 'string') {
      const value = this.currentString();
      this.bump();
      return { kind: 'text', value };
    }
    if (this.current().type !== 'ident') throw this.fail('expected string literal or inline function');
    const name = this.currentIdent();
    this.bump();
    this.expect('lparen', "expected '(' after inline function");
    if (name === 'strong') { const items = this.parseInlineArgs(); this.expect('rparen', "expected ')' after strong"); return { kind: 'strong', items }; }
    if (name === 'em') { const items = this.parseInlineArgs(); this.expect('rparen', "expected ')' after em"); return { kind: 'em', items }; }
    if (name === 'code') { const value = this.expectString(); this.expect('rparen', "expected ')' after code"); return { kind: 'code', value }; }
    if (name === 'link') {
      const url = this.expectString();
      this.expect('comma', "expected ',' after link url");
      const label = this.parseInlineArgs();
      this.expect('rparen', "expected ')' after link");
      return { kind: 'link', url, label };
    }
    if (name === 'text') {
      const props = this.parseProps();
      this.eat('comma');
      const content = this.parseInlineArgs();
      this.expect('rparen', "expected ')' after text");
      return { kind: 'text_span', props, content };
    }
    throw this.fail(`unknown inline function '${name}'`);
  }

  private parseValue(): Value {
    if (this.current().type === 'string') { const value = this.currentString(); this.bump(); return { kind: 'string', value }; }
    if (this.current().type === 'int') { const value = this.currentInt(); this.bump(); return { kind: 'int', value }; }
    if (this.current().type !== 'lbracket') throw this.fail('expected string, integer, or array');
    this.expect('lbracket', "expected '['");
    if (this.eat('rbracket')) return { kind: 'strings', value: [] };
    if (this.same('lbracket')) {
      const rows: string[][] = [];
      for (;;) {
        this.expect('lbracket', "expected '[' to start nested array");
        const row = this.parseStringItems();
        this.expect('rbracket', "expected ']' after nested array");
        rows.push(row);
        if (!this.eat('comma')) break;
        if (this.same('rbracket')) break;
      }
      this.expect('rbracket', "expected ']' after array");
      return { kind: 'matrix', value: rows };
    }
    const value = this.parseStringItems();
    this.expect('rbracket', "expected ']' after array");
    return { kind: 'strings', value };
  }

  private parseStringItems(): string[] {
    const items: string[] = [];
    if (this.same('rbracket')) return items;
    for (;;) {
      items.push(this.expectString());
      if (!this.eat('comma')) break;
      if (this.same('rbracket')) break;
    }
    return items;
  }

  private getProp<T>(scope: string, props: Prop[], name: string, kind: Value['kind']): T | null {
    const prop = props.find((entry) => entry.name === name);
    if (!prop) return null;
    if (prop.value.kind !== kind) throw this.fail(`${scope}: ${name} has wrong type`);
    return (prop.value as Extract<Value, { kind: typeof kind }>).value as T;
  }

  private emptyCall(): void {
    this.expect('lparen', "expected '('");
    this.expect('rparen', "expected ')'");
    this.expect('semi', "expected ';'");
  }

  private expect(type: Token['type'], message: string): void { if (this.same(type)) this.bump(); else throw this.fail(message); }
  private eat(type: Token['type']): boolean { if (!this.same(type)) return false; this.bump(); return true; }
  private expectIdent(): string { if (this.current().type !== 'ident') throw this.fail('expected identifier'); const value = this.currentIdent(); this.bump(); return value; }
  private expectString(): string { if (this.current().type !== 'string') throw this.fail('expected string literal'); const value = this.currentString(); this.bump(); return value; }
  private expectInt(): number { if (this.current().type !== 'int') throw this.fail('expected integer'); const value = this.currentInt(); this.bump(); return value; }
  private same(type: Token['type']): boolean { return this.current().type === type; }
  private peekIdent(value: string): boolean { return this.current().type === 'ident' && this.currentIdent() === value; }
  private current(): Token { return this.tokens[this.index]; }
  private bump(): void { if (this.index < this.tokens.length - 1) this.index += 1; }
  private fail(message: string): TypeforgeCompileError { const token = this.current(); return new TypeforgeCompileError(message, token.line, token.column); }
  private currentIdent(): string { return (this.current() as Extract<Token, { type: 'ident' }>).value; }
  private currentString(): string { return (this.current() as Extract<Token, { type: 'string' }>).value; }
  private currentInt(): number { return (this.current() as Extract<Token, { type: 'int' }>).value; }
}

function renderDocument(stmts: Stmt[]): string {
  return stmts.map(renderStmt).join('');
}

function renderStmt(stmt: Stmt): string {
  if (stmt.kind === 'page' || stmt.kind === 'text') return `#set ${stmt.kind}(${renderProps(stmt.props)})\n`;
  if (stmt.kind === 'heading') return `${'='.repeat(stmt.level)} ${renderInlineList(stmt.content)}\n\n`;
  if (stmt.kind === 'paragraph') return `${renderInlineList(stmt.content)}\n\n`;
  if (stmt.kind === 'bullet_list' || stmt.kind === 'number_list') {
    const marker = stmt.kind === 'bullet_list' ? '-' : '+';
    return `${stmt.items.map((item) => `${marker} ${renderInlineList(item)}`).join('\n')}\n\n`;
  }
  if (stmt.kind === 'table') {
    const columns = Math.max(1, stmt.headers.length, ...stmt.rows.map((row) => row.length));
    const header = stmt.headers.length ? `  table.header(${stmt.headers.map((cell) => `[${escapeText(cell)}]`).join(', ')}),\n` : '';
    const rows = stmt.rows.map((row) => `  ${row.map((cell) => `[${escapeText(cell)}]`).join(', ')},\n`).join('');
    return `#table(\n  columns: ${columns},\n${header}${rows})\n\n`;
  }
  if (stmt.kind === 'grid_table') return `#table(columns: ${stmt.columns}, [\n${stmt.body.map(renderStmt).join('')}])\n\n`;
  if (stmt.kind === 'code_block') return `#raw(${stmt.language ? `lang: "${escapeString(stmt.language)}", ` : ''}block: true, [\n${stmt.body}\n])\n\n`;
  if (stmt.kind === 'image') {
    const width = stmt.width ? `, width: ${stmt.width}` : '';
    if (stmt.caption) return `#figure(\n  #image("${escapeString(stmt.path)}"${width}),\n  caption: [${escapeText(stmt.caption)}]\n)\n\n`;
    return `#image("${escapeString(stmt.path)}"${width})\n\n`;
  }
  if (stmt.kind === 'rule') {
    if (stmt.props.length === 0) return '#line(length: 100%)\n\n';
    return `#line(${renderProps(stmt.props)})\n\n`;
  }
  if (stmt.kind === 'page_break') return '#pagebreak()\n\n';
  if (stmt.kind === 'spacer') return `#v(${stmt.value})\n\n`;
  if (stmt.kind === 'align') return `#align(${stmt.direction}) [\n${stmt.body.map(renderStmt).join('')}]\n\n`;
  if (stmt.kind === 'columns') return `#column(count: ${stmt.count}) [\n${stmt.body.map(renderStmt).join('')}]\n\n`;
  if (stmt.kind === 'show_if') {
    const val = stmt.path.trim();
    if (!val || val === 'false' || val === 'none' || val === 'null') return '';
    return stmt.body.map(renderStmt).join('');
  }
  if (stmt.kind === 'container') {
    const fill = stmt.fill ? `fill: ${stmt.fill}, ` : '';
    const radius = stmt.radius ? `radius: ${stmt.radius}, ` : '';
    return `#rect(${fill}${radius}width: 100%, stroke: none, inset: 10pt)[\n${stmt.body.map(renderStmt).join('')}]\n\n`;
  }
  if (stmt.kind === 'style') return `#typeforge_style_${stmt.name}( [\n${stmt.body.map(renderStmt).join('')}])\n\n`;
  if (stmt.kind === 'define_style') return `#let typeforge_style_${stmt.name}(body) = { set text(${renderProps(stmt.props)}); body }\n\n`;
  if (stmt.kind === 'block') return stmt.body.map(renderStmt).join('');
  return '';
}

function renderProps(props: Prop[]): string {
  return props.map((prop) => `${prop.name}: ${renderValue(prop.value)}`).join(', ');
}

function renderValue(value: Value): string {
  if (value.kind === 'string') {
    if (isTypstLiteral(value.value)) return value.value;
    return `"${escapeString(value.value)}"`;
  }
  if (value.kind === 'int') return String(value.value);
  if (value.kind === 'strings') return `(${value.value.map((entry) => `"${escapeString(entry)}"`).join(', ')})`;
  return `(${value.value.map((row) => `(${row.map((entry) => `"${escapeString(entry)}"`).join(', ')})`).join(', ')})`;
}

function isTypstLiteral(s: string): boolean {
  s = s.trim();
  if (!s) return false;

  const literals = [
    'auto', 'none', 'true', 'false', 'ltr', 'rtl', 'ttb', 'btt',
    'center', 'left', 'right', 'white', 'black', 'red', 'green', 'blue',
    'yellow', 'cyan', 'magenta', 'gray', 'grey', 'silver', 'maroon',
    'olive', 'navy', 'purple', 'teal', 'orange', 'pink', 'brown'
  ];
  if (literals.includes(s)) return true;

  if (s.startsWith('rgb(') || s.startsWith('cmyk(') || s.startsWith('oklch(') || s.startsWith('luma(') || s.startsWith('color(') || s.startsWith('gradient.')) return true;
  if (/^#[0-9a-fA-F]+$/.test(s)) return true;

  const units = ['mm', 'pt', 'in', 'cm', '%', 'em', 'fr', 'deg', 'rad'];
  for (const unit of units) {
    if (s.endsWith(unit)) {
      const numPart = s.slice(0, -unit.length).trim();
      if (!numPart || !isNaN(Number(numPart))) return true;
    }
  }

  if (s.startsWith('(') && s.endsWith(')')) return true;
  if (s.includes('+')) return s.split('+').every(part => isTypstLiteral(part.trim()));

  return false;
}

function renderInlineList(items: Inline[]): string { return items.map(renderInline).join(''); }
function renderInline(item: Inline): string {
  if (item.kind === 'text') return escapeText(item.value);
  if (item.kind === 'strong') return `#strong[${renderInlineList(item.items)}]`;
  if (item.kind === 'em') return `#emph[${renderInlineList(item.items)}]`;
  if (item.kind === 'code') return `#raw("${escapeString(item.value)}")`;
  if (item.kind === 'text_span') return `#text(${renderProps(item.props)})[${renderInlineList(item.content)}]`;
  return `#link("${escapeString(item.url)}")[${renderInlineList(item.label)}]`;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/#/g, '\\#').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/@/g, '\\@');
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}


