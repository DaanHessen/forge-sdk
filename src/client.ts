import * as fs from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import { ClientOptions, RenderTypeforgeOptions, RenderOptions, RenderLocalOptions, RenderResult } from './types';
import { bundleProject } from './utils/bundle';
import { compileTypeforge } from './forge';

/** Error thrown when the Typeforge API API returns an error response. */
export class TypeforgeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string
  ) {
    super(message);
    this.name = 'TypeforgeError';
  }
}

/** Creates a RenderResult from raw PDF bytes. */
function makeResult(pdf: Buffer): RenderResult {
  return {
    pdf,
    size: pdf.length,
    async save(filePath: string) {
      await fs.writeFile(filePath, pdf);
    },
  };
}

/**
 * Main client for the Typeforge API API.
 *
 * @example
 * ```ts
 * const client = new TypeforgeClient({ apiKey: 'sk_...' });
 *
 * // Render a stored template
 * const result = await client.render({ templateId: 'invoice', data: { total: 150 } });
 * await result.save('invoice.pdf');
 *
 * // Render a local Typst project
 * const result = await client.renderLocal('./poster/example.typ');
 * await result.save('poster.pdf');
 *
 * // Build a document in code and render it
 * const doc = new TypstBuilder().heading('Hello').paragraph('World').build();
 * const result = await client.render({ content: doc.toTypst() });
 * await result.save('hello.pdf');
 * ```
 */
export class TypeforgeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.Typeforge API.com').replace(/\/$/, '');
    this.timeout = options.timeout ?? 60_000;
  }

  /**
   * Render a PDF from a template ID, raw content, or a builder document.
   */
  async render(options: RenderOptions): Promise<RenderResult> {
    if (!options.templateId && !options.content) {
      throw new Error('Either templateId or content must be provided.');
    }

    const payload: Record<string, unknown> = {
      template_id: options.templateId,
      content: options.content,
      language: options.language,
      data: options.data ?? {},
      files: options.files,
      main_file_path: options.mainFilePath,
    };

    // Remove undefined keys
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    const pdf = await this._post('/render', payload);
    return makeResult(pdf);
  }

  /**
   * Compile Typeforge locally to Typst, then render the resulting Typst document.
   */
  async renderTypeforge(source: string, options: RenderTypeforgeOptions = {}): Promise<RenderResult> {
    const typst = compileTypeforge(source);
    return this.render({
      content: typst,
      language: 'typst',
      data: options.data ?? {},
    });
  }

  /**
   * Bundle a local Typst project and render it.
   *
   * Automatically:
   * 1. Crawls the directory of the entry `.typ` file.
   * 2. Collects all `.typ`, image, and font files.
   * 3. Respects `.gitignore` rules.
   * 4. Sends the bundle to the Typeforge API API and returns the rendered PDF.
   *
   * @param entryFilePath - Path to the main `.typ` file.
   * @param options       - Optional data and file inclusion settings.
   */
  async renderLocal(entryFilePath: string, options: RenderLocalOptions = {}): Promise<RenderResult> {
    const bundle = await bundleProject(entryFilePath, {
      projectRoot: options.projectRoot,
      extraExtensions: options.include,
      data: options.data,
    });

    return this.render({
      content: Buffer.from(bundle.files[bundle.mainFilePath], 'base64').toString('utf-8'),
      language: 'typst',
      mainFilePath: bundle.mainFilePath,
      data: options.data ?? {},
      files: bundle.files,
    });
  }

  /**
   * List all registered webhooks for the user.
   */
  async listWebhooks(): Promise<any[]> {
    const response = await this._request('GET', '/api/webhooks');
    return JSON.parse(response.toString('utf-8'));
  }

  /**
   * Register a new webhook.
   */
  async createWebhook(label: string, targetUrl: string, templateId?: string): Promise<any> {
    const response = await this._request('POST', '/api/webhooks', {
      label,
      target_url: targetUrl,
      template_id: templateId,
    });
    return JSON.parse(response.toString('utf-8'));
  }

  /**
   * Delete a webhook.
   */
  async deleteWebhook(id: string): Promise<void> {
    await this._request('DELETE', `/api/webhooks/${id}`);
  }

  /**
   * Trigger a webhook render and delivery.
   */
  async triggerWebhook(id: string, data: any = {}): Promise<any> {
    const response = await this._request('POST', `/api/webhooks/${id}/trigger`, { data });
    return JSON.parse(response.toString('utf-8'));
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP transport (zero-dependency, uses Node.js built-ins)
  // ---------------------------------------------------------------------------

  private async _post(endpoint: string, body: unknown): Promise<Buffer> {
    return this._request('POST', endpoint, body);
  }

  private async _request(method: 'GET' | 'POST' | 'DELETE', endpoint: string, body?: unknown): Promise<Buffer> {
    const url = new URL(this.baseUrl + endpoint);
    const isHttps = url.protocol === 'https:';
    const requestLib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const req = requestLib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'Typeforge API-sdk-node/0.1.0',
          },
          timeout: this.timeout,
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => chunks.push(chunk));

          res.on('end', () => {
            const responseBody = Buffer.concat(chunks);
            const statusCode = res.statusCode ?? 0;

            if (statusCode >= 200 && statusCode < 300) {
              resolve(responseBody);
              return;
            }

            // Parse error response
            let errorCode = 'UNKNOWN_ERROR';
            let message = `API returned status ${statusCode}`;
            try {
              const parsed = JSON.parse(responseBody.toString('utf-8'));
              message = parsed.error ?? message;
              errorCode = parsed.error_code ?? errorCode;
            } catch {
              // Non-JSON response body
              message = responseBody.toString('utf-8').slice(0, 200);
            }

            reject(new TypeforgeError(statusCode, errorCode, message));
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeout}ms`));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }
}


