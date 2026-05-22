import { For, Show } from "solid-js";
import { vscode } from "../utils/vscode";
import type { FileChangesInfo, FileDiff } from "../types";

interface FileChangesSummaryProps {
  fileChanges: FileChangesInfo | null;
}

export function FileChangesSummary(props: FileChangesSummaryProps) {
  const handleFileClick = (diff: FileDiff) => {
    vscode.postMessage({
      type: "open-diff",
      filePath: diff.file,
      patch: diff.patch,
    });
  };

  return (
    <Show when={props.fileChanges && props.fileChanges.fileCount > 0}>
      <div class="file-changes-list">
        <div class="file-changes-header">
          <span class="file-changes-title">Changes</span>
          <span class="file-changes-stats">
            +{props.fileChanges!.additions} -{props.fileChanges!.deletions}
          </span>
        </div>
        <Show
          when={props.fileChanges!.diffs && props.fileChanges!.diffs!.length > 0}
          fallback={
            <div class="file-changes-count">
              {props.fileChanges!.fileCount} file{props.fileChanges!.fileCount !== 1 ? "s" : ""} changed
            </div>
          }
        >
          <For each={props.fileChanges!.diffs}>
            {(diff) => (
              <div
                class="file-changes-item"
                onClick={() => handleFileClick(diff)}
                title="Click to open diff"
              >
                <span class="file-changes-name">{diff.file}</span>
                <span class="file-changes-diff-stats">
                  <span class="additions">+{diff.additions}</span>
                  <span class="deletions">-{diff.deletions}</span>
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </Show>
  );
}
