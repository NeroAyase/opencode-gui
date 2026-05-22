import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

const SUPPORTED_LANGS: readonly string[] = [
  "typescript", "javascript", "python", "bash", "json", "css", "html",
  "markdown", "tsx", "jsx", "go", "rust", "java", "c", "cpp", "yaml",
  "toml", "diff", "text", "sh", "shell", "sql", "xml", "dockerfile",
  "ini", "perl", "ruby", "php", "swift", "kotlin", "scala", "lua",
  "r", "dart", "vue", "svelte",
];

const VALID_LANG_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGS);

const LANG_ALIASES: ReadonlyMap<string, string> = new Map([
  ["sh", "bash"],
  ["shell", "bash"],
  ["ts", "typescript"],
  ["js", "javascript"],
  ["py", "python"],
  ["rb", "ruby"],
  ["rs", "rust"],
  ["kt", "kotlin"],
  ["yml", "yaml"],
  ["md", "markdown"],
  ["docker", "dockerfile"],
]);

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "typescript", "javascript", "python", "bash", "json", "css", "html",
        "markdown", "tsx", "jsx", "go", "rust", "java", "c", "cpp", "yaml",
        "toml", "diff",
      ],
    });
  }
  return highlighterPromise;
}

function resolveAlias(lang: string): string {
  const lower = lang.toLowerCase();
  return LANG_ALIASES.get(lower) ?? lower;
}

export function isValidLang(lang: string): boolean {
  const resolved = resolveAlias(lang);
  return VALID_LANG_SET.has(resolved);
}

export function detectLanguage(code: string, hint?: string): BundledLanguage {
  // If hint is provided and valid, use it
  if (hint) {
    const resolved = resolveAlias(hint);
    if (VALID_LANG_SET.has(resolved)) {
      return resolved as BundledLanguage;
    }
  }

  // Simple heuristic detection
  if (code.includes("import ") && code.includes("from ")) return "typescript";
  if (code.startsWith("#!") || code.startsWith("$ ")) return "bash";
  if (code.startsWith("{") || code.startsWith("[")) return "json";
  if (code.includes("def ") && code.includes(":")) return "python";
  if (code.includes("func ") && code.includes(":=")) return "go";
  if (code.includes("fn ") && code.includes("->")) return "rust";

  return "plaintext" as BundledLanguage;
}

export function getThemeForVSCode(): string {
  // Use github-dark as default; VSCode webview typically uses dark theme
  return "github-dark";
}

/**
 * Highlight code using Shiki. Returns HTML string with syntax highlighting.
 * Falls back to escaped plain text if the highlighter fails or isn't loaded yet.
 */
export async function highlightCode(
  code: string,
  lang?: string,
): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    const resolvedLang = detectLanguage(code, lang);
    const theme = getThemeForVSCode();

    // Ensure the language is loaded
    const loadedLangs = highlighter.getLoadedLanguages();
    if (!loadedLangs.includes(resolvedLang)) {
      // Fall back to plain text if language not loaded
      return escapeHtml(code);
    }

    return highlighter.codeToHtml(code, {
      lang: resolvedLang,
      theme,
    });
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Map a file path extension to a Shiki language identifier */
const EXT_LANG_MAP: ReadonlyMap<string, string> = new Map([
  [".ts", "typescript"],
  [".tsx", "tsx"],
  [".js", "javascript"],
  [".jsx", "jsx"],
  [".py", "python"],
  [".rb", "ruby"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".c", "c"],
  [".cpp", "cpp"],
  [".h", "c"],
  [".hpp", "cpp"],
  [".css", "css"],
  [".html", "html"],
  [".json", "json"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".toml", "toml"],
  [".md", "markdown"],
  [".sh", "bash"],
  [".bash", "bash"],
  [".sql", "sql"],
  [".xml", "xml"],
  [".php", "php"],
  [".swift", "swift"],
  [".kt", "kotlin"],
  [".scala", "scala"],
  [".lua", "lua"],
  [".dart", "dart"],
  [".vue", "vue"],
  [".svelte", "svelte"],
  [".ini", "ini"],
  [".pl", "perl"],
  [".r", "r"],
  [".dockerfile", "dockerfile"],
]);

export function langFromFilePath(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);

  // Check exact filename matches first (e.g., Dockerfile)
  if (fileName.toLowerCase() === "dockerfile") return "dockerfile";

  // Extract extension
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) return undefined;

  const ext = fileName.slice(dotIndex).toLowerCase();
  const lang = EXT_LANG_MAP.get(ext);
  if (lang && VALID_LANG_SET.has(lang)) return lang;
  return undefined;
}
