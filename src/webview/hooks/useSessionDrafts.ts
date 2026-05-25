import { createSignal, createEffect } from "solid-js";
import type { TiptapEditorMethods } from "../components/TiptapEditor";
import { logger } from "../utils/logger";

export const NEW_SESSION_KEY = "__new__";

export function useSessionDrafts(
  currentSessionId: () => string | null,
  editorMethods: () => TiptapEditorMethods | null,
): {
  sessionKey: () => string;
  input: () => string;
  setInput: (value: string) => void;
  clearDraftContent: (key: string) => void;
} {
  const [drafts, setDrafts] = createSignal<Map<string, string>>(new Map());
  const [draftContents, setDraftContents] = createSignal<Map<string, any>>(new Map()); // TipTap JSON content

  const sessionKey = () => currentSessionId() || NEW_SESSION_KEY;

  const input = () => drafts().get(sessionKey()) || "";

  const setInput = (value: string) => {
    const key = sessionKey();
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });

    // Also save the editor JSON content when available
    const methods = editorMethods();
    if (methods) {
      try {
        const json = methods.getJSON();
        setDraftContents((prev) => {
          const next = new Map(prev);
          next.set(key, json);
          return next;
        });
      } catch (err) {
        // Editor might not be ready yet
      }
    }
  };

  const clearDraftContent = (key: string) => {
    setDraftContents((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  // Restore editor content when session changes
  createEffect(() => {
    const key = sessionKey();
    const savedContent = draftContents().get(key);

    const methods = editorMethods();
    if (methods && savedContent) {
      try {
        methods.setContent(savedContent);
      } catch (err) {
        logger.error("Failed to restore editor content", { error: err });
      }
    }
  });

  return { sessionKey, input, setInput, clearDraftContent };
}
