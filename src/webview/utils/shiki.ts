import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

type HighlighterCore = Awaited<ReturnType<typeof createHighlighterCore>>;

// Import ONLY the languages actually used
import langTs from "shiki/langs/typescript.mjs";
import langJs from "shiki/langs/javascript.mjs";
import langPython from "shiki/langs/python.mjs";
import langBash from "shiki/langs/bash.mjs";
import langJson from "shiki/langs/json.mjs";
import langCss from "shiki/langs/css.mjs";
import langHtml from "shiki/langs/html.mjs";
import langMd from "shiki/langs/markdown.mjs";
import langTsx from "shiki/langs/tsx.mjs";
import langJsx from "shiki/langs/jsx.mjs";
import langGo from "shiki/langs/go.mjs";
import langRust from "shiki/langs/rust.mjs";
import langJava from "shiki/langs/java.mjs";
import langC from "shiki/langs/c.mjs";
import langCpp from "shiki/langs/cpp.mjs";
import langYaml from "shiki/langs/yaml.mjs";
import langToml from "shiki/langs/toml.mjs";
import langDiff from "shiki/langs/diff.mjs";
import langSql from "shiki/langs/sql.mjs";
import langXml from "shiki/langs/xml.mjs";
import langDockerfile from "shiki/langs/dockerfile.mjs";
import langIni from "shiki/langs/ini.mjs";
import langPerl from "shiki/langs/perl.mjs";
import langRuby from "shiki/langs/ruby.mjs";
import langPhp from "shiki/langs/php.mjs";
import langSwift from "shiki/langs/swift.mjs";
import langKotlin from "shiki/langs/kotlin.mjs";
import langScala from "shiki/langs/scala.mjs";
import langLua from "shiki/langs/lua.mjs";
import langR from "shiki/langs/r.mjs";
import langDart from "shiki/langs/dart.mjs";
import langVue from "shiki/langs/vue.mjs";
import langSvelte from "shiki/langs/svelte.mjs";
import langShell from "shiki/langs/shellscript.mjs";

// Import ONLY the themes actually used
import themeGithubDark from "shiki/themes/github-dark.mjs";
import themeGithubLight from "shiki/themes/github-light.mjs";

type SupportedLang = string;

let highlighterPromise: Promise<HighlighterCore> | null = null;

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

const LANG_REGISTRY = [
  langTs, langJs, langPython, langBash, langJson, langCss, langHtml,
  langMd, langTsx, langJsx, langGo, langRust, langJava, langC, langCpp,
  langYaml, langToml, langDiff, langSql, langXml, langDockerfile, langIni,
  langPerl, langRuby, langPhp, langSwift, langKotlin, langScala, langLua,
  langR, langDart, langVue, langSvelte, langShell,
];

export async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [themeGithubDark, themeGithubLight],
      langs: LANG_REGISTRY,
      engine: createOnigurumaEngine(import("shiki/wasm")),
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

export function detectLanguage(code: string, hint?: string): SupportedLang {
  // If hint is provided and valid, use it
  if (hint) {
    const resolved = resolveAlias(hint);
    if (VALID_LANG_SET.has(resolved)) {
      return resolved as SupportedLang;
    }
  }

  // Simple heuristic detection
  if (code.includes("import ") && code.includes("from ")) return "typescript";
  if (code.startsWith("#!") || code.startsWith("$ ")) return "bash";
  if (code.startsWith("{") || code.startsWith("[")) return "json";
  if (code.includes("def ") && code.includes(":")) return "python";
  if (code.includes("func ") && code.includes(":=")) return "go";
  if (code.includes("fn ") && code.includes("->")) return "rust";

  return "plaintext" as SupportedLang;
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
