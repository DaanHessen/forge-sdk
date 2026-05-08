/**
 * Shared TypeScript interfaces for the ForgeAPI SDK.
 */

/** Authentication options for the client. */
export interface ClientOptions {
  /** Your ForgeAPI API key (sk_...). */
  apiKey: string;
  /** Override the base URL. Defaults to https://api.ForgeAPI.com */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
}

/** Options for rendering a document from the API. */
export interface RenderOptions {
  /** ID of a template stored in ForgeAPI. */
  templateId?: string;
  /** Raw Typst source content. Use TypstBuilder.build().toTypst() here. */
  content?: string;
  /** Explicitly set the language: 'typst' | 'markdown' | 'latex' | 'forge'. Auto-detected if omitted. */
  language?: 'typst' | 'markdown' | 'latex' | 'forge';
  /** JSON data to interpolate into the template. */
  data?: Record<string, unknown>;
  /**
   * Map of file paths to base64-encoded content.
   * Keys are paths relative to the project root (e.g. "images/logo.png").
   * Values are base64-encoded file contents.
   */
  files?: Record<string, string>;
  /**
   * Virtual path for the main document within the bundled files.
   * Required when using `files` to ensure relative imports resolve correctly.
   */
  mainFilePath?: string;
}

/** Options for rendering Forge after local compilation to Typst. */
export interface RenderForgeOptions {
  /** JSON data to interpolate into the compiled Typst template. */
  data?: Record<string, unknown>;
}

/** Options for rendering from a local directory. */
export interface RenderLocalOptions {
  /** JSON data to interpolate into the template. */
  data?: Record<string, unknown>;
  /**
   * File extensions to include when bundling the project directory.
   * Defaults to common Typst + image + font extensions.
   */
  include?: string[];
  /**
   * Override the project root directory.
   * Defaults to the directory containing the entry file.
   */
  projectRoot?: string;
}

/** A rendered PDF result. */
export interface RenderResult {
  /** The raw PDF bytes. */
  pdf: Buffer;
  /** Size in bytes. */
  size: number;
  /** Save the PDF to a file path. */
  save(path: string): Promise<void>;
}

/** A Typst compilation error. */
export interface ForgeAPIError {
  code: string;
  message: string;
}

/** A registered webhook. */
export interface Webhook {
  id: string;
  label: string;
  target_url: string;
  template_id?: string;
  created_at: string;
}

/** Response from triggering a webhook. */
export interface WebhookTriggerResult {
  webhook_id: string;
  delivered: boolean;
  status_code: number;
  duration_ms: number;
  error?: string;
}
