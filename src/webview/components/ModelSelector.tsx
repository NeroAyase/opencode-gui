import type { ModelSelection } from "../utils/modelResolution";
import { getShortModelName } from "../utils/modelResolution";
import { vscode } from "../utils/vscode";

interface ModelSelectorProps {
  currentModel: ModelSelection | null;
  onModelSelect: (providerID: string, modelID: string) => void;
}

export function ModelSelector(props: ModelSelectorProps) {
  const handleClick = () => {
    // Send message to extension host to open QuickPick
    vscode.postMessage({ type: "select-model" });
  };

  const displayLabel = () => {
    const model = props.currentModel;
    if (!model) return "Model";
    return getShortModelName(model.modelID);
  };

  return (
    <button
      type="button"
      class="model-selector-button"
      onClick={handleClick}
      aria-label="Select model"
      title={props.currentModel ? `${props.currentModel.providerID}/${props.currentModel.modelID}` : "Select model"}
    >
      {displayLabel()}
    </button>
  );
}
