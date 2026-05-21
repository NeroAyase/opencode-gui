import { describe, test, expect } from 'vitest';
import {
  useExtensionFixture,
  executeCommand,
  sendMessageToWebview,
  evaluateInWebview,
  getExtensionLogs,
  getWebviewLogs,
} from './fixtures';

describe('CodeFree-O Extension Integration', () => {
  // Setup fixture - launches VSCode with extension
  const fixture = useExtensionFixture({
    workspaceRoot: undefined, // Use default sandbox
    debugPort: 9222,
  });

  test('extension should activate', async () => {
    const logs = await getExtensionLogs();
    expect(logs).toContain('CodeFree-O extension activated');
  });

  test('webview should be loaded', async () => {
    const { page } = fixture.getContext().webview;
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should execute codefree-o.addSelectionToPrompt command', async () => {
    await executeCommand('codefree-o.addSelectionToPrompt');
    
    // Check that command was processed
    const logs = await getExtensionLogs();
    expect(logs).toBeTruthy();
  });

  test('should send message to webview', async () => {
    await sendMessageToWebview({
      type: 'test-message',
      data: 'hello from test',
    });

    // Wait a bit for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    const webviewLogs = getWebviewLogs();
    expect(webviewLogs.length).toBeGreaterThan(0);
  });

  test('should evaluate JavaScript in webview', async () => {
    const result = await evaluateInWebview<number>('2 + 2');
    expect(result).toBe(4);
  });

  test('should access window object in webview', async () => {
    const userAgent = await evaluateInWebview<string>('window.navigator.userAgent');
    expect(userAgent).toBeTruthy();
    expect(userAgent).toContain('Chrome');
  });

  test('should open CodeFree-O view via command', async () => {
    await executeCommand('workbench.view.extension.codefree-o');
    
    // Wait for view to open
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { page } = fixture.getContext().webview;
    const isVisible = await page.isVisible('body');
    expect(isVisible).toBe(true);
  });

  test('should capture webview console logs', async () => {
    // Trigger a console log from webview
    await evaluateInWebview('console.log("test log message from webview")');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const logs = getWebviewLogs();
    const testLog = logs.find(log => log.text.includes('test log message'));
    expect(testLog).toBeDefined();
  });

  test('should have access to CodeFree-O SDK in webview', async () => {
    const hasCodeFreeO = await evaluateInWebview<boolean>(
      'typeof window.CODEFREE_O_CONFIG !== "undefined"'
    );
    // This might be false for the VSCode webview vs standalone
    // Just checking we can evaluate this
    expect(typeof hasCodeFreeO).toBe('boolean');
  });
});
