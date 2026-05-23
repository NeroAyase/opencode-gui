import { Show } from "solid-js";
import { SessionSwitcher } from "./SessionSwitcher";
import { NewSessionButton } from "./NewSessionButton";
import type { Session } from "../types";
import type { SessionStatus } from "../state/types";
import { useSync } from "../state/sync";
import { vscode } from "../utils/vscode";

interface TopBarProps {
  sessions: Session[];
  currentSessionId: string | null;
  currentSessionTitle: string;
  sessionStatus: (sessionId: string) => SessionStatus | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onRefreshSessions: () => Promise<void>;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => void;
}

export function TopBar(props: TopBarProps) {
  const sync = useSync();

  const handleShare = () => {
    const sessionId = sync.currentSessionId();
    if (!sessionId) return;
    vscode.postMessage({
      type: "session-share",
      sessionID: sessionId,
    });
  };

  return (
    <div class="top-bar">
      <SessionSwitcher
        sessions={props.sessions}
        currentSessionId={props.currentSessionId}
        currentSessionTitle={props.currentSessionTitle}
        sessionStatus={props.sessionStatus}
        onSessionSelect={props.onSessionSelect}
        onRefreshSessions={props.onRefreshSessions}
        onDeleteSession={props.onDeleteSession}
        onRenameSession={props.onRenameSession}
      />
      <Show when={props.currentSessionId}>
        <button
          type="button"
          class="share-button"
          title="Share session"
          onClick={handleShare}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M12.5 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-1.726.224A3.5 3.5 0 1 1 13.5 7.874V9.5a.5.5 0 0 1-1 0V7.874a3.5 3.5 0 0 1-1.726-5.15zM3.5 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-1.726.224A3.5 3.5 0 1 1 4.5 11.874V13.5a.5.5 0 0 1-1 0v-1.626A3.5 3.5 0 0 1 1.774 6.224z"/></svg>
        </button>
      </Show>
      <NewSessionButton onClick={props.onNewSession} />
    </div>
  );
}
