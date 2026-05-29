import type { Agent, Session } from "../types";
import type { ModelSelection } from "../utils/modelResolution";
import type { SelectionAttachment, ImageAttachment } from "./useAttachments";
import type { InFlightMessage } from "./useMessageQueue";
import type { CommandItem } from "../components/CommandPalette";
import type { TiptapEditorMethods } from "../components/TiptapEditor";
import type { FilePartInput } from "@srdcloud/codefree-o-sdk/v2/client";
import { useSync } from "../state/sync";
import { Id } from "../utils/id";
import { logger } from "../utils/logger";
import { extractFileMentionIds } from "../utils/editorContent";
import { parseFileMentionReference } from "../utils/fileMentionReference";

// ---------------------------------------------------------------------------
// Shared utility functions (previously duplicated in App.tsx & useMessageQueue)
// ---------------------------------------------------------------------------

export const getSdkErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error.length > 0) return error;
  if (!error || typeof error !== "object") return "Unknown error";

  const record = error as Record<string, unknown>;
  const topLevelMessage = record.message;
  if (typeof topLevelMessage === "string" && topLevelMessage.length > 0) {
    return topLevelMessage;
  }

  const data = record.data;
  if (data && typeof data === "object") {
    const dataMessage = (data as Record<string, unknown>).message;
    if (typeof dataMessage === "string" && dataMessage.length > 0) {
      return dataMessage;
    }
  }

  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object") {
    const nestedRecord = nestedError as Record<string, unknown>;
    const nestedMessage = nestedRecord.message;
    if (typeof nestedMessage === "string" && nestedMessage.length > 0) {
      return nestedMessage;
    }
    const nestedData = nestedRecord.data;
    if (nestedData && typeof nestedData === "object") {
      const nestedDataMessage = (nestedData as Record<string, unknown>).message;
      if (typeof nestedDataMessage === "string" && nestedDataMessage.length > 0) {
        return nestedDataMessage;
      }
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const getResponseStatus = (result: unknown): number | undefined => {
  if (!result || typeof result !== "object") return undefined;
  const response = (result as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : undefined;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePromptSend(deps: {
  sync: ReturnType<typeof useSync>;
  sendPrompt: (
    sessionId: string,
    text: string,
    agent?: string | null,
    extraParts?: FilePartInput[],
    messageID?: string,
    model?: { providerID: string; modelID: string } | null,
  ) => Promise<unknown>;
  sendCommand: (sessionId: string, command: string) => Promise<unknown>;
  revertToMessage: (sessionId: string, messageId: string) => Promise<unknown>;
  createSession: () => Promise<unknown> | undefined;
  selectedModel: () => ModelSelection | null;
  selectedAgent: () => string | null;
  agents: () => Agent[];
  input: () => string;
  setInput: (v: string) => void;
  clearDraftContent: (key: string) => void;
  sessionKey: () => string;
  editorMethods: () => TiptapEditorMethods | null;
  selectionAttachments: () => SelectionAttachment[];
  setSelectionAttachmentsForKey: (key: string, v: SelectionAttachment[]) => void;
  imageAttachments: () => ImageAttachment[];
  setImageAttachmentsBySession: (fn: (prev: Map<string, ImageAttachment[]>) => Map<string, ImageAttachment[]>) => void;
  buildSelectionParts: (attachments: SelectionAttachment[]) => FilePartInput[];
  buildImageParts: (images: ImageAttachment[]) => FilePartInput[];
  buildWorkspaceFileUrl: (root: string, filePath: string) => string;
  setInFlightMessage: (v: InFlightMessage | null) => void;
  editingMessageId: () => string | null;
  setEditingMessageId: (v: string | null) => void;
  setEditingText: (v: string) => void;
}): {
  handleSubmit: () => Promise<void>;
  handleCommandSelect: (command: CommandItem) => Promise<void>;
  handleSubmitEdit: (newText: string) => Promise<void>;
} {
  const handleSubmit = async () => {
    const text = deps.input().trim();
    if (!text || !deps.sync.isReady()) {
      return;
    }

    const agent = deps.agents().some((a) => a.name === deps.selectedAgent())
      ? deps.selectedAgent()
      : null;
    const attachmentsKey = deps.sessionKey();
    let attachments = deps.selectionAttachments();

    // Extract mentions from editor and add to attachments
    const methods = deps.editorMethods();
    if (methods) {
      try {
        const editorJSON = methods.getJSON();
        const mentionedFiles = extractFileMentionIds(editorJSON);
        const workspaceRoot = deps.sync.workspaceRoot();
        if (!workspaceRoot) {
          throw new Error("workspace root unavailable while extracting mentions");
        }

        // Convert mention references to SelectionAttachment objects
        const mentionAttachments: SelectionAttachment[] = mentionedFiles
          .map((mentionReference) => {
            const parsedMention = parseFileMentionReference(mentionReference);
            if (!parsedMention.filePath) return null;
            const attachment: SelectionAttachment = {
              id: `mention-${mentionReference}`,
              filePath: parsedMention.filePath,
              fileUrl: deps.buildWorkspaceFileUrl(workspaceRoot, parsedMention.filePath),
            };
            if (parsedMention.startLine !== undefined) attachment.startLine = parsedMention.startLine;
            if (parsedMention.endLine !== undefined) attachment.endLine = parsedMention.endLine;
            return attachment;
          })
          .filter((attachment): attachment is SelectionAttachment => attachment !== null);

        // Merge with existing attachments (avoid exact duplicates)
        const attachmentKey = (attachment: SelectionAttachment) =>
          `${attachment.filePath}:${attachment.startLine ?? ""}:${attachment.endLine ?? ""}`;
        const existingKeys = new Set(attachments.map(attachmentKey));
        const newAttachments = mentionAttachments.filter(
          (attachment) => !existingKeys.has(attachmentKey(attachment))
        );
        attachments = [...attachments, ...newAttachments];
      } catch (err) {
        logger.error("Failed to extract mentions", { error: err });
      }
    }

    const extraParts = deps.buildSelectionParts(attachments);
    const currentImages = deps.imageAttachments();
    const imageParts = deps.buildImageParts(currentImages);
    const allExtraParts = [...extraParts, ...imageParts];

    // Generate sortable client-side messageID for idempotent sends
    const messageID = Id.ascending("message");

    // Ensure we have a session
    let sessionId = deps.sync.currentSessionId();
    if (!sessionId) {
      try {
        const res = await deps.createSession();
        const newSession = (res as { data?: Session } | undefined)?.data as Session | undefined;
        if (!newSession?.id) {
          return;
        }
        sessionId = newSession.id;
        deps.sync.setCurrentSessionId(sessionId);
      } catch (err) {
        logger.error("Failed to create session:", { error: err });
        return;
      }
    }

    // Clear both text and JSON content
    deps.setInput("");
    if (methods) {
      methods.clear();
    }
    deps.clearDraftContent(deps.sessionKey());
    deps.sync.setThinking(sessionId, true);

    // Track this message as in-flight
    deps.setInFlightMessage({ messageID, sessionId });

    logger.info("Sending prompt", { sessionId, messageID, textLen: text.length });

    try {
      const result = await deps.sendPrompt(sessionId, text, agent, allExtraParts, messageID, deps.selectedModel());

      // Log the full result for debugging
      const responseStatus = getResponseStatus(result);
      const resultAsObj = result as Record<string, unknown> | null | undefined;
      logger.info("sendPrompt result", {
        hasError: !!resultAsObj?.error,
        hasData: !!resultAsObj?.data,
        responseStatus,
      });

      // Check for SDK error in result (SDK doesn't throw by default)
      if (resultAsObj?.error) {
        const errorMessage = getSdkErrorMessage(resultAsObj.error);

        // Log full error structure for debugging
        logger.error("sendPrompt returned error", {
          sessionId,
          messageID,
          responseStatus,
          errorMessage,
          error: resultAsObj.error,
          response: resultAsObj?.response,
        });

        deps.sync.setThinking(sessionId, false);
        deps.setInFlightMessage(null);
        deps.sync.setSessionError(sessionId, errorMessage);
        return;
      }

      if (attachments.length > 0) {
        deps.setSelectionAttachmentsForKey(attachmentsKey, []);
      }
      if (currentImages.length > 0) {
        deps.setImageAttachmentsBySession((prev) => {
          const next = new Map(prev);
          next.delete(attachmentsKey);
          return next;
        });
      }
    } catch (err) {
      logger.error("sendPrompt exception", { error: String(err), stack: (err as Error).stack });
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear in-flight
      deps.sync.setThinking(sessionId, false);
      deps.setInFlightMessage(null);
      deps.sync.setSessionError(sessionId, errorMessage);
    }
  };

  const handleCommandSelect = async (command: CommandItem) => {
    let sessionId = deps.sync.currentSessionId();
    if (!sessionId) {
      try {
        const res = await deps.createSession();
        const newSession = (res as { data?: Session } | undefined)?.data as Session | undefined;
        if (!newSession?.id) return;
        sessionId = newSession.id;
        deps.sync.setCurrentSessionId(sessionId);
      } catch (err) {
        logger.error("Failed to create session for command:", { error: err });
        return;
      }
    }

    // Clear editor
    deps.setInput("");
    const editor = deps.editorMethods();
    if (editor) editor.clear();
    deps.clearDraftContent(deps.sessionKey());
    deps.sync.setThinking(sessionId, true);

    try {
      const result = await deps.sendCommand(sessionId, command.name);
      const resultAsObj = result as Record<string, unknown> | null | undefined;
      if (resultAsObj?.error) {
        const errorMessage = getSdkErrorMessage(resultAsObj.error);
        deps.sync.setThinking(sessionId, false);
        deps.sync.setSessionError(sessionId, errorMessage);
      }
    } catch (err) {
      deps.sync.setThinking(sessionId, false);
      deps.sync.setSessionError(sessionId, (err as Error).message);
    }
  };

  const handleSubmitEdit = async (newText: string) => {
    const messageId = deps.editingMessageId();
    const sessionId = deps.sync.currentSessionId();
    if (!messageId || !sessionId || !newText.trim() || !deps.sync.isReady()) return;

    const agent = deps.agents().some((a) => a.name === deps.selectedAgent())
      ? deps.selectedAgent()
      : null;

    // Generate sortable client-side messageID for the new prompt
    const newMessageID = Id.ascending("message");

    deps.sync.setThinking(sessionId, true);
    deps.setEditingMessageId(null);
    deps.setEditingText("");

    // Track this as in-flight
    deps.setInFlightMessage({ messageID: newMessageID, sessionId });

    try {
      await deps.revertToMessage(sessionId, messageId);
      const result = await deps.sendPrompt(sessionId, newText.trim(), agent, [], newMessageID, deps.selectedModel());
      const responseStatus = getResponseStatus(result);
      const resultAsObj = result as Record<string, unknown> | null | undefined;

      // Check for SDK error in result (SDK doesn't throw by default)
      if (resultAsObj?.error) {
        const errorMessage = getSdkErrorMessage(resultAsObj.error);
        logger.error("edit sendPrompt returned error", {
          sessionId,
          messageId,
          newMessageID,
          responseStatus,
          errorMessage,
          error: resultAsObj.error,
        });
        deps.sync.setThinking(sessionId, false);
        deps.setInFlightMessage(null);
        deps.sync.setSessionError(sessionId, `Error editing message: ${errorMessage}`);
        return;
      }
    } catch (err) {
      logger.error("Failed to edit message:", { error: err });
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear in-flight
      deps.sync.setThinking(sessionId, false);
      deps.setInFlightMessage(null);
      deps.sync.setSessionError(sessionId, `Error editing message: ${errorMessage}`);
    }
  };

  return {
    handleSubmit,
    handleCommandSelect,
    handleSubmitEdit,
  };
}
