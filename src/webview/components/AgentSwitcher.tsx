
import type { Agent } from "../types";
import { vscode } from "../utils/vscode";

interface AgentSwitcherProps {
  agents: Agent[];
  selectedAgent: string | null;
  onAgentChange: (agentName: string) => void;
}

export function AgentSwitcher(props: AgentSwitcherProps) {
  const currentAgent = () => {
    const name = props.selectedAgent;
    return props.agents.find(a => a.name === name);
  };
  
  const handleSelectAgent = () => {
    vscode.postMessage({ type: "select-agent" });
  };
  
  const agentColor = () => currentAgent()?.options?.color;
  
  return (
    <button
      type="button"
      class="agent-switcher-button"
      onClick={handleSelectAgent}
      aria-label="Switch agent"
      title={currentAgent()?.description || 'Switch agent'}
      style={agentColor() ? { color: agentColor() } : {}}
    >
      {currentAgent()?.name || 'Agent'}
    </button>
  );
}
