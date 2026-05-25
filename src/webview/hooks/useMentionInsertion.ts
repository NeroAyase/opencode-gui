import { createSignal } from "solid-js";
import type { TiptapEditorMethods } from "../components/TiptapEditor";
import { logger } from "../utils/logger";
import { extractMentions } from "../utils/editorContent";
import { encodeFileMentionReference } from "../utils/fileMentionReference";

export interface FileMentionInsertRequest {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export function useMentionInsertion(): {
  handleEditorMethodsReady: (methods: TiptapEditorMethods) => void;
  insertMentionOrQueue: (request: FileMentionInsertRequest) => void;
  focusEditorOrQueue: () => void;
  normalizeSelectionRange: (startLine?: number, endLine?: number) => { startLine?: number; endLine?: number };
  editorMethods: () => TiptapEditorMethods | null;
} {
  // Host selections received before editor methods are available
  const [pendingMentionInsertions, setPendingMentionInsertions] = createSignal<FileMentionInsertRequest[]>([]);
  const [pendingEditorFocus, setPendingEditorFocus] = createSignal(false);

  // Editor methods for managing content
  let editorMethods: TiptapEditorMethods | null = null;

  const normalizeSelectionRange = (startLine?: number, endLine?: number) => {
    if (startLine === undefined && endLine === undefined) return {};
    if (startLine === undefined || endLine === undefined) {
      const line = startLine ?? endLine;
      return { startLine: line, endLine: line };
    }
    return {
      startLine: Math.min(startLine, endLine),
      endLine: Math.max(startLine, endLine),
    };
  };

  const mentionInsertionKey = (request: FileMentionInsertRequest) =>
    encodeFileMentionReference({
      filePath: request.filePath,
      startLine: request.startLine,
      endLine: request.endLine,
    });

  const insertMentionFromHostSelection = (request: FileMentionInsertRequest): boolean => {
    if (!editorMethods) {
      return false;
    }

    try {
      const existingMentions = new Set(extractMentions(editorMethods.getJSON()));
      const requestKey = mentionInsertionKey(request);
      if (!existingMentions.has(requestKey)) {
        editorMethods.insertFileMention(request.filePath, request.startLine, request.endLine);
      }
      return true;
    } catch (err) {
      logger.error("Failed to insert file mention from editor selection", {
        error: err,
        filePath: request.filePath,
        startLine: request.startLine,
        endLine: request.endLine,
      });
      return false;
    }
  };

  const queueMentionInsertion = (request: FileMentionInsertRequest) => {
    const requestKey = mentionInsertionKey(request);
    setPendingMentionInsertions((prev) => {
      if (prev.some((item) => mentionInsertionKey(item) === requestKey)) {
        return prev;
      }
      return [...prev, request];
    });
  };

  const flushPendingMentionInsertions = () => {
    if (!editorMethods) return;
    const pending = pendingMentionInsertions();
    if (pending.length === 0) return;

    const failed: FileMentionInsertRequest[] = [];
    for (const request of pending) {
      if (!insertMentionFromHostSelection(request)) {
        failed.push(request);
      }
    }
    setPendingMentionInsertions(failed);
  };

  const focusEditorOrQueue = () => {
    if (!editorMethods) {
      setPendingEditorFocus(true);
      return;
    }
    editorMethods.focus();
    setPendingEditorFocus(false);
  };

  const handleEditorMethodsReady = (methods: TiptapEditorMethods) => {
    editorMethods = methods;
    if (pendingEditorFocus()) {
      editorMethods.focus();
      setPendingEditorFocus(false);
    }
    flushPendingMentionInsertions();
  };

  const insertMentionOrQueue = (request: FileMentionInsertRequest) => {
    if (insertMentionFromHostSelection(request)) {
      return;
    }
    queueMentionInsertion(request);
  };

  return {
    handleEditorMethodsReady,
    insertMentionOrQueue,
    focusEditorOrQueue,
    normalizeSelectionRange,
    editorMethods: () => editorMethods,
  };
}
