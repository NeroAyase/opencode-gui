import { describe, it, expect } from "vitest";
import {
  filterAgentsForMention,
  filterSkillsForMention,
  type AgentSearchInput,
  type SkillSearchInput,
} from "./mentionSearch";

// ---------------------------------------------------------------------------
// filterAgentsForMention
// ---------------------------------------------------------------------------

describe("filterAgentsForMention", () => {
  const allAgents: AgentSearchInput[] = [
    { name: "build", description: "Build subagent", mode: "subagent" },
    { name: "coder", description: "Primary coding agent", mode: "primary" },
    { name: "orchestrator", mode: "all" },
    { name: "compaction", description: "Hidden system agent", mode: "primary" },
    { name: "title", description: "Hidden title agent", mode: "subagent" },
    { name: "summary", description: "Hidden summary agent", mode: "subagent" },
    { name: "secret", description: "Flagged hidden", mode: "primary", hidden: true },
  ];

  it("excludes hidden agents from HIDDEN_AGENTS set", () => {
    const result = filterAgentsForMention(allAgents, "");
    const names = result.map((a) => a.name);
    expect(names).not.toContain("compaction");
    expect(names).not.toContain("title");
    expect(names).not.toContain("summary");
  });

  it("excludes agents with hidden: true flag", () => {
    const result = filterAgentsForMention(allAgents, "");
    const names = result.map((a) => a.name);
    expect(names).not.toContain("secret");
  });

  it("skips agents with unknown mode", () => {
    const agentsWithUnknownMode: AgentSearchInput[] = [
      { name: "valid-sub", mode: "subagent" },
      { name: "unknown-mode", mode: "custom" },
      { name: "another-unknown", mode: "experimental" },
    ];
    const result = filterAgentsForMention(agentsWithUnknownMode, "");
    const names = result.map((a) => a.name);
    expect(names).toContain("valid-sub");
    expect(names).not.toContain("unknown-mode");
    expect(names).not.toContain("another-unknown");
  });

  it("includes subagents (unlike QuickPick)", () => {
    const result = filterAgentsForMention(allAgents, "");
    const names = result.map((a) => a.name);
    expect(names).toContain("build");
  });

  it("includes primary and all mode agents", () => {
    const result = filterAgentsForMention(allAgents, "");
    const names = result.map((a) => a.name);
    expect(names).toContain("coder");
    expect(names).toContain("orchestrator");
  });

  it("filters by name (case-insensitive)", () => {
    const result = filterAgentsForMention(allAgents, "BUILD");
    const names = result.map((a) => a.name);
    expect(names).toContain("build");
    expect(names).not.toContain("coder");
  });

  it("filters by description (case-insensitive)", () => {
    const result = filterAgentsForMention(allAgents, "primary coding");
    const names = result.map((a) => a.name);
    expect(names).toContain("coder");
  });

  it("returns all non-hidden agents when query is empty", () => {
    const result = filterAgentsForMention(allAgents, "");
    expect(result).toHaveLength(3); // build, coder, orchestrator
  });

  it("returns empty array when no agents match query", () => {
    const result = filterAgentsForMention(allAgents, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("limits results to 20", () => {
    const manyAgents: AgentSearchInput[] = Array.from({ length: 30 }, (_, i) => ({
      name: `agent-${i}`,
      mode: "subagent" as const,
    }));
    const result = filterAgentsForMention(manyAgents, "");
    expect(result).toHaveLength(20);
  });

  it("maps to AgentSearchResult shape (no hidden field)", () => {
    const result = filterAgentsForMention(allAgents, "");
    for (const agent of result) {
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("mode");
      expect(agent).not.toHaveProperty("hidden");
    }
  });

  it("handles empty input array", () => {
    const result = filterAgentsForMention([], "test");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterSkillsForMention
// ---------------------------------------------------------------------------

describe("filterSkillsForMention", () => {
  const allSkills: SkillSearchInput[] = [
    { name: "review-work", description: "Expert code review", location: "file:///skills/review/SKILL.md" },
    { name: "commit", description: "Git commit helper", location: "file:///skills/commit/SKILL.md" },
    { name: "push", location: "file:///skills/push/SKILL.md" },
    { name: "generate-spec", description: "Create spec sheets" },
  ];

  it("filters by name (case-insensitive)", () => {
    const result = filterSkillsForMention(allSkills, "REVIEW");
    const names = result.map((s) => s.name);
    expect(names).toContain("review-work");
    expect(names).toHaveLength(1);
  });

  it("filters by description (case-insensitive)", () => {
    const result = filterSkillsForMention(allSkills, "git commit");
    const names = result.map((s) => s.name);
    expect(names).toContain("commit");
  });

  it("filters by location (case-insensitive)", () => {
    const result = filterSkillsForMention(allSkills, "push/skill");
    const names = result.map((s) => s.name);
    expect(names).toContain("push");
  });

  it("returns all skills when query is empty", () => {
    const result = filterSkillsForMention(allSkills, "");
    expect(result).toHaveLength(4);
  });

  it("returns empty array when no skills match query", () => {
    const result = filterSkillsForMention(allSkills, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("limits results to 20", () => {
    const manySkills: SkillSearchInput[] = Array.from({ length: 30 }, (_, i) => ({
      name: `skill-${i}`,
    }));
    const result = filterSkillsForMention(manySkills, "");
    expect(result).toHaveLength(20);
  });

  it("skips malformed entries without name", () => {
    const malformed: SkillSearchInput[] = [
      { name: "", description: "Empty name" } as SkillSearchInput,
      { name: 123 as unknown as string, description: "Number name" } as SkillSearchInput,
      { name: "valid", description: "Valid skill" },
    ];
    const result = filterSkillsForMention(malformed, "");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid");
  });

  it("maps to SkillSearchResult shape (no content field)", () => {
    const result = filterSkillsForMention(allSkills, "");
    for (const skill of result) {
      expect(skill).toHaveProperty("name");
      expect(skill).not.toHaveProperty("content");
    }
  });

  it("handles empty input array", () => {
    const result = filterSkillsForMention([], "test");
    expect(result).toEqual([]);
  });

  it("handles skills with only name (no description or location)", () => {
    const skills: SkillSearchInput[] = [{ name: "minimal" }];
    const result = filterSkillsForMention(skills, "");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "minimal" });
  });
});
