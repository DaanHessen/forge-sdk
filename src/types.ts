/**
 * Shared TypeScript interfaces for the Typeforge API SDK.
 */

/** Authentication options for the client. */
export interface ClientOptions {
  /** Your Typeforge API API key (sk_...). */
  apiKey: string;
  /** Override the base URL. Defaults to https://api.Typeforge API.com */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
}

/** Options for rendering a document from the API. */
export interface RenderOptions {
  /** ID of a template stored in Typeforge API. */
  templateId?: string;
  /** Raw Typst source content. Use TypstBuilder.build().toTypst() here. */
  content?: string;
  /** Explicitly set the language: 'typst' | 'markdown' | 'latex' | 'typeforge'. Auto-detected if omitted. */
  language?: 'typst' | 'markdown' | 'latex' | 'typeforge';
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
  /**
   * If true, the document will be persisted in the Typeforge Lifecycle.
   * Instead of raw bytes, the API will return document metadata including an access token.
   */
  persist?: boolean;
}

/** Options for rendering Typeforge after local compilation to Typst. */
export interface RenderTypeforgeOptions {
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

/** Metadata for a managed document in the Typeforge Lifecycle. */
export interface DocumentMetadata {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  access_token: string;
  portal_url: string;
  download_url: string;
  view_count: number;
  file_size_bytes: number;
  expires_at: string;
  created_at: string;
}

/** A rendered PDF result. */
export interface RenderResult {
  /** The raw PDF bytes. Null if the document was persisted. */
  pdf: Buffer | null;
  /** Size in bytes. */
  size: number;
  /** Save the PDF to a file path. */
  save(path: string): Promise<void>;
  /** Metadata if the document was persisted. */
  metadata?: DocumentMetadata;
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


