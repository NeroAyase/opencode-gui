/**
 * Pure filter functions for @-mention search (Tier 3.2 Phase 2).
 *
 * These are extracted from the ViewProvider for testability.
 * The ViewProvider calls these after fetching raw data from the SDK.
 */

// System agents that should be hidden from @-mention results
// (same list as bootstrap.ts HIDDEN_AGENTS)
const HIDDEN_AGENTS = new Set(["compaction", "title", "summary"]);

const MAX_RESULTS = 20;

// ---------------------------------------------------------------------------
// Input types (match SDK return shapes)
// ---------------------------------------------------------------------------

export interface AgentSearchInput {
  name: string;
  description?: string;
  mode: string;
  hidden?: boolean;
}

export interface SkillSearchInput {
  name: string;
  description?: string;
  location?: string;
}

// ---------------------------------------------------------------------------
// Output types (for webview consumption)
// ---------------------------------------------------------------------------

export interface AgentSearchResult {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
}

export interface SkillSearchResult {
  name: string;
  description?: string;
  location?: string;
}

// ---------------------------------------------------------------------------
// Filter functions
// ---------------------------------------------------------------------------

/**
 * Filter agents for @-mention search.
 *
 * Rules:
 * 1. Exclude hidden agents (by HIDDEN_AGENTS set or `hidden: true` flag)
 * 2. Include subagents (unlike QuickPick which excludes them)
 * 3. Include primary and "all" mode agents
 * 4. If query is non-empty, filter by name/description (case-insensitive)
 * 5. Limit to top MAX_RESULTS (20)
 * 6. If query is empty, return all non-hidden agents (up to MAX_RESULTS)
 */
export function filterAgentsForMention(
  agents: AgentSearchInput[],
  query: string,
): AgentSearchResult[] {
  const lowerQuery = query.toLowerCase();

  return agents
    .filter((agent) => {
      // Rule 1: Exclude hidden agents
      if (HIDDEN_AGENTS.has(agent.name) || agent.hidden) {
        return false;
      }

      // Rule 1b: Skip agents with unknown mode (would fail MentionAgentSchema)
      if (agent.mode !== "subagent" && agent.mode !== "primary" && agent.mode !== "all") {
        return false;
      }

      // Rule 2 & 3: Include all known modes (subagent, primary, all)
      // (No mode filtering for @-mentions — subagents are valuable context)

      // Rule 4: Query filter
      if (lowerQuery) {
        const nameMatch = agent.name.toLowerCase().includes(lowerQuery);
        const descMatch = agent.description?.toLowerCase().includes(lowerQuery) ?? false;
        return nameMatch || descMatch;
      }

      // Rule 6: Empty query → include all non-hidden
      return true;
    })
    .slice(0, MAX_RESULTS)
    .map((agent): AgentSearchResult => ({
      name: agent.name,
      description: agent.description,
      mode: agent.mode as "subagent" | "primary" | "all",
    }));
}

/**
 * Filter skills for @-mention search.
 *
 * Rules:
 * 1. If query is non-empty, filter by name/description/location (case-insensitive)
 * 2. If query is empty, return all skills (up to MAX_RESULTS)
 * 3. Limit to top MAX_RESULTS (20)
 * 4. Gracefully handle malformed entries (skip entries without a name)
 * 5. Never pass `content` to webview (not included in output type)
 */
export function filterSkillsForMention(
  skills: SkillSearchInput[],
  query: string,
): SkillSearchResult[] {
  const lowerQuery = query.toLowerCase();

  return skills
    .filter((skill) => {
      // Rule 4: Skip malformed entries without name
      if (!skill.name || typeof skill.name !== "string") {
        return false;
      }

      // Rule 1: Query filter
      if (lowerQuery) {
        const nameMatch = skill.name.toLowerCase().includes(lowerQuery);
        const descMatch = skill.description?.toLowerCase().includes(lowerQuery) ?? false;
        const locMatch = skill.location?.toLowerCase().includes(lowerQuery) ?? false;
        return nameMatch || descMatch || locMatch;
      }

      // Rule 2: Empty query → include all valid
      return true;
    })
    .slice(0, MAX_RESULTS)
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      location: skill.location,
    }));
}
