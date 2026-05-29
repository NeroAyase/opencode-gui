import { describe, it, expect } from "vitest";
import { extractMentions, extractMentionIds, extractFileMentionIds } from "./editorContent";
import type { JSONContent } from "@tiptap/core";
import type { MentionRef } from "./mention";

describe("extractMentions", () => {
  it("extracts file mentions from editor JSON", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Check out " },
            { type: "fileMention", attrs: { id: "src/index.ts", label: "index.ts" } },
            { type: "text", text: " and " },
            { type: "fileMention", attrs: { id: "src/App.tsx", label: "App.tsx" } },
          ],
        },
      ],
    };

    const mentions = extractMentions(json);
    expect(mentions).toEqual([
      { id: "src/index.ts", kind: "file", nodeType: "fileMention", label: "index.ts" },
      { id: "src/App.tsx", kind: "file", nodeType: "fileMention", label: "App.tsx" },
    ]);
  });

  it("returns empty array when no mentions", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Just plain text" }],
        },
      ],
    };

    const mentions = extractMentions(json);
    expect(mentions).toEqual([]);
  });

  it("extracts mentions from nested content", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First paragraph with " },
            { type: "fileMention", attrs: { id: "file1.ts", label: "file1" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second paragraph with " },
            { type: "fileMention", attrs: { id: "file2.ts", label: "file2" } },
          ],
        },
      ],
    };

    const mentions = extractMentions(json);
    expect(mentions).toEqual([
      { id: "file1.ts", kind: "file", nodeType: "fileMention", label: "file1" },
      { id: "file2.ts", kind: "file", nodeType: "fileMention", label: "file2" },
    ]);
  });

  it("handles mentions without label", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "fileMention", attrs: { id: "package.json" } }],
        },
      ],
    };

    const mentions = extractMentions(json);
    expect(mentions).toEqual([
      { id: "package.json", kind: "file", nodeType: "fileMention", label: undefined },
    ]);
  });

  it("skips mentions without id attribute", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "fileMention", attrs: { label: "broken" } },
            { type: "fileMention", attrs: { id: "valid.ts", label: "valid" } },
          ],
        },
      ],
    };

    const mentions = extractMentions(json);
    expect(mentions).toEqual([
      { id: "valid.ts", kind: "file", nodeType: "fileMention", label: "valid" },
    ]);
  });
});

describe("extractMentions (kind-discriminated)", () => {
  it("extracts file mentions with kind 'file'", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "fileMention", attrs: { id: "src/index.ts", label: "index.ts" } },
          ],
        },
      ],
    };

    const refs = extractMentions(json);
    expect(refs).toEqual([
      { id: "src/index.ts", kind: "file", nodeType: "fileMention", label: "index.ts" },
    ]);
  });

  it("extracts agent mentions with kind 'agent'", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "agent:build", label: "@build" } },
          ],
        },
      ],
    };

    const refs = extractMentions(json);
    expect(refs).toEqual([
      { id: "agent:build", kind: "agent", nodeType: "mention", label: "@build" },
    ]);
  });

  it("extracts skill mentions with kind 'skill'", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "skill:review-work", label: "@review-work" } },
          ],
        },
      ],
    };

    const refs = extractMentions(json);
    expect(refs).toEqual([
      { id: "skill:review-work", kind: "skill", nodeType: "mention", label: "@review-work" },
    ]);
  });

  it("extracts mixed mention kinds", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "fileMention", attrs: { id: "src/App.tsx", label: "App.tsx" } },
            { type: "text", text: " with " },
            { type: "mention", attrs: { id: "agent:build", label: "@build" } },
            { type: "text", text: " and " },
            { type: "mention", attrs: { id: "skill:review", label: "@review" } },
          ],
        },
      ],
    };

    const refs = extractMentions(json);
    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual({ id: "src/App.tsx", kind: "file", nodeType: "fileMention", label: "App.tsx" });
    expect(refs[1]).toEqual({ id: "agent:build", kind: "agent", nodeType: "mention", label: "@build" });
    expect(refs[2]).toEqual({ id: "skill:review", kind: "skill", nodeType: "mention", label: "@review" });
  });
});

describe("extractMentionIds (legacy)", () => {
  it("returns plain string array for backward compat", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "fileMention", attrs: { id: "src/index.ts", label: "index.ts" } },
            { type: "mention", attrs: { id: "agent:build", label: "@build" } },
          ],
        },
      ],
    };

    const ids = extractMentionIds(json);
    expect(ids).toEqual(["src/index.ts", "agent:build"]);
  });
});

describe("extractFileMentionIds", () => {
  it("returns only file mention ids, excluding agent and skill", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "fileMention", attrs: { id: "src/index.ts", label: "index.ts" } },
            { type: "mention", attrs: { id: "agent:build", label: "@build" } },
            { type: "fileMention", attrs: { id: "src/App.tsx", label: "App.tsx" } },
            { type: "mention", attrs: { id: "skill:review-work", label: "@review-work" } },
          ],
        },
      ],
    };

    const fileIds = extractFileMentionIds(json);
    expect(fileIds).toEqual(["src/index.ts", "src/App.tsx"]);
  });

  it("returns empty array when only agent/skill mentions present", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "agent:build", label: "@build" } },
            { type: "mention", attrs: { id: "skill:review", label: "@review" } },
          ],
        },
      ],
    };

    const fileIds = extractFileMentionIds(json);
    expect(fileIds).toEqual([]);
  });

  it("returns empty array when no mentions present", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Just text" }],
        },
      ],
    };

    const fileIds = extractFileMentionIds(json);
    expect(fileIds).toEqual([]);
  });
});
