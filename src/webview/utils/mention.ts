/**
 * Foundation types for @-mention expansion (Tier 3.2).
 *
 * Mention ID encoding:
 *   - File mentions: unprefixed path (backward compat), e.g. "src/App.tsx#L5-8"
 *   - Agent mentions: "agent:<name>", e.g. "agent:build"
 *   - Skill mentions: "skill:<name>", e.g. "skill:review-work"
 */

// ---------------------------------------------------------------------------
// Mention Kind
// ---------------------------------------------------------------------------

export type MentionKind = "file" | "agent" | "skill";

// ---------------------------------------------------------------------------
// Mention Item (for dropdown / autocomplete data)
// ---------------------------------------------------------------------------

interface BaseMentionItem {
  kind: MentionKind;
  id: string;
  label: string;
  description?: string;
}

export interface FileMentionItem extends BaseMentionItem {
  kind: "file";
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface AgentMentionItem extends BaseMentionItem {
  kind: "agent";
  agentName: string;
  mode: "subagent" | "primary" | "all";
}

export interface SkillMentionItem extends BaseMentionItem {
  kind: "skill";
  skillName: string;
  location?: string;
}

export type MentionItem = FileMentionItem | AgentMentionItem | SkillMentionItem;

// ---------------------------------------------------------------------------
// Mention Ref (extracted from editor JSON, lightweight)
// ---------------------------------------------------------------------------

export interface MentionRef {
  /** The raw id attribute from the Tiptap mention node */
  id: string;
  /** Discriminated kind derived from the id prefix */
  kind: MentionKind;
  /** The Tiptap node type ("mention" or "fileMention") */
  nodeType: "mention" | "fileMention";
  /** The label attribute from the Tiptap mention node, if present */
  label?: string;
}

// ---------------------------------------------------------------------------
// ID Encoding / Decoding
// ---------------------------------------------------------------------------

const AGENT_PREFIX = "agent:";
const SKILL_PREFIX = "skill:";

/**
 * Determine the mention kind from a raw mention id.
 *
 * - IDs starting with "agent:" → "agent"
 * - IDs starting with "skill:" → "skill"
 * - Everything else → "file" (backward compat: file paths are unprefixed)
 */
export function getMentionKind(id: string): MentionKind {
  if (id.startsWith(AGENT_PREFIX)) return "agent";
  if (id.startsWith(SKILL_PREFIX)) return "skill";
  return "file";
}

/**
 * Parse a mention id into its kind and the kind-specific value.
 *
 * Returns:
 *   - { kind: "file", value: "src/App.tsx#L5-8" } for file mentions
 *   - { kind: "agent", value: "build" } for "agent:build"
 *   - { kind: "skill", value: "review-work" } for "skill:review-work"
 */
export function parseMentionId(id: string): { kind: MentionKind; value: string } {
  const kind = getMentionKind(id);
  switch (kind) {
    case "agent":
      return { kind, value: id.slice(AGENT_PREFIX.length) };
    case "skill":
      return { kind, value: id.slice(SKILL_PREFIX.length) };
    case "file":
      return { kind, value: id };
  }
}

/**
 * Format a mention id from its kind and value.
 *
 * Inverse of parseMentionId: formatMentionId(parseMentionId(id)) === id
 */
export function formatMentionId(kind: MentionKind, value: string): string {
  switch (kind) {
    case "agent":
      return `${AGENT_PREFIX}${value}`;
    case "skill":
      return `${SKILL_PREFIX}${value}`;
    case "file":
      return value;
  }
}
