import type { JSONContent } from "@tiptap/core";
import type { MentionRef, MentionKind } from "./mention";
import { getMentionKind } from "./mention";

/**
 * Extract structured mention references from a Tiptap editor JSON document.
 *
 * Returns MentionRef[] with kind discrimination based on the id prefix:
 *   - "agent:..." → kind: "agent"
 *   - "skill:..." → kind: "skill"
 *   - everything else → kind: "file" (backward compat)
 */
export function extractMentions(json: JSONContent): MentionRef[] {
  const mentions: MentionRef[] = [];

  function walk(node: JSONContent) {
    if ((node.type === "mention" || node.type === "fileMention") && node.attrs?.id) {
      const id = node.attrs.id as string;
      mentions.push({
        id,
        kind: getMentionKind(id),
        nodeType: node.type as "mention" | "fileMention",
        label: node.attrs.label as string | undefined,
      });
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json);
  return mentions;
}

/**
 * Legacy helper: extract mention ids as plain strings.
 *
 * Maintains backward compatibility with code that expects string[].
 */
export function extractMentionIds(json: JSONContent): string[] {
  return extractMentions(json).map((ref) => ref.id);
}

/**
 * Extract only file mention ids (kind === "file") as plain strings.
 *
 * Use this in the send path to avoid passing agent/skill ids to
 * parseFileMentionReference(), which only handles file paths.
 */
export function extractFileMentionIds(json: JSONContent): string[] {
  return extractMentions(json)
    .filter((ref) => ref.kind === "file")
    .map((ref) => ref.id);
}
