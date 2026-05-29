import { describe, it, expect } from "vitest";
import {
  getMentionKind,
  parseMentionId,
  formatMentionId,
} from "./mention";
import type { MentionKind } from "./mention";

describe("getMentionKind", () => {
  it("returns 'file' for unprefixed paths", () => {
    expect(getMentionKind("src/App.tsx")).toBe("file");
  });

  it("returns 'file' for paths with line ranges", () => {
    expect(getMentionKind("src/App.tsx#L5-8")).toBe("file");
  });

  it("returns 'agent' for agent: prefix", () => {
    expect(getMentionKind("agent:build")).toBe("agent");
  });

  it("returns 'skill' for skill: prefix", () => {
    expect(getMentionKind("skill:review-work")).toBe("skill");
  });

  it("returns 'file' for empty string", () => {
    expect(getMentionKind("")).toBe("file");
  });

  it("returns 'file' for path that starts with 'a' but not 'agent:'", () => {
    expect(getMentionKind("agent.ts")).toBe("file");
  });
});

describe("parseMentionId", () => {
  it("parses file mention id", () => {
    expect(parseMentionId("src/App.tsx#L5-8")).toEqual({
      kind: "file",
      value: "src/App.tsx#L5-8",
    });
  });

  it("parses agent mention id", () => {
    expect(parseMentionId("agent:build")).toEqual({
      kind: "agent",
      value: "build",
    });
  });

  it("parses skill mention id", () => {
    expect(parseMentionId("skill:review-work")).toEqual({
      kind: "skill",
      value: "review-work",
    });
  });
});

describe("formatMentionId", () => {
  it("formats file mention id (no prefix)", () => {
    expect(formatMentionId("file", "src/App.tsx")).toBe("src/App.tsx");
  });

  it("formats agent mention id", () => {
    expect(formatMentionId("agent", "build")).toBe("agent:build");
  });

  it("formats skill mention id", () => {
    expect(formatMentionId("skill", "review-work")).toBe("skill:review-work");
  });
});

describe("parseMentionId ↔ formatMentionId roundtrip", () => {
  const cases: Array<{ id: string; kind: MentionKind; value: string }> = [
    { id: "src/App.tsx", kind: "file", value: "src/App.tsx" },
    { id: "src/App.tsx#L5-8", kind: "file", value: "src/App.tsx#L5-8" },
    { id: "agent:build", kind: "agent", value: "build" },
    { id: "skill:review-work", kind: "skill", value: "review-work" },
  ];

  for (const { id, kind, value } of cases) {
    it(`roundtrips ${id}`, () => {
      const parsed = parseMentionId(id);
      expect(parsed).toEqual({ kind, value });
      expect(formatMentionId(parsed.kind, parsed.value)).toBe(id);
    });
  }
});
