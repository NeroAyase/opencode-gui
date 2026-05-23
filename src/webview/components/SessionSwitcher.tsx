import { createSignal, Show, For, onCleanup } from "solid-js";
import type { Session } from "../types";
import type { SessionStatus } from "../state/types";

interface SessionSwitcherProps {
  sessions: Session[];
  currentSessionId: string | null;
  currentSessionTitle: string;
  sessionStatus: (sessionId: string) => SessionStatus | null;
  onSessionSelect: (sessionId: string) => void;
  onRefreshSessions: () => Promise<void>;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => void;
}

export function SessionSwitcher(props: SessionSwitcherProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [spinnerFrame, setSpinnerFrame] = createSignal(0);
  
  const spinnerFrames = ['\\', '|', '/', '-'];
  
  const spinnerInterval = setInterval(() => {
    setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length);
  }, 150);
  
  onCleanup(() => clearInterval(spinnerInterval));

  const toggleDropdown = () => {
    const shouldOpen = !isOpen();
    setIsOpen(shouldOpen);
    
    if (shouldOpen) {
      setIsLoading(true);
      props.onRefreshSessions().finally(() => {
        setIsLoading(false);
      });
    }
  };

  const handleSessionClick = (sessionId: string) => {
    props.onSessionSelect(sessionId);
    setIsOpen(false);
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  return (
    <div class="session-switcher">
      <button
        class={`session-switcher-button ${isOpen() ? "active" : ""}`}
        onClick={toggleDropdown}
        aria-label="Switch session"
        aria-expanded={isOpen()}
      >
        <span class="session-title">{props.currentSessionTitle}</span>
      </button>

      <Show when={isOpen()}>
        <div class="session-dropdown">
          <Show when={isLoading()}>
            <div class="session-loading">Loading sessions...</div>
          </Show>
          <Show when={!isLoading()}>
            <Show
              when={props.sessions.length > 0}
              fallback={
                <div class="session-loading">No sessions found</div>
              }
            >
              <For each={props.sessions}>
                {(session) => {
                  const status = () => props.sessionStatus(session.id);
                  const isBusy = () => status()?.type === "busy";
                  
                  return (
                    <div
                      class={`session-item ${
                        session.id === props.currentSessionId ? "current" : ""
                      }`}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <div class="session-item-title">
                        <Show when={isBusy()}>
                          <span class="loading-indicator session-status-indicator">
                            {spinnerFrames[spinnerFrame()]}
                          </span>
                        </Show>
                        {session.title}
                      </div>
                      <div class="session-item-time">
                        {formatRelativeTime(session.time.updated)}
                      </div>
                      <div class="session-item-actions">
                        <button
                          class="session-item-action-btn"
                          title="Rename session"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onRenameSession?.(session.id, session.title);
                          }}
                        >
                          <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor"><path d="M8.85 1.15a1.41 1.41 0 1 1 2 2L4.5 9.5 1.5 10.5 2.5 7.5 8.85 1.15zM7.44 2.56 3.29 6.71l-.59 2.18 2.18-.59L9.03 4.15 7.44 2.56zm1.82-.41-.7.7 1.59 1.59.7-.7a.41.41 0 0 0 0-.59l-1-1a.41.41 0 0 0-.59 0z"/></svg>
                        </button>
                        <button
                          class="session-item-action-btn"
                          title="Delete session"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onDeleteSession?.(session.id);
                          }}
                        >
                          <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0-.5.5V2H2.5a.5.5 0 0 0 0 1h.27l.34 7.13A1 1 0 0 0 4.11 11h3.78a1 1 0 0 0 1-.87L9.23 3H9.5a.5.5 0 0 0 0-1H7v-.5a.5.5 0 0 0-.5-.5h-1zM4.77 3h2.46l-.33 7H4.1L3.77 3h1zM5 4.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-1 0zm2 0v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-1 0z"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}
