import { createSignal, Show } from "solid-js";
import type { Permission } from "../../shared/messages";
import { DiffViewer } from "./parts/DiffViewer";

interface PermissionPromptProps {
  permission: Permission;
  onResponse: (permissionId: string, response: "once" | "always" | "reject") => void;
  workspaceRoot?: string;
  autoAcceptEnabled?: boolean;
  onToggleAutoAccept?: () => void;
}

function normalizePath(input?: string, workspaceRoot?: string): string {
  if (!input) return "";
  
  // Basic path normalization for display
  const isAbsolute = input.startsWith("/") || /^[a-zA-Z]:/.test(input);
  
  // If we have a workspace root and the path is within it, show relative
  if (workspaceRoot && isAbsolute && input.startsWith(workspaceRoot)) {
    const relative = input.slice(workspaceRoot.length);
    return relative.startsWith("/") ? relative.slice(1) : relative;
  }
  
  // Show home directory as ~
  if (typeof window !== "undefined") {
    const homeMatch = input.match(/^\/Users\/[^/]+|^\/home\/[^/]+|^C:\\Users\\[^\\]+/);
    if (homeMatch) {
      return input.replace(homeMatch[0], "~");
    }
  }
  
  return input;
}

function extractDirectory(pattern?: string): string | undefined {
  if (!pattern) return undefined;
  
  // If pattern contains wildcards, extract the directory part
  if (pattern.includes("*")) {
    const lastSlash = Math.max(pattern.lastIndexOf("/"), pattern.lastIndexOf("\\"));
    if (lastSlash > 0) {
      return pattern.slice(0, lastSlash);
    }
  }
  
  return pattern;
}

export function PermissionPrompt(props: PermissionPromptProps) {
  const [diffExpanded, setDiffExpanded] = createSignal(false);

  const getPermissionMessage = () => {
    const type = props.permission.permission;
    const meta = props.permission.metadata || {};
    
    switch (type) {
      case "external_directory": {
        // Follow TUI's fallback chain: parentDir -> filepath -> dirname(patterns[0])
        const parent = meta.parentDir as string | undefined;
        const filepath = meta.filepath as string | undefined;
        const pattern = props.permission.patterns?.[0];
        const derived = extractDirectory(pattern);
        
        const rawDir = parent || filepath || derived || "unknown";
        const dir = normalizePath(rawDir, props.workspaceRoot);
        
        return `Allow access to ${dir}?`;
      }
      case "edit":
        return `Allow editing this file?`;
      case "read":
        return `Allow reading this file?`;
      case "bash":
        return `Allow running: ${(meta.command as string) || "this command"}?`;
      case "task":
        return `Allow delegating to a sub-agent?`;
      case "webfetch":
        return `Allow fetching from ${(meta.url as string) || "the web"}?`;
      case "websearch":
        return `Allow searching the web?`;
      case "glob":
      case "grep":
      case "list":
        return `Allow searching the codebase?`;
      case "doom_loop":
        return `Agent appears stuck in a loop. Allow continuing?`;
      default:
        return `Allow ${type}?`;
    }
  };

  const getFilePath = (): string | undefined => {
    const type = props.permission.permission;
    const meta = props.permission.metadata || {};
    if (type === "edit" || type === "read") {
      const filepath = meta.filepath as string | undefined;
      return filepath ? normalizePath(filepath, props.workspaceRoot) : undefined;
    }
    return undefined;
  };

  const getDiff = (): string | undefined => {
    const type = props.permission.permission;
    const meta = props.permission.metadata || {};
    if (type === "edit") {
      return meta.diff as string | undefined;
    }
    return undefined;
  };

  const handleResponse = (response: "once" | "always" | "reject") => {
    props.onResponse(props.permission.id, response);
  };

  return (
    <div class="permission-prompt" role="group" aria-label="Permission request">
      <div class="permission-prompt__content">
        <div class="permission-prompt__icon">⚠️</div>
        <div class="permission-prompt__message">
          {getPermissionMessage()}
        </div>
        <Show when={props.onToggleAutoAccept !== undefined}>
          <label class="permission-auto-accept" title="Auto-accept all permission requests">
            <input
              type="checkbox"
              class="permission-auto-accept__checkbox"
              checked={props.autoAcceptEnabled ?? false}
              onChange={() => props.onToggleAutoAccept?.()}
            />
            <span class="permission-auto-accept__toggle" />
            <span class="permission-auto-accept__label">Auto</span>
          </label>
        </Show>
      </div>
      <Show when={getFilePath()}>
        <div class="permission-prompt__filepath" title={getFilePath()}>
          {getFilePath()}
        </div>
      </Show>
      <Show when={getDiff()}>
        <div class="permission-diff-preview">
          <button
            class="permission-diff-preview__header"
            onClick={() => setDiffExpanded(!diffExpanded())}
            aria-expanded={diffExpanded()}
          >
            <svg
              class="permission-diff-preview__chevron"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ transform: diffExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            <span>Diff preview</span>
          </button>
          <Show when={diffExpanded()}>
            <div class="permission-diff-preview__content">
              <DiffViewer diff={getDiff()!} />
            </div>
          </Show>
        </div>
      </Show>
      <div class="permission-prompt__buttons">
        <button
          class="permission-button permission-button--quiet"
          onClick={() => handleResponse("reject")}
          aria-label="Reject"
        >
          reject
        </button>
        <div class="permission-spacer" />
        <button
          class="permission-button permission-button--quiet"
          onClick={() => handleResponse("always")}
          aria-label="Allow always"
        >
          always
        </button>
        <button
          class="permission-button permission-button--primary"
          onClick={() => handleResponse("once")}
          aria-label="Allow once"
        >
          once
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-left: 4px">
            <path d="M8.78 5.97a.75.75 0 0 0-1.06 0L4.47 9.22a.75.75 0 0 0 1.06 1.06L8 7.81l2.47 2.47a.75.75 0 1 0 1.06-1.06L8.78 5.97z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
