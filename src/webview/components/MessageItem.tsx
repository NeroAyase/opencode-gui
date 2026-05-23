
import { For, Show, createMemo, type Accessor } from "solid-js";
import type { Message, Permission, MessagePart } from "../types";
import { MessagePartRenderer } from "./MessagePartRenderer";
import { isRenderablePart } from "./MessagePartRenderer";
import { Streamdown } from "../lib/streamdown";
import { vscode } from "../utils/vscode";
import { useSync } from "../state/sync";
import { messageMarkdownComponents } from "./markdownComponents";

interface MessageItemProps {
  message: Message;
  parts: MessagePart[];
  workspaceRoot?: string;
  pendingPermissions?: Accessor<Map<string, Permission>>;
  onPermissionResponse?: (permissionId: string, response: "once" | "always" | "reject") => void;
  isStreaming?: boolean;
}

export function MessageItem(props: MessageItemProps) {
  const sync = useSync();
  // TUI pattern: parts are passed as prop, already reactive
  const isUser = () => props.message.type === "user";
  const hasAnyParts = () => props.parts.length > 0;
  const renderableParts = createMemo(() => props.parts.filter(isRenderablePart));
  const hasRenderableParts = () => renderableParts().length > 0;
  
  // Derive user message text from parts (text parts only, excluding synthetic/ignored)
  const userText = createMemo(() => {
    if (!isUser()) return props.message.text ?? "";
    // Prefer message.text if set, otherwise derive from parts
    if (props.message.text) return props.message.text;
    return props.parts
      .filter(
        (p) =>
          p?.type === "text" &&
          typeof p.text === "string" &&
          !(p as { synthetic?: boolean }).synthetic &&
          !(p as { ignored?: boolean }).ignored
      )
      .map((p) => p.text as string)
      .join("\n");
  });
  
  const userAttachments = createMemo(() => {
    return props.parts
      .filter((part) => part.type === "file")
      .map((part) => {
        const filePart = part as MessagePart & { url?: string; filename?: string };
        const url = filePart.url || "";
        let filename = filePart.filename || "";
        let start: number | undefined;
        let end: number | undefined;

        if (url) {
          try {
            const parsed = new URL(url);
            const startRaw = parsed.searchParams.get("start");
            const endRaw = parsed.searchParams.get("end");
            start = startRaw ? Number(startRaw) : undefined;
            end = endRaw ? Number(endRaw) : undefined;
            if (!filename && parsed.pathname) {
              const pathname = decodeURIComponent(parsed.pathname);
              const parts = pathname.split("/");
              filename = parts[parts.length - 1] || pathname;
            }
          } catch {
            // Ignore non-file URLs
          }
        }

        const labelBase = filename || url || "attachment";
        const label =
          Number.isFinite(start) && start !== undefined
            ? `${labelBase} L${start}${Number.isFinite(end) && end !== start ? `-${end}` : ""}`
            : labelBase;

        return {
          id: filePart.id || `${url}-${label}`,
          label,
          title: filename ? labelBase : url,
          url,
          startLine: Number.isFinite(start) ? start : undefined,
          endLine: Number.isFinite(end) ? end : undefined,
        };
      });
  });

  const assistantText = createMemo(() => (props.message.text ?? "").trim());
  const shouldRenderAssistantMessage = createMemo(
    () => isUser() || hasAnyParts() || assistantText().length > 0
  );

  return (
    <Show when={shouldRenderAssistantMessage()}>
      <div class={`message message--${props.message.type}`} role="article" aria-label={`${props.message.type} message`}>
        <div class="message-content">
          <Show when={isUser()}>
            <Show when={userAttachments().length > 0}>
              <div class="message-attachments">
                <For each={userAttachments()}>
                  {(attachment) => (
                    <button
                      type="button"
                      class="file-chip message-attachment"
                      title={attachment.title ?? attachment.label}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!attachment.url) return;
                        vscode.postMessage({
                          type: "open-file",
                          url: attachment.url,
                          startLine: attachment.startLine,
                          endLine: attachment.endLine,
                        });
                      }}
                    >
                      <span class="message-attachment__text">{attachment.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <Show when={userText()}>
              <div class="message-text user-message-text">{userText()}</div>
            </Show>
          </Show>
          <Show
            when={!isUser()}
            fallback={null}
          >
            <Show 
              when={hasRenderableParts()} 
              fallback={
                <Show when={props.message.text}>
                  <Streamdown
                    mode={props.isStreaming ? "streaming" : "static"}
                    components={messageMarkdownComponents}
                    class="message-text"
                  >
                    {props.message.text!}
                  </Streamdown>
                </Show>
              }
            >
              <For each={renderableParts()}>
                {(part) => <MessagePartRenderer part={part} workspaceRoot={props.workspaceRoot} pendingPermissions={props.pendingPermissions} onPermissionResponse={props.onPermissionResponse} isStreaming={props.isStreaming} />}
              </For>
            </Show>
            <Show when={!props.isStreaming}>
              <div class="message-actions">
                <button
                  type="button"
                  class="message-action-button"
                  title="Copy message"
                  onClick={() => {
                    const text = props.message.text ?? "";
                    if (text) {
                      vscode.postMessage({
                        type: "copy-text",
                        text,
                      });
                    }
                  }}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                </button>
                <button
                  type="button"
                  class="message-action-button"
                  title="Fork from this message"
                  onClick={() => {
                    const sessionId = sync.currentSessionId();
                    if (!sessionId) return;
                    vscode.postMessage({
                      type: "session-fork",
                      sessionID: sessionId,
                      messageID: props.message.id,
                    });
                  }}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M5 5.374v.876l.224.224A2.5 2.5 0 0 1 5 7.5 2.5 2.5 0 0 1 2.5 5 2.5 2.5 0 0 1 5 2.5a2.5 2.5 0 0 1 2.376 1.724L7.5 4.374h.876A2.5 2.5 0 0 1 10.5 2.5 2.5 2.5 0 0 1 13 5a2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-1.724-.624L8.626 7.1v1.8l.15.224A2.5 2.5 0 0 1 10.5 8.5 2.5 2.5 0 0 1 13 11a2.5 2.5 0 0 1-2.5 2.5A2.5 2.5 0 0 1 8 11a2.5 2.5 0 0 1 .624-1.724L8.5 9.1V7l-.124-.224A2.5 2.5 0 0 1 7.5 7h-.876l-.224.224A2.5 2.5 0 0 1 5 10.5 2.5 2.5 0 0 1 2.5 8 2.5 2.5 0 0 1 5 5.374z"/></svg>
                </button>
                <button
                  type="button"
                  class="message-action-button"
                  title="Revert to this message"
                  onClick={() => {
                    const sessionId = sync.currentSessionId();
                    if (!sessionId) return;
                    vscode.postMessage({
                      type: "session-revert",
                      sessionID: sessionId,
                      messageID: props.message.id,
                    });
                  }}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  );
}
