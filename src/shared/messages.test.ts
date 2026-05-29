import { describe, it, expect, vi } from "vitest";
import {
  HostMessageSchema,
  WebviewMessageSchema,
  parseHostMessage,
  parseWebviewMessage,
  MessagePartSchema,
  ToolStateSchema,
  AgentSchema,
  SessionSchema,
  PermissionSchema,
  ContextInfoSchema,
  FileChangesInfoSchema,
  SkillSchema,
} from "./messages";

describe("ToolStateSchema", () => {
  it("parses valid tool state", () => {
    const state = {
      status: "running",
      input: { foo: "bar" },
      output: "result",
      title: "Some Tool",
      time: { start: 1000, end: 2000 },
      metadata: { diff: "+1 line" },
    };
    expect(ToolStateSchema.parse(state)).toEqual(state);
  });

  it("allows minimal tool state", () => {
    const state = { status: "pending" };
    expect(ToolStateSchema.parse(state)).toEqual(state);
  });

  it("rejects invalid status", () => {
    expect(() => ToolStateSchema.parse({ status: "invalid" })).toThrow();
  });
});

describe("MessagePartSchema", () => {
  it("parses text part", () => {
    const part = { id: "p1", type: "text", text: "Hello" };
    expect(MessagePartSchema.parse(part)).toEqual(part);
  });

  it("parses tool part with state", () => {
    const part = {
      id: "p2",
      type: "tool",
      tool: "read",
      state: { status: "completed", output: "file content" },
      messageID: "m1",
      callID: "c1",
    };
    expect(MessagePartSchema.parse(part)).toEqual(part);
  });

  it("rejects unknown type", () => {
    expect(() => MessagePartSchema.parse({ id: "p3", type: "unknown" })).toThrow();
  });
});

describe("AgentSchema", () => {
  it("parses full agent", () => {
    const agent = {
      name: "coder",
      description: "Coding agent",
      mode: "primary",
      builtIn: true,
      options: { color: "#ff0000" },
    };
    expect(AgentSchema.parse(agent)).toEqual(agent);
  });

  it("parses minimal agent", () => {
    const agent = { name: "test", mode: "subagent", builtIn: false };
    expect(AgentSchema.parse(agent)).toEqual(agent);
  });
});

describe("SessionSchema", () => {
  it("parses session", () => {
    const session = {
      id: "s1",
      title: "Test Session",
      projectID: "proj1",
      directory: "/home/user/project",
      time: { created: 1000, updated: 2000 },
    };
    expect(SessionSchema.parse(session)).toEqual(session);
  });
});

describe("PermissionSchema", () => {
  it("parses permission with patterns", () => {
    const perm = {
      id: "perm1",
      permission: "file.write",
      patterns: ["*.ts"],
      sessionID: "s1",
      metadata: { path: "/home/user/file.ts" },
      tool: { messageID: "m1", callID: "c1" },
    };
    expect(PermissionSchema.parse(perm)).toEqual(perm);
  });

  it("parses permission without optional fields", () => {
    const perm = {
      id: "perm2",
      permission: "file.write",
      sessionID: "s1",
      metadata: {},
    };
    expect(PermissionSchema.parse(perm)).toEqual(perm);
  });
});

describe("ContextInfoSchema", () => {
  it("parses context info", () => {
    const info = { usedTokens: 5000, limitTokens: 100000, percentage: 5 };
    expect(ContextInfoSchema.parse(info)).toEqual(info);
  });
});

describe("FileChangesInfoSchema", () => {
  it("parses file changes", () => {
    const info = { fileCount: 3, additions: 100, deletions: 50 };
    expect(FileChangesInfoSchema.parse(info)).toEqual(info);
  });
});

describe("HostMessageSchema", () => {
  it("parses init message", () => {
    const msg = {
      type: "init",
      ready: true,
      workspaceRoot: "/home/user/project",
      currentSessionId: "s1",
    };
    expect(HostMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses error message", () => {
    const msg = { type: "error", message: "Something went wrong" };
    expect(HostMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses search-files-result message", () => {
    const msg = {
      type: "search-files-result",
      files: ["src/index.ts", "src/App.tsx", "package.json"],
    };
    expect(HostMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects unknown message type", () => {
    expect(() => HostMessageSchema.parse({ type: "unknown" })).toThrow();
  });
});

describe("WebviewMessageSchema", () => {
  it("parses ready message", () => {
    expect(WebviewMessageSchema.parse({ type: "ready" })).toEqual({ type: "ready" });
  });

  it("parses agent-changed message", () => {
    const msg = { type: "agent-changed", agent: "coder" };
    expect(WebviewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses search-files message", () => {
    const msg = { type: "search-files", query: "index" };
    expect(WebviewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects unknown message type", () => {
    expect(() => WebviewMessageSchema.parse({ type: "unknown" })).toThrow();
  });

  it("parses session-changed message with string sessionID", () => {
    const msg = { type: "session-changed", sessionID: "s1" };
    expect(WebviewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses session-changed message with null sessionID", () => {
    const msg = { type: "session-changed", sessionID: null };
    expect(WebviewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects session-changed message with missing sessionID", () => {
    expect(() => WebviewMessageSchema.parse({ type: "session-changed" })).toThrow();
  });

  it("rejects session-changed message with undefined sessionID", () => {
    expect(() => WebviewMessageSchema.parse({ type: "session-changed", sessionID: undefined })).toThrow();
  });
});

describe("parseHostMessage", () => {
  it("returns parsed message for valid input", () => {
    const result = parseHostMessage({ type: "error", message: "Something went wrong" });
    expect(result).toEqual({ type: "error", message: "Something went wrong" });
  });

  it("returns null for invalid input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseHostMessage({ type: "invalid" });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns null for non-object input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseHostMessage("not an object")).toBeNull();
    expect(parseHostMessage(null)).toBeNull();
    expect(parseHostMessage(undefined)).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("parseWebviewMessage", () => {
  it("returns parsed message for valid input", () => {
    const result = parseWebviewMessage({ type: "ready" });
    expect(result).toEqual({ type: "ready" });
  });

  it("returns null for invalid input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseWebviewMessage({ type: "invalid" });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("returns null for missing required fields", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = parseWebviewMessage({ type: "agent-changed" });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("SkillSchema", () => {
  it("parses minimal skill (name only)", () => {
    const skill = { name: "review-work" };
    expect(SkillSchema.parse(skill)).toEqual({ name: "review-work" });
  });

  it("parses full skill with all fields", () => {
    const skill = {
      name: "review-work",
      description: "Expert code review",
      location: "file:///home/user/.claude/skills/review-work/SKILL.md",
    };
    expect(SkillSchema.parse(skill)).toEqual(skill);
  });

  it("rejects skill without name", () => {
    expect(() => SkillSchema.parse({ description: "No name" })).toThrow();
  });

  it("rejects malformed entries with wrong types", () => {
    expect(() => SkillSchema.parse({ name: 123 })).toThrow();
    expect(() => SkillSchema.parse({ name: "ok", description: 456 })).toThrow();
    expect(() => SkillSchema.parse(null)).toThrow();
    expect(() => SkillSchema.parse("not an object")).toThrow();
  });
});

describe("skills-list WebviewMessage", () => {
  it("parses skills-list message", () => {
    const msg = { type: "skills-list" };
    expect(WebviewMessageSchema.parse(msg)).toEqual({ type: "skills-list" });
  });
});

describe("skills-list-result HostMessage", () => {
  it("parses skills-list-result with valid skills array", () => {
    const msg = {
      type: "skills-list-result",
      skills: [
        { name: "review-work", description: "Code review" },
        { name: "commit", description: "Git commit", location: "file:///skills/commit/SKILL.md" },
      ],
    };
    expect(HostMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses skills-list-result with empty skills array", () => {
    const msg = { type: "skills-list-result", skills: [] };
    expect(HostMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects skills-list-result with invalid skill entries", () => {
    const msg = {
      type: "skills-list-result",
      skills: [{ description: "Missing name field" }],
    };
    expect(() => HostMessageSchema.parse(msg)).toThrow();
  });
});
