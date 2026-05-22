
import { Show, createSignal, onMount, onCleanup, type JSX } from "solid-js";
import type { MessagePart } from "../../types";
import { Streamdown, type Components } from "../../lib/streamdown";
import { messageMarkdownComponents } from "../markdownComponents";
import { highlightCode, getHighlighter } from "../../utils/shiki";

interface TextBlockProps {
  part: MessagePart;
  isStreaming?: boolean;
}

/**
 * Shiki-powered code block component.
 * Renders plain code first, then upgrades to syntax-highlighted HTML
 * once the Shiki highlighter is loaded asynchronously.
 */
function ShikiCodeBlock(props: {
  children?: JSX.Element;
  class?: string;
  node?: { properties?: { className?: string[] | string } };
}) {
  const codeText = extractTextContent(props.children);
  const lang = extractLangFromClass(props.node?.properties?.className);

  const [highlighted, setHighlighted] = createSignal<string | null>(null);
  const [containerRef, setContainerRef] = createSignal<HTMLPreElement | null>(null);

  let cancelled = false;

  onMount(() => {
    // Only highlight in static mode (not streaming) to avoid flicker
    highlightCode(codeText, lang).then((html) => {
      if (!cancelled) {
        setHighlighted(html);
      }
    });
  });

  onCleanup(() => {
    cancelled = true;
  });

  return (
    <Show
      when={highlighted()}
      fallback={
        <pre class={props.class}>
          <code class={Array.isArray(props.node?.properties?.className) ? (props.node!.properties!.className as string[]).join(" ") : (props.node?.properties?.className as string | undefined)}>{codeText}</code>
        </pre>
      }
    >
      {(html) => (
        <div
          ref={setContainerRef}
          class="code-block"
          innerHTML={html()}
        />
      )}
    </Show>
  );
}

/** Extract plain text from Solid JSX children (may be string, array, or nested) */
function extractTextContent(children: JSX.Element | undefined): string {
  if (children === undefined || children === null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  // Solid reactive wrappers or DOM nodes — best effort
  if (children instanceof Node) return (children as Element).textContent ?? "";
  return String(children);
}

/** Extract language from className like "language-typescript" */
function extractLangFromClass(className: string[] | string | undefined): string | undefined {
  if (!className) return undefined;
  const classes = Array.isArray(className) ? className : [className];
  const langClass = classes.find((c) => c.startsWith("language-"));
  return langClass?.replace("language-", "");
}

// Merge Shiki code block override with existing markdown components
const textBlockComponents: Components = {
  ...messageMarkdownComponents,
  pre: (props) => {
    // Extract the code element's language from the pre's children
    // The hast tree gives us: pre > code.language-xxx
    const node = (props as JSX.IntrinsicElements["pre"] & { node?: { children?: Array<{ properties?: { className?: string[] | string } }> } }).node;
    const codeChild = node?.children?.find((c) => {
      return "tagName" in c && c.tagName === "code";
    });
    const codeNode = codeChild as { properties?: { className?: string[] | string } } | undefined;

    return (
      <ShikiCodeBlock
        class={props.class as string | undefined}
        node={codeNode}
      >
        {props.children}
      </ShikiCodeBlock>
    );
  },
};

export function TextBlock(props: TextBlockProps) {
  return (
    <Show when={props.part.text}>
      <Streamdown 
        mode={props.isStreaming ? "streaming" : "static"}
        components={textBlockComponents}
        class="message-text"
      >
        {props.part.text!}
      </Streamdown>
    </Show>
  );
}
