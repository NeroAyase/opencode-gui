/**
 * Integration tests that run INSIDE VSCode
 * These tests have access to the full VSCode API
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('CodeFree-O Extension Integration Tests', () => {
  vscode.window.showInformationMessage('Start integration tests.');

  test('Extension should be activated', async () => {
    // Get the extension
    const extension = vscode.extensions.getExtension('NeroAyase.codefree-o-vscode');
    assert.ok(extension, 'Extension should be installed');
    
    // Activate if not already active
    if (!extension.isActive) {
      await extension.activate();
    }
    
    assert.ok(extension.isActive, 'Extension should be active');
  });

  test('CodeFree-O command should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('codefree-o.addSelectionToPrompt'),
      'codefree-o.addSelectionToPrompt command should be registered'
    );
  });

  test('CodeFree-O view should be available', async () => {
    // Try to focus the CodeFree-O view
    await vscode.commands.executeCommand('workbench.view.extension.codefree-o');
    
    // Give it a moment to open
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // We can't easily check if the view is visible, but the command should execute without error
    assert.ok(true, 'CodeFree-O view command executed');
  });

  test('Should be able to execute addSelectionToPrompt command', async () => {
    // Create a test document
    const doc = await vscode.workspace.openTextDocument({
      content: 'test content',
      language: 'plaintext',
    });
    
    await vscode.window.showTextDocument(doc);
    
    // Execute the command
    await vscode.commands.executeCommand('codefree-o.addSelectionToPrompt');
    
    // Command should complete without error
    assert.ok(true, 'Command executed successfully');
  });
});
