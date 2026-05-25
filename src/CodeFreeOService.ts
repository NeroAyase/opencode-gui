import {
  createOpencodeServer,
  createOpencodeClient,
  type OpencodeClient,
} from "@srdcloud/codefree-o-sdk/v2";
import type { Message } from "@srdcloud/codefree-o-sdk/v2/client";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getLogger } from "./extension";

const CODEFREE_O_INSTALL_URL = "https://www.srdcloud.cn/feedback/feedback";

interface CodeFreeOInstance {
  client: OpencodeClient;
  server: {
    url: string;
    close(): void;
  };
}

export class CodeFreeOService {
  private codefreeO: CodeFreeOInstance | null = null;
  private currentSessionId: string | null = null;
  private currentSessionTitle: string = "New Session";
  private isInitializing = false;
  private workspaceDir?: string;

  async initialize(workspaceRoot?: string): Promise<void> {
    if (this.codefreeO || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      this.workspaceDir = workspaceRoot;
    }

    try {
      const logger = getLogger();
      const configPath = workspaceRoot
        ? path.join(workspaceRoot, "codefree.json")
        : null;
      const hasWorkspaceConfig = configPath && fs.existsSync(configPath);

      if (hasWorkspaceConfig) {
        logger.info(`Found workspace config at: ${configPath}`);
      } else {
        logger.info(
          "No workspace config found, CodeFree-O will use default/global config",
        );
      }

      this.ensureOpencodeCliAvailable();

      logger.info("Starting CodeFree-O server...");

      // Start the server process (no process.chdir needed — the server
      // discovers config via OPENCODE_CONFIG_CONTENT env var and the client
      // passes the workspace directory via x-codefree-o-directory header).
      const server = await createOpencodeServer({
        hostname: "127.0.0.1",
        port: 0,
        timeout: 15000,
      });

      logger.info(`CodeFree-O server started at ${server.url}`);

      // Create the client with the workspace directory so every request
      // automatically includes the x-codefree-o-directory header.
      const client = createOpencodeClient({
        baseUrl: server.url,
        directory: this.workspaceDir,
      });

      this.codefreeO = { client, server };
    } catch (error) {
      getLogger().error("Failed to initialize CodeFree-O", error);
      await this.showStartupError(error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private ensureOpencodeCliAvailable(): void {
    const lookupCommand = process.platform === "win32" ? "where" : "which";
    const lookupResult = spawnSync(lookupCommand, ["codefree-o"], {
      encoding: "utf8",
    });

    if (lookupResult.status === 0 && lookupResult.stdout.trim().length > 0) {
      const binaryPath = lookupResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      getLogger().info("CodeFree-O CLI found on PATH", {
        command: `${lookupCommand} codefree-o`,
        binaryPath,
      });
      return;
    }

    getLogger().error("CodeFree-O CLI preflight check failed", {
      command: `${lookupCommand} codefree-o`,
      status: lookupResult.status,
      error: lookupResult.error?.message,
      stderr: lookupResult.stderr?.trim(),
    });

    const verifyCommand =
      process.platform === "win32" ? "where codefree-o" : "which codefree-o";

    throw new Error(
      `CodeFree-O CLI was not found on PATH. Verify with "${verifyCommand}", then restart VS Code.`,
    );
  }

  private async showStartupError(error: unknown): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown startup error";
    const isMissingCli = errorMessage.includes(
      "CodeFree-O CLI was not found on PATH",
    );

    if (isMissingCli) {
      const selection = await vscode.window.showErrorMessage(
        "CodeFree-O CLI was not found in the VS Code environment. Install it via npm: npm install -g @srdcloud/codefree-o, verify it works in your terminal, then fully restart VS Code.",
        "Get Help",
      );

      if (selection === "Get Help") {
        await vscode.env.openExternal(vscode.Uri.parse(CODEFREE_O_INSTALL_URL));
      }
      return;
    }

    await vscode.window.showErrorMessage(`Failed to start CodeFree-O: ${errorMessage}`);
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  setCurrentSessionId(id: string | null): void {
    if (this.currentSessionId === id) return; // no-op guard
    this.currentSessionId = id;
  }

  getCurrentSessionTitle(): string {
    return this.currentSessionTitle;
  }

  async getMessages(
    sessionId: string,
  ): Promise<Message[]> {
    if (!this.codefreeO) {
      throw new Error("CodeFree-O not initialized");
    }

    const result = await this.codefreeO.client.session.messages({
      sessionID: sessionId,
    });

    if (result.error) {
      throw new Error(
        `Failed to get messages: ${JSON.stringify(result.error)}`,
      );
    }

    return result.data || [];
  }

  dispose(): void {
    if (this.codefreeO) {
      this.codefreeO.server.close();
      this.codefreeO = null;
      this.currentSessionId = null;
    }
  }

  isReady(): boolean {
    return this.codefreeO !== null && !this.isInitializing;
  }

  getWorkspaceRoot(): string | undefined {
    return this.workspaceDir;
  }

  getServerUrl(): string | undefined {
    return this.codefreeO?.server.url;
  }

  getClient(): OpencodeClient | undefined {
    return this.codefreeO?.client;
  }

  /**
   * Validate that a session ID exists and belongs to the current workspace.
   * Uses raw SDK session.list (not UI-filtered) so forked/reverted sessions
   * are not incorrectly rejected.
   * Returns the validated session ID, or null if invalid.
   */
  async validateSessionId(sessionId: string): Promise<string | null> {
    if (!this.codefreeO) return null;

    try {
      const result = await this.codefreeO.client.session.list({
        directory: this.workspaceDir,
      });

      if (result.error || !result.data) return null;

      const session = result.data.find((s) => s.id === sessionId);
      if (!session) return null;

      // Verify session belongs to current workspace
      if (this.workspaceDir && session.directory !== this.workspaceDir) {
        return null;
      }

      return sessionId;
    } catch {
      return null;
    }
  }
}
