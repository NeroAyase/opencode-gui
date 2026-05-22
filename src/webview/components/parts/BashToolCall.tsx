import { Show, createSignal, onMount, onCleanup, type Accessor } from "solid-js";
import type { MessagePart, Permission, ToolState } from "../../types";
import { ToolCallTemplate } from "./ToolCallTemplate";
import { TerminalIcon } from "./ToolCallIcons";
import { getToolInputs, usePermission, ErrorFooter } from "./ToolCallHelpers";
import { highlightCode, detectLanguage } from "../../utils/shiki";
import { vscode } from "../../utils/vscode";

interface BashToolCallProps {
  part: MessagePart;
  workspaceRoot?: string;
  pendingPermissions?: Accessor<Map<string, Permission>>;
  onPermissionResponse?: (
    permissionId: string,
    response: "once" | "always" | "reject",
  ) => void;
}

/**
 * Heuristic: does the output look like code worth highlighting?
 * Multi-line output with common code patterns is highlighted.
 */
function looksLikeCode(text: string | undefined): boolean {
  if (!text) return false;
  const lines = text.split("\n");
  if (lines.length < 3) return false;

  // Check for common code patterns
  const codeIndicators = [
    /import\s/,           // import statements
    /function\s/,         // function declarations
    /const\s+\w+\s*=/,   // const assignments
    /let\s+\w+\s*=/,     // let assignments
    /class\s+\w+/,        // class declarations
    /def\s+\w+/,          // Python functions
    /fn\s+\w+/,           // Rust functions
    /^\s*\{/,             // JSON-like objects
    /^\s*\[/,             // Arrays
    /^\s*<\/?\w+/,        // HTML/XML tags
    /->\s*$/,             // Type annotations
    /^\s*\d{4}-\d{2}-\d{2}/, // ISO dates (logs)
  ];

  let matchCount = 0;
  for (const line of lines) {
    for (const pattern of codeIndicators) {
      if (pattern.test(line)) {
        matchCount++;
        break;
      }
    }
  }

  // If more than 30% of lines match code patterns, highlight
  return matchCount / lines.length > 0.3;
}

export function BashToolCall(props: BashToolCallProps) {
  // IMPORTANT: don't memoize raw objects from the store.
  // Returning the object from createMemo prevents downstream tracking of nested keys
  // (e.g. state.input.command) when reconcile mutates in place. Use accessors.
  const state = () => props.part.state as ToolState;
  const inputs = () => getToolInputs(state(), props.part);

  const permission = usePermission(props.part, () =>
    props.pendingPermissions?.(),
  );

  // Show the actual bash command (e.g., "ls -la"), not the AI-generated description
  const command = () => inputs().command as string | undefined;

  // Highlighted command
  const [highlightedCmd, setHighlightedCmd] = createSignal<string | null>(null);
  let cmdCancelled = false;

  onMount(() => {
    if (command()) {
      highlightCode(command()!, "bash").then((html) => {
        if (!cmdCancelled) setHighlightedCmd(html);
      });
    }
  });

  onCleanup(() => {
    cmdCancelled = true;
  });

  const Header = () => {
    return (
      <span class="tool-header-text">
        <Show
          when={highlightedCmd()}
          fallback={
            <span
              class="tool-text tool-text--bash"
              style={{ "font-family": "monospace" }}
            >
              {command() || "Running command"}
            </span>
          }
        >
          <span
            class="tool-text tool-text--bash tool-text--highlighted"
            style={{ "font-family": "monospace" }}
            innerHTML={highlightedCmd()!}
          />
        </Show>
        <button
          class="tool-action-button terminal-button"
          onClick={(e) => {
            e.stopPropagation();
            vscode.postMessage({
              type: "open-terminal",
              command: command(),
              ...(props.workspaceRoot ? { cwd: props.workspaceRoot } : {}),
            });
          }}
          title="Open in terminal"
        >
          ⌨
        </button>
      </span>
    );
  };

  // Highlighted output
  const [highlightedOutput, setHighlightedOutput] = createSignal<string | null>(null);
  let outputCancelled = false;

  onMount(() => {
    const output = state().output;
    if (output && looksLikeCode(output)) {
      const lang = detectLanguage(output);
      highlightCode(output, lang).then((html) => {
        if (!outputCancelled) setHighlightedOutput(html);
      });
    }
  });

  onCleanup(() => {
    outputCancelled = true;
  });

  const Output = () => (
    <Show
      when={highlightedOutput()}
      fallback={
        <pre class="tool-output tool-output--bash">{state().output}</pre>
      }
    >
      <div
        class="tool-output tool-output--bash tool-output--highlighted"
        innerHTML={highlightedOutput()!}
      />
    </Show>
  );

  return (
    <ToolCallTemplate
      icon={TerminalIcon}
      header={Header}
      output={state().output ? Output : undefined}
      footer={state().error ? () => <ErrorFooter error={state().error} /> : undefined}
      defaultOpen={true}
      isPending={props.part.state?.status === "pending"}
      needsPermission={!!permission()}
      permission={permission()}
      onPermissionResponse={(response) => {
        const perm = permission();
        if (perm?.id && props.onPermissionResponse) {
          props.onPermissionResponse(perm.id, response);
        }
      }}
    />
  );
}
