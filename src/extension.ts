import * as vscode from "vscode";
import { CodeFreeOService } from "./CodeFreeOService";
import { CodeFreeOViewProvider } from "./CodeFreeOViewProvider";
import { DiffContentProvider } from "./DiffContentProvider";
import type { HostMessage } from "./shared/messages";

let logger: vscode.LogOutputChannel;

export function getLogger(): vscode.LogOutputChannel {
  return logger;
}

export async function activate(context: vscode.ExtensionContext) {
  // Create log channel - VSCode manages file location and timestamps automatically
  logger = vscode.window.createOutputChannel("CodeFree-O", { log: true });
  context.subscriptions.push(logger);

  logger.info("CodeFree-O extension activated", {
    timestamp: new Date().toISOString(),
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    extensionPath: context.extensionPath,
  });

  // Create CodeFree-O service
  const codefreeOService = new CodeFreeOService();

  // Initialize CodeFree-O with workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  try {
    await codefreeOService.initialize(workspaceRoot);
    logger.info("CodeFree-O service initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize CodeFree-O service", error);
  }

  const diffProvider = new DiffContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DiffContentProvider.SCHEME, diffProvider)
  );

  const provider = new CodeFreeOViewProvider(
    context.extensionUri,
    codefreeOService,
    context.globalState,
    context.workspaceState,
    diffProvider
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeFreeOViewProvider.viewType,
      provider
    )
  );

  const addSelectionDisposable = vscode.commands.registerCommand(
    "codefree-o.addSelectionToPrompt",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("CodeFree-O: No active editor selection.");
        return;
      }

      const document = editor.document;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      const filePath = workspaceFolder
        ? vscode.workspace.asRelativePath(document.uri)
        : document.uri.fsPath;
      const fileUrl = document.uri.toString();

      const selection = editor.selection;
      const message: HostMessage = {
        type: "editor-selection",
        filePath,
        fileUrl,
        selection: selection.isEmpty
          ? undefined
          : {
              startLine: selection.start.line + 1,
              endLine: selection.end.line + 1,
            },
      };

      await vscode.commands.executeCommand("workbench.view.extension.codefree-o");
      provider.sendHostMessage(message);
    }
  );

  context.subscriptions.push(addSelectionDisposable);

  // Cleanup on deactivation
  context.subscriptions.push(codefreeOService);
  context.subscriptions.push(provider);

  logger.info("CodeFree-O webview provider registered");
}

export function deactivate() {
  logger?.info("CodeFree-O extension deactivated");
}
