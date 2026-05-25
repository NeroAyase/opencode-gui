import { createSignal, createMemo, Show, onMount, onCleanup, createEffect, For } from "solid-js";
import { InputBar } from "./components/InputBar";
import { QuestionDock } from "./components/QuestionDock";
import { TodoDock } from "./components/TodoDock";
import type { CommandItem } from "./components/CommandPalette";
import { MessageList } from "./components/MessageList";
import { TopBar } from "./components/TopBar";
import { ContextIndicator } from "./components/ContextIndicator";
import { FileChangesSummary } from "./components/FileChangesSummary";
import { PermissionPrompt } from "./components/PermissionPrompt";
import { useCodeFreeO } from "./hooks/useCodeFreeO";
import { useAutoAccept } from "./hooks/useAutoAccept";
import { useSessionDrafts } from "./hooks/useSessionDrafts";
import { useAttachments, type SelectionAttachment } from "./hooks/useAttachments";
import { useMentionInsertion } from "./hooks/useMentionInsertion";
import { useMessageQueue, type QueuedMessage } from "./hooks/useMessageQueue";
import { usePromptSend } from "./hooks/usePromptSend";
import { useSync } from "./state/sync";
import type { Message, Agent, Session, Permission, Model } from "./types";
import { parseHostMessage } from "./types";
import type { ModelSelection } from "./utils/modelResolution";

import { vscode } from "./utils/vscode";
import { logger } from "./utils/logger";

function App() {
  // Use the sync context for server-owned state
  const sync = useSync();
  
  // Auto-accept toggle for permissions
  const autoAccept = useAutoAccept();
  
  const mentionHook = useMentionInsertion();
  
  const { sessionKey, input, setInput, clearDraftContent } = useSessionDrafts(
    () => sync.currentSessionId(),
    mentionHook.editorMethods,
  );
  
  const {
    selectionAttachments,
    setSelectionAttachments,
    setSelectionAttachmentsForKey,
    imageAttachments,
    setImageAttachmentsBySession,
    handleImagePaste,
    attachmentChips,
    handleRemoveAttachment,
    buildSelectionParts,
    buildImageParts,
    buildWorkspaceFileUrl,
    getFilename,
    formatSelectionLabel,
  } = useAttachments(sessionKey, sync.workspaceRoot);
  
  // Get SDK hook for actions only
  const {
    initData,
    createSession,
    abortSession,
    sendPrompt,
    sendCommand,
    getCommands,
    getProviders,
    respondToPermission,
    revertToMessage,
    hostError,
    clearHostError,
  } = useCodeFreeO();
  
  // Local UI-only state
  const [defaultAgent, setDefaultAgent] = createSignal<string | null>(null);
  const [sessionAgents, setSessionAgents] = createSignal<Map<string, string>>(new Map());
  const [selectedModel, setSelectedModel] = createSignal<ModelSelection | null>(null);
  const [providers, setProviders] = createSignal<Array<{ id: string; name: string; models: Model[] }>>([]);

  // Check if the current model supports image attachments
  const supportsImagePaste = createMemo(() => {
    const model = selectedModel();
    if (!model) return true; // Default to allowing paste if no model selected
    const allProviders = providers();
    for (const provider of allProviders) {
      if (provider.id !== model.providerID) continue;
      const modelData = provider.models.find((m) => m.id === model.modelID);
      if (!modelData) continue;
      const caps = modelData.capabilities;
      if (!caps) return true; // If no capability info, allow paste
      return caps.attachment && caps.input.image;
    }
    return true; // Model not found in providers, default to allowing
  });

  // Editing state for previous messages
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editingText, setEditingText] = createSignal<string>("");

  // Slash commands
  const [commands, setCommands] = createSignal<CommandItem[]>([]);

  // Derive current session title from store
  const isDefaultTitle = (title: string) => /^(New session|Child session) - \d{4}-\d{2}-\d{2}T/.test(title);
  const currentSessionTitle = createMemo(() => {
    const id = sync.currentSessionId();
    if (!id) return "New Session";
    const sessions = sync.sessions();
    const session = sessions.find(s => s.id === id);
    const title = session?.title;
    return title && !isDefaultTitle(title) ? title : "New Session";
  });

  // Current agent for the active session.
  // New-session mode always uses the global default; existing sessions can override it.
  const selectedAgent = () => {
    const sessionId = sync.currentSessionId();
    return sessionId ? sessionAgents().get(sessionId) || defaultAgent() : defaultAgent();
  };
  const setSelectedAgent = (agent: string | null) => {
    if (!agent) return;
    const sessionId = sync.currentSessionId();
    if (!sessionId) {
      // In new-session mode, agent choice defines the default for subsequent sessions.
      setDefaultAgent(agent);
      return;
    }
    setSessionAgents((prev) => {
      const next = new Map(prev);
      next.set(sessionId, agent);
      return next;
    });
  };
  
  // Message queue hook
  const {
    messageQueue,
    inFlightMessage,
    setInFlightMessage,
    setMessageQueue,
    processNextQueuedMessage,
    handleQueueMessage,
    handleRemoveFromQueue,
    handleEditQueuedMessage,
  } = useMessageQueue({
    sync,
    sendPrompt,
    selectedModel,
    selectedAgent,
    agents: sync.agents,
    input,
    setInput,
    clearDraftContent,
    sessionKey,
    editorMethods: mentionHook.editorMethods,
    selectionAttachments,
    setSelectionAttachments,
    setSelectionAttachmentsForKey,
    buildSelectionParts,
    setSelectedAgent,
  });

  // Convenience accessors from sync store
  // Use the sync memos directly (not wrapped in functions) to maintain reactivity
  const messages = sync.messages;
  const agents = sync.agents;
  const sessions = sync.sessions;
  const pendingPermissions = sync.aggregatedPermissions;
  const questions = sync.questions;
  const todos = sync.todos;
  const contextInfo = sync.contextInfo;
  const fileChanges = sync.fileChanges;
  const isThinking = sync.isThinking;
  const sessionError = sync.sessionError;


  const openFileFromMention = (filePath: string) => {
    const workspaceRoot = sync.workspaceRoot();
    if (!workspaceRoot) {
      logger.error("Cannot open mention: workspace root unavailable", { filePath });
      return;
    }
    vscode.postMessage({
      type: "open-file",
      url: buildWorkspaceFileUrl(workspaceRoot, filePath),
    });
  };


  const hasMessages = createMemo(() =>
    messages().some((m) => m.type === "user" || m.type === "assistant")
  );

  // Find permissions that should show as standalone modals (not inline with tools)
  const standalonePermissions = createMemo(() => {
    const result: Permission[] = [];
    for (const [, perm] of pendingPermissions().entries()) {
      if (!perm.tool) {
        result.push(perm);
      }
    }
    return result;
  });

  const sessionsToShow = createMemo(() => {
    const root = sync.workspaceRoot();
    const currentId = sync.currentSessionId();
    
    return sessions()
      .filter(s => {
        // Only list sessions with primary agents (no parentID)
        if (s.parentID) return false;
        
        // Filter to sessions in the same repo/worktree
        if (root && s.directory !== root) return false;
        
        return true;
      })
      // Sort by edited time (updated) instead of started time (created)
      .sort((a, b) => b.time.updated - a.time.updated);
  });


  onMount(() => {
    const handleHostMessage = (event: MessageEvent) => {
      const parsed = parseHostMessage(event.data);
      if (!parsed) return;

      if (parsed.type === "editor-selection") {
        mentionHook.focusEditorOrQueue();
        const normalizedRange = mentionHook.normalizeSelectionRange(
          parsed.selection?.startLine,
          parsed.selection?.endLine
        );
        mentionHook.insertMentionOrQueue({
          filePath: parsed.filePath,
          startLine: normalizedRange.startLine,
          endLine: normalizedRange.endLine,
        });
        return;
      }

      if (parsed.type === "agent-selected") {
        setSelectedAgent(parsed.agent);
        return;
      }

      if (parsed.type === "model-selected") {
        setSelectedModel({ providerID: parsed.providerID, modelID: parsed.modelID });
        return;
      }

      if (parsed.type === "session-forked") {
        sync.setCurrentSessionId(parsed.sessionID);
        sync.setSessionError(parsed.sessionID, null);
        void sync.bootstrap();
        return;
      }

      if (parsed.type === "session-reverted") {
        void sync.bootstrap();
        return;
      }

      if (parsed.type === "session-deleted") {
        const deletedId = parsed.sessionID;
        const currentId = sync.currentSessionId();
        if (currentId === deletedId) {
          const remaining = sync.sessions().filter(s => s.id !== deletedId);
          if (remaining.length > 0) {
            sync.setCurrentSessionId(remaining[0].id);
          } else {
            sync.setCurrentSessionId(null);
          }
        }
        void sync.bootstrap();
        return;
      }

      if (parsed.type === "session-renamed") {
        void sync.bootstrap();
        return;
      }
    };

    window.addEventListener("message", handleHostMessage);
    onCleanup(() => window.removeEventListener("message", handleHostMessage));
  });

  // Set default agent from initData once available
  createEffect(() => {
    const init = initData();
    if (!init) return;
    
    const agentList = agents();
    const persistedDefault = init.defaultAgent;
    if (persistedDefault && agentList.some(a => a.name === persistedDefault)) {
      setDefaultAgent(persistedDefault);
    } else if (!defaultAgent() && agentList.length > 0) {
      setDefaultAgent(agentList[0].name);
    }
  });

  // Fetch slash commands and providers once the client is ready
  createEffect(() => {
    if (!sync.isReady()) return;
    getCommands()?.then((result) => {
      if (result?.data) {
        const cmds = result.data as Array<{ name: string; description?: string }>;
        setCommands(cmds.map((cmd) => ({ name: cmd.name, description: cmd.description })));
      }
    }).catch((err) => {
      logger.error("Failed to fetch commands", { error: err });
    });
    getProviders()?.then((result) => {
      if (result?.data) {
        const providerList = result.data.all.map((p) => ({
          id: p.id,
          name: p.name,
          models: Object.values(p.models).map((m) => ({
            id: m.id,
            name: m.name,
            providerID: m.providerID,
            capabilities: m.capabilities ? {
              attachment: m.capabilities.attachment,
              reasoning: m.capabilities.reasoning,
              temperature: m.capabilities.temperature,
              toolcall: m.capabilities.toolcall,
              input: {
                text: m.capabilities.input.text,
                audio: m.capabilities.input.audio,
                image: m.capabilities.input.image,
                video: m.capabilities.input.video,
                pdf: m.capabilities.input.pdf,
              },
              output: {
                text: m.capabilities.output.text,
                audio: m.capabilities.output.audio,
                image: m.capabilities.output.image,
                video: m.capabilities.output.video,
                pdf: m.capabilities.output.pdf,
              },
            } : undefined,
          })),
        }));
        setProviders(providerList);
      }
    }).catch((err) => {
      logger.error("Failed to fetch providers", { error: err });
    });
  });

  // Prompt send hook
  const { handleSubmit, handleCommandSelect, handleSubmitEdit } = usePromptSend({
    sync,
    sendPrompt,
    sendCommand,
    revertToMessage,
    createSession,
    selectedModel,
    selectedAgent,
    agents,
    input,
    setInput,
    clearDraftContent,
    sessionKey,
    editorMethods: mentionHook.editorMethods,
    selectionAttachments,
    setSelectionAttachmentsForKey,
    imageAttachments,
    setImageAttachmentsBySession,
    buildSelectionParts,
    buildImageParts,
    buildWorkspaceFileUrl,
    setInFlightMessage,
    editingMessageId,
    setEditingMessageId,
    setEditingText,
  });

  const handleSessionSelect = async (sessionId: string) => {
    if (!sync.isReady()) return;
    
    // Clear local UI state
    setMessageQueue([]);
    setInFlightMessage(null);
    setEditingMessageId(null);
    setEditingText("");
    
    // Set session and bootstrap to load messages
    sync.setCurrentSessionId(sessionId);
    sync.setSessionError(sessionId, null);
    await sync.bootstrap();
  };

  const handleNewSession = async () => {
    if (!sync.isReady()) return;
    try {
      const res = await createSession();
      const newSession = res?.data as Session | undefined;
      if (!newSession?.id) return;

      // Clear local UI state
      setMessageQueue([]);
      setInFlightMessage(null);
      setEditingMessageId(null);
      setEditingText("");
      
      // Set new session and bootstrap
      sync.setCurrentSessionId(newSession.id);
      sync.setSessionError(newSession.id, null);
      await sync.bootstrap();
    } catch (err) {
      logger.error("Failed to create session:", { error: err });
    }
  };

  const handleCancel = async () => {
    const sessionId = sync.currentSessionId();
    if (!sync.isReady() || !sessionId) return;
    try {
      await abortSession(sessionId);
    } finally {
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
    }
  };

  const handleAgentChange = (agent: string | null) => {
    setSelectedAgent(agent);
    // Persist as global default for new sessions
    if (agent && !sync.currentSessionId()) {
      vscode.postMessage({ type: "agent-changed", agent });
    }
  };

  const handleModelSelect = (providerID: string, modelID: string) => {
    setSelectedModel({ providerID, modelID });
  };

  const handleStartEdit = (messageId: string, text: string) => {
    setEditingMessageId(messageId);
    setEditingText(text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handlePermissionResponse = async (
    permissionId: string,
    response: "once" | "always" | "reject"
  ) => {
    const perms = pendingPermissions();
    let permission: Permission | undefined;
    for (const [, perm] of perms.entries()) {
      if (perm.id === permissionId) {
        permission = perm;
        break;
      }
    }

    const sessionId = permission?.sessionID || sync.currentSessionId();
    if (!sessionId || !sync.isReady()) {
      logger.error("Cannot respond to permission: no session ID");
      return;
    }

    await respondToPermission(sessionId, permissionId, response);
    // Permission removal is handled by store via SSE events
  };

  // Auto-accept: when enabled, automatically respond "once" to new permissions
  createEffect(() => {
    if (!autoAccept.isEnabled()) return;
    const perms = pendingPermissions();
    for (const [, perm] of perms.entries()) {
      if (perm && !perm.always?.length) {
        const sessionId = perm.sessionID || sync.currentSessionId();
        if (sessionId && sync.isReady()) {
          respondToPermission(sessionId, perm.id, "once");
        }
      }
    }
  });

  // Refresh sessions - just re-bootstrap
  const refreshSessions = async () => {
    await sync.bootstrap();
  };

  const handleDeleteSession = (sessionId: string) => {
    vscode.postMessage({ type: "session-delete", sessionID: sessionId });
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    vscode.postMessage({ type: "session-rename", sessionID: sessionId, title });
  };

  return (
    <div class={`app ${hasMessages() ? "app--has-messages" : ""}`}>
      <Show when={hostError()}>
        <div class="error-banner">
          <span class="error-banner__message">{hostError()}</span>
          <button class="error-banner__dismiss" onClick={clearHostError} aria-label="Dismiss error">×</button>
        </div>
      </Show>
      
      <TopBar
        sessions={sessionsToShow()}
        currentSessionId={sync.currentSessionId()}
        currentSessionTitle={currentSessionTitle()}
        sessionStatus={sync.sessionStatus}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onRefreshSessions={refreshSessions}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <MessageList
        messages={messages()}
        isThinking={isThinking()}
        workspaceRoot={sync.workspaceRoot()}
        pendingPermissions={pendingPermissions}
        onPermissionResponse={handlePermissionResponse}
        editingMessageId={editingMessageId()}
        editingText={editingText()}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSubmitEdit={handleSubmitEdit}
        onEditTextChange={setEditingText}
        sessionError={sessionError()}
      />

      <Show when={hasMessages()}>
        <div class="input-divider" />
        <div class="input-status-row">
          <FileChangesSummary fileChanges={fileChanges()} />
          <ContextIndicator contextInfo={contextInfo()} />
        </div>
      </Show>

      <Show when={todos().length > 0}>
        <TodoDock todos={todos()} />
      </Show>

      <Show when={standalonePermissions().length > 0}>
        <div class="standalone-permissions">
          <For each={standalonePermissions()}>
            {(permission) => (
              <PermissionPrompt
                permission={permission}
                onResponse={handlePermissionResponse}
                workspaceRoot={sync.workspaceRoot()}
                autoAcceptEnabled={autoAccept.isEnabled()}
                onToggleAutoAccept={autoAccept.toggle}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={questions().length > 0} fallback={
        <InputBar
          value={input()}
          onInput={setInput}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onQueue={handleQueueMessage}
          disabled={!sync.isReady()}
          isThinking={isThinking()}
          selectedAgent={selectedAgent()}
          agents={agents()}
          onAgentChange={handleAgentChange}
          selectedModel={selectedModel()}
          onModelSelect={handleModelSelect}
          queuedMessages={messageQueue()}
          onRemoveFromQueue={handleRemoveFromQueue}
          onEditQueuedMessage={handleEditQueuedMessage}
          attachments={attachmentChips()}
          onRemoveAttachment={handleRemoveAttachment}
          onFileMentionClick={openFileFromMention}
          onImagePaste={handleImagePaste}
          supportsImagePaste={supportsImagePaste()}
          onImagePasteBlocked={() => {
            vscode.postMessage({
              type: "show-info",
              message: "Current model does not support image attachments.",
            });
          }}
          commands={commands()}
          onCommandSelect={handleCommandSelect}
          editorRef={mentionHook.handleEditorMethodsReady}
        />
      }>
        <QuestionDock
          questions={questions()}
          onReply={(requestID, answers) => sync.replyToQuestion(requestID, answers)}
          onReject={(requestID) => sync.rejectQuestion(requestID)}
          isReady={sync.isReady()}
        />
      </Show>
    </div>
  );
}

export default App;
