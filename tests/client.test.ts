import * as fs from 'fs';
import * as path from 'path';
import { bundleProject } from '../src/utils/bundle';

describe('bundleProject', () => {
  const POSTER_ENTRY = path.resolve(__dirname, '../../scratch/typst-poster/examples/example.typ');
  const POSTER_ROOT = path.resolve(__dirname, '../../scratch/typst-poster/examples');
  const hasPosterFixture = fs.existsSync(POSTER_ENTRY) && fs.existsSync(POSTER_ROOT);

  if (!hasPosterFixture) {
    it.skip('scratch typst-poster fixture not present', () => {});
    return;
  }

  it('collects the entry file', async () => {
    const bundle = await bundleProject(POSTER_ENTRY);
    expect(bundle.mainFilePath).toBe('example.typ');
  });

  it('collects all .typ and image files', async () => {
    const bundle = await bundleProject(POSTER_ENTRY);
    expect(Object.keys(bundle.files)).toContain('example.typ');
  });

  it('returns base64-encoded content for all files', async () => {
    const bundle = await bundleProject(POSTER_ENTRY);
    for (const [, content] of Object.entries(bundle.files)) {
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toMatch(/^[A-Za-z0-9+/]+=*$/);
    }
  });

  it('performs interpolation across text files', async () => {
    const tempDir = path.resolve(__dirname, '../../scratch/test-interpolation');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    fs.writeFileSync(path.join(tempDir, 'main.typ'), '#import "sub.typ": * \n = {{title}} \n {{body}}');
    fs.writeFileSync(path.join(tempDir, 'sub.typ'), '#let x = "{{shared}}"');

    const bundle = await bundleProject(path.join(tempDir, 'main.typ'), {
      data: { title: 'Interpolated Title', body: 'Main body content', shared: 'Shared Value' }
    });

    const mainContent = Buffer.from(bundle.files['main.typ'], 'base64').toString('utf-8');
    const subContent = Buffer.from(bundle.files['sub.typ'], 'base64').toString('utf-8');

    expect(mainContent).toContain('= Interpolated Title');
    expect(mainContent).toContain('Main body content');
    expect(subContent).toContain('#let x = "Shared Value"');
  });

  it('handles non-string data types for interpolation', async () => {
    const tempDir = path.resolve(__dirname, '../../scratch/test-types');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, 'main.typ'), 'Value: {{val}}');

    const bundle = await bundleProject(path.join(tempDir, 'main.typ'), {
      data: { val: 123.45 }
    });

    const content = Buffer.from(bundle.files['main.typ'], 'base64').toString('utf-8');
    expect(content).toBe('Value: 123.45');
  });

  it('throws if the entry file does not exist', async () => {
    await expect(bundleProject('/nonexistent/path/file.typ')).rejects.toThrow('Entry file not found');
  });
});

describe('ForgeAPIClient.renderLocal (live)', () => {
  const apiKey = process.env.ForgeAPI_TEST_API_KEY;
  const baseUrl = process.env.ForgeAPI_TEST_BASE_URL ?? 'http://localhost:3000';
  const POSTER_ENTRY = path.resolve(__dirname, '../../scratch/typst-poster/examples/example.typ');

  if (!apiKey) {
    it.skip('ForgeAPI_TEST_API_KEY not set - skipping live render test', () => {});
    return;
  }

  it('renders the typst-poster example to a PDF', async () => {
    const { ForgeAPIClient } = await import('../src/client');
    const client = new ForgeAPIClient({ apiKey, baseUrl });
    const result = await client.renderLocal(POSTER_ENTRY);
    expect(result.pdf).toBeInstanceOf(Buffer);
    expect(result.size).toBeGreaterThan(100_000);
    expect(result.pdf.slice(0, 4).toString('ascii')).toBe('%PDF');
  }, 30_000);
});
