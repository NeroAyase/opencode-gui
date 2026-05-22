
import { For, Show, createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { highlightCode } from "../../utils/shiki";

interface DiffViewerProps {
  diff: string;
  language?: string;
}

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
}

interface ParsedDiff {
  startLine: number;
  endLine: number;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

export function getDiffStats(diff: string): DiffStats {
  const lines = diff.split("\n");
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  return { additions, deletions };
}

function parseDiff(diff: string): ParsedDiff {
  const rawLines = diff.split("\n");
  const lines: DiffLine[] = [];
  let startLine = 0;
  let currentLine = 0;
  let additions = 0;
  let deletions = 0;

  for (const line of rawLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        startLine = parseInt(match[1], 10);
        currentLine = startLine;
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      lines.push({ type: "add", content: line.slice(1) });
      currentLine++;
      additions++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      lines.push({ type: "remove", content: line.slice(1) });
      deletions++;
    } else if (line.startsWith(" ")) {
      lines.push({ type: "context", content: line.slice(1) });
      currentLine++;
    }
  }

  return {
    startLine,
    endLine: currentLine - 1,
    lines,
    additions,
    deletions,
  };
}

export function DiffViewer(props: DiffViewerProps) {
  const parsed = createMemo(() => parseDiff(props.diff));

  // Syntax highlighting for diff content
  const [highlightedLines, setHighlightedLines] = createSignal<Map<number, string> | null>(null);
  let cancelled = false;

  onMount(() => {
    if (!props.language) return;

    // Collect all non-removed lines for highlighting context
    const allContent = parsed().lines
      .map((line) => line.content)
      .join("\n");

    highlightCode(allContent, props.language).then((html) => {
      if (cancelled) return;

      // Parse the highlighted HTML into per-line spans
      const lineMap = new Map<number, string>();
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      // Shiki wraps output in <pre><code>...</code></pre>
      const codeEl = tempDiv.querySelector("code") ?? tempDiv;
      const rawHtml = codeEl.innerHTML;

      // Split by newlines while preserving HTML tags
      const htmlLines = splitHtmlByLines(rawHtml);
      parsed().lines.forEach((line, i) => {
        if (htmlLines[i] !== undefined) {
          lineMap.set(i, htmlLines[i]);
        }
      });

      setHighlightedLines(lineMap);
    });
  });

  onCleanup(() => {
    cancelled = true;
  });

  return (
    <div class="diff-viewer">
      <Show when={parsed().lines.length > 0}>
        <div class="diff-line-range">
          <span class="diff-line-range-num">{parsed().startLine}</span>
        </div>
      </Show>
      <For each={parsed().lines}>
        {(line, index) => (
          <div
            class="diff-line"
            classList={{
              "diff-line--add": line.type === "add",
              "diff-line--remove": line.type === "remove",
              "diff-line--context": line.type === "context",
            }}
          >
            <span class="diff-line-sign">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <Show
              when={highlightedLines()?.has(index())}
              fallback={<span class="diff-line-content"> {line.content}</span>}
            >
              <span
                class="diff-line-content diff-line-content--highlighted"
                innerHTML={` ${highlightedLines()!.get(index()) ?? ""}`}
              />
            </Show>
          </div>
        )}
      </For>
      <Show when={parsed().lines.length > 0}>
        <div class="diff-line-range diff-line-range--end">
          <span class="diff-line-range-num">{parsed().endLine}</span>
        </div>
      </Show>
    </div>
  );
}

/**
 * Split HTML content by visible newlines while preserving
 * open tags across lines (Shiki spans may span multiple lines).
 */
function splitHtmlByLines(html: string): string[] {
  // Replace literal newlines with a placeholder, then split
  const PLACEHOLDER = "\x00LINEBREAK\x00";
  const processed = html.replace(/\n/g, PLACEHOLDER);
  const segments = processed.split(PLACEHOLDER);

  // Track open tags and prepend them to subsequent lines
  const result: string[] = [];
  let openTags = "";

  for (const segment of segments) {
    const line = openTags + segment;

    // Find all opened tags in this line that aren't closed
    const openTagRegex = /<(\w+)[^>]*>/g;
    const closeTagRegex = /<\/(\w+)>/g;
    const openStack: string[] = [];
    let match: RegExpExecArray | null;

    openTagRegex.lastIndex = 0;
    while ((match = openTagRegex.exec(segment)) !== null) {
      openStack.push(match[1]);
    }

    closeTagRegex.lastIndex = 0;
    while ((match = closeTagRegex.exec(segment)) !== null) {
      // Pop matching open tag
      const idx = openStack.lastIndexOf(match[1]);
      if (idx !== -1) {
        openStack.splice(idx, 1);
      }
    }

    // Build open tags for next line
    openTags = openStack.map((tag) => `<${tag}>`).join("");

    result.push(line);
  }

  // Close any remaining open tags on the last line
  if (openTags && result.length > 0) {
    const lastIdx = result.length - 1;
    const tags = openTags.match(/<(\w+)>/g);
    if (tags) {
      const closingTags = tags.reverse().map((t) => {
        const tagName = t.match(/<(\w+)>/)?.[1];
        return tagName ? `</${tagName}>` : "";
      }).join("");
      result[lastIdx] += closingTags;
    }
  }

  return result;
}
