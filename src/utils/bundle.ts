import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

/** File extensions that will be included when crawling a project directory. */
const DEFAULT_INCLUDE_EXTENSIONS = new Set([
  '.typ', '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.pdf', '.ttf', '.otf', '.woff', '.woff2',
]);

/** Binary file extensions that must be base64-encoded. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.pdf', '.ttf', '.otf', '.woff', '.woff2',
]);

export interface BundleResult {
  /** Files dict: relative path â†’ base64 string */
  files: Record<string, string>;
  /** The relative path of the main entry file */
  mainFilePath: string;
}

/**
 * Bundles a local Typst project directory into a payload suitable for the
 * ForgeAPI `/render` API endpoint.
 *
 * - Resolves the project root as the directory containing the entry file.
 * - Crawls all files with accepted extensions.
 * - Respects `.gitignore` rules in the project root (if present).
 * - Base64-encodes binary files; sends text files as UTF-8 strings also base64.
 *
 * @param entryFilePath - Absolute or relative path to the main `.typ` file.
 * @param options - Additional options including interpolation data and extra extensions.
 */
export async function bundleProject(
  entryFilePath: string,
  options: { 
    extraExtensions?: string[], 
    data?: Record<string, unknown>,
    projectRoot?: string
  } = {}
): Promise<BundleResult> {
  const resolvedEntry = path.resolve(entryFilePath);
  const projectRoot = options.projectRoot 
    ? path.resolve(options.projectRoot) 
    : path.dirname(resolvedEntry);

  if (!fs.existsSync(resolvedEntry)) {
    throw new Error(`Entry file not found: ${resolvedEntry}`);
  }

  const mainFilePath = path.relative(projectRoot, resolvedEntry).replace(/\\/g, '/');

  // Load .gitignore rules if present
  const ig = ignore();
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }
  // Always ignore common non-essential paths
  ig.add(['node_modules', '.git', 'dist', 'target', '*.lock', '*.db']);

  const includeExtensions = new Set([
    ...DEFAULT_INCLUDE_EXTENSIONS,
    ...(options.extraExtensions ?? []),
  ]);

  const files: Record<string, string> = {};

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

      // Skip gitignored paths
      if (ig.ignores(relativePath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (includeExtensions.has(ext)) {
          let fileBuffer = fs.readFileSync(fullPath);
          
          // Perform interpolation on text files if data is provided
          if (options.data && !isBinaryExtension(ext)) {
            let content = fileBuffer.toString('utf-8');
            for (const [key, value] of Object.entries(options.data)) {
              // Match both {{key}} and {{{key}}}
              const re = new RegExp(`\\{{2,3}${key}\\}{2,3}`, 'g');
              content = content.replace(re, String(value));
            }
            fileBuffer = Buffer.from(content, 'utf-8');
          }

          files[relativePath] = fileBuffer.toString('base64');
        }
      }
    }
  }

  walk(projectRoot);

  return { files, mainFilePath };
}

/**
 * Checks whether a file extension is binary (needs base64 encoding vs plain text).
 */
export function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}
