import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeFreeOService } from "./CodeFreeOService";

// Mock the SDK imports
vi.mock("@srdcloud/codefree-o-sdk/v2", () => ({
  createOpencodeServer: vi.fn(),
  createOpencodeClient: vi.fn(),
}));

vi.mock("child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("fs", () => ({
  fs: {
    existsSync: vi.fn(),
  },
}));

vi.mock("vscode", () => ({
  window: {
    showErrorMessage: vi.fn(),
  },
  Uri: { parse: vi.fn() },
  env: { openExternal: vi.fn() },
}));

vi.mock("./extension", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("CodeFreeOService", () => {
  describe("setCurrentSessionId", () => {
    it("sets the session ID", () => {
      const service = new CodeFreeOService();
      expect(service.getCurrentSessionId()).toBeNull();
      service.setCurrentSessionId("s1");
      expect(service.getCurrentSessionId()).toBe("s1");
    });

    it("sets session ID to null", () => {
      const service = new CodeFreeOService();
      service.setCurrentSessionId("s1");
      service.setCurrentSessionId(null);
      expect(service.getCurrentSessionId()).toBeNull();
    });

    it("no-ops when setting the same ID", () => {
      const service = new CodeFreeOService();
      service.setCurrentSessionId("s1");
      // Setting same ID should be a no-op (same reference)
      service.setCurrentSessionId("s1");
      expect(service.getCurrentSessionId()).toBe("s1");
    });
  });

  describe("validateSessionId", () => {
    it("returns null when service is not initialized", async () => {
      const service = new CodeFreeOService();
      const result = await service.validateSessionId("s1");
      expect(result).toBeNull();
    });

    it("returns the session ID when session exists and belongs to workspace", async () => {
      const service = new CodeFreeOService();
      // Access private field to set up mock state
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: [
                { id: "s1", directory: "/workspace" },
                { id: "s2", directory: "/workspace" },
              ],
              error: undefined,
            }),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      const result = await service.validateSessionId("s1");
      expect(result).toBe("s1");
    });

    it("returns null when session does not exist in list", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "s1", directory: "/workspace" }],
              error: undefined,
            }),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      const result = await service.validateSessionId("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null when session belongs to different workspace", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "s1", directory: "/other-workspace" }],
              error: undefined,
            }),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      const result = await service.validateSessionId("s1");
      expect(result).toBeNull();
    });

    it("returns null when SDK returns error", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: undefined,
              error: { message: "Server error" },
            }),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      const result = await service.validateSessionId("s1");
      expect(result).toBeNull();
    });

    it("returns null when SDK throws exception", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockRejectedValue(new Error("Network error")),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      const result = await service.validateSessionId("s1");
      expect(result).toBeNull();
    });

    it("accepts session when workspaceDir is not set", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "s1", directory: "/any-workspace" }],
              error: undefined,
            }),
          },
        },
      };
      // workspaceDir is undefined

      const result = await service.validateSessionId("s1");
      expect(result).toBe("s1");
    });

    it("includes forked sessions (with parentID) in validation", async () => {
      const service = new CodeFreeOService();
      (service as any).codefreeO = {
        client: {
          session: {
            list: vi.fn().mockResolvedValue({
              data: [
                { id: "s1", directory: "/workspace" },
                { id: "s2", directory: "/workspace", parentID: "s1" },
              ],
              error: undefined,
            }),
          },
        },
      };
      (service as any).workspaceDir = "/workspace";

      // Forked session should be found (not filtered out)
      const result = await service.validateSessionId("s2");
      expect(result).toBe("s2");
    });
  });
});
