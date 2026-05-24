import { test as base, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface CodeFreeOConfig {
  serverUrl: string;
  workspaceRoot?: string;
  codefreeOConfig?: Record<string, unknown>;
}

interface LogEntry {
  level: string;
  timestamp: string;
  service?: string;
  message: string;
  raw: string;
  metadata: Record<string, string>;
}

interface CodeFreeOServer {
  url: string;
  process: ChildProcess;
  logs: string[];
  getLogs: () => string;
  searchLogs: (pattern: string | RegExp) => boolean;
  getLogEntries: () => LogEntry[];
  searchLogEntries: (filter: Partial<LogEntry>) => LogEntry[];
}

export interface CodeFreeOWorkerFixtures {
  codefreeOServer: CodeFreeOServer;
}

export interface CodeFreeOFixtures {
  openWebview: (config?: Partial<CodeFreeOConfig>) => Promise<Page>;
  serverLogs: CodeFreeOServer["logs"];
  getServerLogs: () => string;
  searchServerLogs: (pattern: string | RegExp) => boolean;
  getServerLogEntries: () => LogEntry[];
  searchServerLogEntries: (filter: Partial<LogEntry>) => LogEntry[];
}

function parseLogLine(line: string): LogEntry {
  // Parse format: "LEVEL  timestamp +offset service=value key=value message"
  // Example: "INFO  2026-01-13T03:11:44 +0ms service=config path=/path/to/file loading"
  const match = line.match(/^(DEBUG|INFO|WARN|ERROR)\s+(\S+)\s+\+\S+\s+(.*)$/);
  if (!match) {
    return {
      level: "UNKNOWN",
      timestamp: "",
      message: line.trim(),
      raw: line,
      metadata: {},
    };
  }

  const [, level, timestamp, rest] = match;
  const metadata: Record<string, string> = {};
  let service: string | undefined;
  let message = "";

  // Parse key=value pairs and remaining message
  const parts = rest.split(/\s+/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Match key=value where value can be anything (including quoted strings, JSON, etc)
    const kvMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_.-]*)=(.+)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      metadata[key] = value;
      if (key === "service") {
        service = value;
      }
    } else {
      // Rest is the message
      message = parts.slice(i).join(" ");
      break;
    }
  }

  return {
    level,
    timestamp,
    service,
    message: message.trim(),
    raw: line,
    metadata,
  };
}

async function waitForServerReady(url: string, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/session`);
      if (response.ok) {
        console.log(`[fixture] Server health check passed`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

async function startCodeFreeOServer(workspaceRoot: string): Promise<CodeFreeOServer> {
  return new Promise((resolve, reject) => {
    console.log(`[fixture] Spawning codefree-o serve in ${workspaceRoot}`);
    
    const logs: string[] = [];
    
    const serverProcess = spawn(
      "codefree-o",
      [
        "serve",
        "--port",
        "0", // Let OS pick an available port
        "--hostname",
        "127.0.0.1",
        "--cors",
        "http://localhost:5199",
        "--cors",
        "http://127.0.0.1:5199",
        "--print-logs",
      ],
      {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
        shell: process.platform === "win32",
      }
    );

    let serverUrl: string | null = null;
    let outputBuffer = "";

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      outputBuffer += text;
      
      // Store logs for test access
      logs.push(text);
      
      console.log(`[codefree-o] ${text.trim()}`);

      // Look for the server URL in the output
      // CodeFree-O outputs: "codefree-o server listening on http://127.0.0.1:XXXXX"
      const urlMatch = outputBuffer.match(/listening on (http:\/\/[\d.:]+)/i);
      if (urlMatch && !serverUrl) {
        // Normalize 127.0.0.1 to localhost for browser compatibility
        serverUrl = urlMatch[1].replace("127.0.0.1", "localhost");
        console.log(`[fixture] Detected server URL: ${serverUrl}`);
        
        const getLogEntries = () => {
          return logs
            .map((log) => {
              const lines = log.split("\n").filter((l) => l.trim());
              return lines.map(parseLogLine);
            })
            .flat();
        };

        const searchLogEntries = (filter: Partial<LogEntry>) => {
          return getLogEntries().filter((entry) => {
            for (const [key, value] of Object.entries(filter)) {
              if (key === "metadata") {
                // Check if all metadata keys match
                const metadataFilter = value as Record<string, string>;
                for (const [k, v] of Object.entries(metadataFilter)) {
                  if (entry.metadata[k] !== v) return false;
                }
              } else if (entry[key as keyof LogEntry] !== value) {
                return false;
              }
            }
            return true;
          });
        };
        
        resolve({ 
          url: serverUrl, 
          process: serverProcess,
          logs,
          getLogs: () => logs.join(""),
          searchLogs: (pattern: string | RegExp) => {
            const logsText = logs.join("");
            if (typeof pattern === "string") {
              return logsText.includes(pattern);
            }
            return pattern.test(logsText);
          },
          getLogEntries,
          searchLogEntries,
        });
      }
    };

    serverProcess.stdout?.on("data", handleOutput);
    serverProcess.stderr?.on("data", handleOutput);

    serverProcess.on("error", (err) => {
      reject(new Error(`Failed to start CodeFree-O server: ${err.message}`));
    });

    serverProcess.on("exit", (code) => {
      if (!serverUrl) {
        reject(
          new Error(
            `CodeFree-O server exited with code ${code} before providing URL. Output: ${outputBuffer}`
          )
        );
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverUrl) {
        serverProcess.kill();
        reject(
          new Error(
            `Timeout waiting for CodeFree-O server to start. Output: ${outputBuffer}`
          )
        );
      }
    }, 30000);
  });
}

export const test = base.extend<CodeFreeOFixtures, CodeFreeOWorkerFixtures>({
  // Share the server across all tests in a worker
  codefreeOServer: [
    async ({}, use) => {
      // Use sandbox directory for tests by default
      const defaultRoot = path.join(process.cwd(), "tests", "sandbox");
      const workspaceRoot = process.env.CODEFREE_O_WORKSPACE_ROOT || defaultRoot;
      
      // Ensure sandbox directory exists
      if (!fs.existsSync(workspaceRoot)) {
        fs.mkdirSync(workspaceRoot, { recursive: true });
      }
      
      console.log(`[fixture] Starting CodeFree-O server in ${workspaceRoot}`);
      const server = await startCodeFreeOServer(workspaceRoot);
      console.log(`[fixture] CodeFree-O server started at ${server.url}`);
      
      // Wait for server to be fully ready
      await waitForServerReady(server.url);

      await use(server);

      // Cleanup: kill the server after tests
      console.log(`[fixture] Stopping CodeFree-O server`);
      server.process.kill("SIGTERM");
    },
    { scope: "worker" },
  ],

  openWebview: async ({ page, codefreeOServer }, use) => {
    const openWebview = async (config?: Partial<CodeFreeOConfig>) => {
      const defaultRoot = path.join(process.cwd(), "tests", "sandbox");
      const workspaceRoot = process.env.CODEFREE_O_WORKSPACE_ROOT || defaultRoot;
      
      const defaultConfig: CodeFreeOConfig = {
        serverUrl: codefreeOServer.url,
        workspaceRoot,
      };

      const finalConfig = { ...defaultConfig, ...config };
      
      // If custom codefree-o config is provided, write it to the sandbox
      if (finalConfig.codefreeOConfig) {
        const configPath = path.join(workspaceRoot, "codefree.json");
        fs.writeFileSync(configPath, JSON.stringify(finalConfig.codefreeOConfig, null, 2));
        console.log(`[fixture] Wrote custom codefree.json to ${configPath}`);
      }
      
      console.log(`[fixture] Opening webview with config:`, { 
        ...finalConfig, 
        codefreeOConfig: finalConfig.codefreeOConfig ? "custom" : "default" 
      });

      // Set up route to inject config before page loads
      await page.route("**/standalone.html", async (route) => {
        const response = await route.fetch();
        let html = await response.text();
        
        // Replace the default config with our dynamic config
        html = html.replace(
          /window\.CODEFREE_O_CONFIG\s*=\s*\{[^}]+\}/,
          `window.CODEFREE_O_CONFIG = ${JSON.stringify(finalConfig)}`
        );
        
        await route.fulfill({
          response,
          body: html,
          headers: {
            ...response.headers(),
            "content-type": "text/html",
          },
        });
      });

      // Navigate to the standalone HTML page
      await page.goto("/src/webview/standalone.html");

      // Wait for the app to be ready (message log container)
      await page.waitForSelector('[role="log"]', { timeout: 10000 });

      return page;
    };

    await use(openWebview);
  },

  serverLogs: async ({ codefreeOServer }, use) => {
    await use(codefreeOServer.logs);
  },

  getServerLogs: async ({ codefreeOServer }, use) => {
    await use(codefreeOServer.getLogs);
  },

  searchServerLogs: async ({ codefreeOServer }, use) => {
    await use(codefreeOServer.searchLogs);
  },

  getServerLogEntries: async ({ codefreeOServer }, use) => {
    await use(codefreeOServer.getLogEntries);
  },

  searchServerLogEntries: async ({ codefreeOServer }, use) => {
    await use(codefreeOServer.searchLogEntries);
  },
});

export { expect } from "@playwright/test";
export type { LogEntry };
