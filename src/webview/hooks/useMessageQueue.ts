import { createSignal, onMount, onCleanup } from "solid-js";
import type { Agent } from "../types";
import type { ModelSelection } from "../utils/modelResolution";
import type { SelectionAttachment } from "./useAttachments";
import type { TiptapEditorMethods } from "../components/TiptapEditor";
import type { FilePartInput } from "@srdcloud/codefree-o-sdk/v2/client";
import { Id } from "../utils/id";
import { logger } from "../utils/logger";
import { useSync } from "../state/sync";
import { getSdkErrorMessage, getResponseStatus } from "./usePromptSend";

export interface QueuedMessage {
  id: string;
  text: string;
  agent: string | null;
  attachments: SelectionAttachment[];
}

// In-flight message tracking for the outbox
export interface InFlightMessage {
  messageID: string;
  sessionId: string;
}

export function useMessageQueue(deps: {
  sync: ReturnType<typeof useSync>;
  sendPrompt: (
    sessionId: string,
    text: string,
    agent?: string | null,
    extraParts?: FilePartInput[],
    messageID?: string,
    model?: { providerID: string; modelID: string } | null,
  ) => Promise<unknown>;
  selectedModel: () => ModelSelection | null;
  selectedAgent: () => string | null;
  agents: () => Agent[];
  input: () => string;
  setInput: (v: string) => void;
  clearDraftContent: (key: string) => void;
  sessionKey: () => string;
  editorMethods: () => TiptapEditorMethods | null;
  selectionAttachments: () => SelectionAttachment[];
  setSelectionAttachments: (v: SelectionAttachment[]) => void;
  setSelectionAttachmentsForKey: (key: string, v: SelectionAttachment[]) => void;
  buildSelectionParts: (attachments: SelectionAttachment[]) => FilePartInput[];
  setSelectedAgent: (agent: string | null) => void;
}): {
  messageQueue: () => QueuedMessage[];
  inFlightMessage: () => InFlightMessage | null;
  setInFlightMessage: (v: InFlightMessage | null) => void;
  setMessageQueue: (v: QueuedMessage[] | ((prev: QueuedMessage[]) => QueuedMessage[])) => void;
  processNextQueuedMessage: () => Promise<void>;
  handleQueueMessage: () => void;
  handleRemoveFromQueue: (id: string) => void;
  handleEditQueuedMessage: (id: string) => void;
} {
  const [messageQueue, setMessageQueue] = createSignal<QueuedMessage[]>([]);
  const [inFlightMessage, setInFlightMessage] = createSignal<InFlightMessage | null>(null);

  const processNextQueuedMessage = async () => {
    const queue = messageQueue();
    const inflight = inFlightMessage();
    const sessionId = deps.sync.currentSessionId();

    if (queue.length === 0) {
      return;
    }

    // Don't process if there's already an in-flight message
    if (inflight) {
      return;
    }

    if (!sessionId || !deps.sync.isReady()) {
      return;
    }

    const [next, ...rest] = queue;

    // Generate a FRESH messageID right before sending to ensure it's newer than the last assistant message
    // This is critical - IDs generated earlier (when queueing) will be older than assistant responses
    const messageID = Id.ascending("message");

    setMessageQueue(rest);
    deps.sync.setThinking(sessionId, true);

    // Track this queued message as in-flight using the fresh messageID
    setInFlightMessage({ messageID, sessionId });

    try {
      const extraParts = deps.buildSelectionParts(next.attachments);

      const result = await deps.sendPrompt(sessionId, next.text, next.agent, extraParts, messageID, deps.selectedModel());
      const responseStatus = getResponseStatus(result);

      // Check for SDK error in result (SDK doesn't throw by default)
      if (result && typeof result === "object" && "error" in result && (result as { error?: unknown }).error) {
        const errorMessage = getSdkErrorMessage((result as { error: unknown }).error);
        logger.error("queue sendPrompt returned error", {
          sessionId,
          messageID,
          responseStatus,
          errorMessage,
          error: (result as { error: unknown }).error,
        });
        deps.sync.setThinking(sessionId, false);
        setInFlightMessage(null);
        setMessageQueue([]);
        deps.sync.setSessionError(sessionId, errorMessage);
        return;
      }
    } catch (err) {
      logger.error("Queue sendPrompt failed:", { error: err });
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear queue + in-flight
      deps.sync.setThinking(sessionId, false);
      setInFlightMessage(null);
      setMessageQueue([]);
      deps.sync.setSessionError(sessionId, errorMessage);
    }
  };

  const handleQueueMessage = () => {
    const text = deps.input().trim();
    if (!text || !deps.sync.isReady()) return;

    const agent = deps.agents().some((a) => a.name === deps.selectedAgent())
      ? deps.selectedAgent()
      : null;
    const attachmentsKey = deps.sessionKey();
    const attachments = deps.selectionAttachments();

    // Queue the message without a messageID - we'll generate it fresh when sending
    const queuedMessage: QueuedMessage = {
      id: crypto.randomUUID(),
      text,
      agent,
      attachments,
    };

    setMessageQueue((prev) => [...prev, queuedMessage]);
    deps.setInput("");
    const editor = deps.editorMethods();
    if (editor) {
      editor.clear();
    }
    deps.clearDraftContent(deps.sessionKey());
    if (attachments.length > 0) {
      deps.setSelectionAttachmentsForKey(attachmentsKey, []);
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    setMessageQueue((prev) => prev.filter((m) => m.id !== id));
  };

  const handleEditQueuedMessage = (id: string) => {
    const queue = messageQueue();
    const index = queue.findIndex((m) => m.id === id);
    if (index === -1) return;

    const message = queue[index];
    // Remove this message and all after it
    setMessageQueue(queue.slice(0, index));
    // Update editor first so setInput captures the new JSON draft content.
    const editor = deps.editorMethods();
    if (editor) {
      editor.setContent(message.text);
    }
    // Put the message text in the input
    deps.setInput(message.text);
    deps.setSelectionAttachments(message.attachments);
    // Set the agent if different
    if (message.agent) {
      deps.setSelectedAgent(message.agent);
    }
  };

  // Clear inFlightMessage when session becomes idle and trigger queue drain
  onMount(() => {
    const cleanup = deps.sync.onSessionIdle((sessionId) => {
      const inflight = inFlightMessage();

      if (inflight?.sessionId !== sessionId) {
        return;
      }

      setInFlightMessage(null);

      // Schedule queue drain in a microtask to avoid interleaving with SSE batch
      queueMicrotask(() => {
        void processNextQueuedMessage();
      });
    });
    onCleanup(cleanup);
  });

  return {
    messageQueue,
    inFlightMessage,
    setInFlightMessage,
    setMessageQueue,
    processNextQueuedMessage,
    handleQueueMessage,
    handleRemoveFromQueue,
    handleEditQueuedMessage,
  };
}
