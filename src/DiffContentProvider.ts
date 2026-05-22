import * as vscode from "vscode";

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  private contentMap = new Map<string, string>();

  static readonly SCHEME = "codefree-o-diff";

  storeContent(side: "before" | "after", key: string, content: string, fileName: string): vscode.Uri {
    const storageKey = `${side}:${key}:${encodeURIComponent(fileName)}`;
    this.contentMap.set(storageKey, content);
    return vscode.Uri.parse(`${DiffContentProvider.SCHEME}:${storageKey}`);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentMap.get(uri.path) ?? "";
  }

  dispose(): void {
    this.contentMap.clear();
  }
}
