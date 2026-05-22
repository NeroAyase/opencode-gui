import type { Agent } from "../types";

interface ModelSelection {
  providerID: string;
  modelID: string;
}

/**
 * Resolve the effective model using the priority chain:
 * 1. sessionModel (user's explicit per-session override)
 * 2. agent.model (the selected agent's default model)
 * 3. configuredModel (the workspace/global default)
 * 4. first available model from first provider
 */
export function resolveModel(
  agents: Agent[],
  selectedAgent: string | null,
  sessionModel: ModelSelection | null,
  configuredModel: ModelSelection | null,
  providers?: Array<{ id: string; models: Array<{ id: string; providerID: string }> }>,
): ModelSelection | null {
  // 1. Session override takes highest priority
  if (sessionModel) {
    return sessionModel;
  }

  // 2. Agent default model
  if (selectedAgent) {
    const agent = agents.find((a) => a.name === selectedAgent);
    if (agent && (agent as Agent & { model?: string }).model) {
      const modelStr = (agent as Agent & { model?: string }).model!;
      const slashIndex = modelStr.indexOf("/");
      if (slashIndex !== -1) {
        return {
          providerID: modelStr.substring(0, slashIndex),
          modelID: modelStr.substring(slashIndex + 1),
        };
      }
    }
  }

  // 3. Configured default
  if (configuredModel) {
    return configuredModel;
  }

  // 4. First available model from first provider
  if (providers && providers.length > 0) {
    const firstProvider = providers[0];
    if (firstProvider.models.length > 0) {
      const firstModel = firstProvider.models[0];
      return {
        providerID: firstModel.providerID,
        modelID: firstModel.id,
      };
    }
  }

  return null;
}

/**
 * Format a model selection as a human-readable label.
 * Returns "provider/model" format.
 */
export function formatModelLabel(providerID: string, modelID: string): string {
  return `${providerID}/${modelID}`;
}

/**
 * Get a short display name for a model.
 * Returns the last segment of the modelID (e.g. "claude-3.5-sonnet" from "anthropic/claude-3.5-sonnet").
 * If the modelID doesn't contain a slash, returns the full modelID.
 */
export function getShortModelName(modelID: string): string {
  const slashIndex = modelID.lastIndexOf("/");
  if (slashIndex !== -1) {
    return modelID.substring(slashIndex + 1);
  }
  return modelID;
}

export type { ModelSelection };
