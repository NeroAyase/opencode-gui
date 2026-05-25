# Tier 3.2: @-Mentions Expansion — Implementation Plan

## 1. Existing Data Flow

### 1.1 File @-Mention Flow (Current)

```
User types "@"
  -> FileMention.ts (Tiptap Mention extension, name="fileMention", trigger char="@")
  -> fileMentionSuggestion.ts (Suggestion plugin, 200ms debounce)
  -> InputBar.tsx: searchFiles() -> "search-files" WebviewMessage
  -> CodeFreeOViewProvider.ts: _handleSearchFiles() -> git ls-files
  -> "search-files-result" HostMessage -> FileMentionDropdown.tsx
  -> User selects file -> Tiptap inserts <span data-type="fileMention" data-path="...">
  -> On send: TiptapEditor.getJSON() -> editorContent.extractMentions()
  -> Walks Tiptap JSON for node.type === "mention" | "fileMention", collects node.attrs.id
  -> usePromptSend.handleSubmit(): mentions -> parseFileMentionReference() -> SelectionAttachment[]
  -> buildSelectionParts() -> FilePartInput[] -> sendPrompt(sessionId, text, agent, extraParts)
```

### 1.2 Slash Command Flow (Current)

```
User types "/" at line start (parentOffset === 1)
  -> SlashCommand.ts (Tiptap Extension, name="slashCommand", trigger char="/")
  -> CommandPalette.tsx (SolidJS dropdown)
  -> User selects command -> onCommandSelect callback
  -> TiptapEditor deletes "/" range, calls onCommandSelect
  -> InputBar.tsx -> usePromptSend.handleCommandSelect()
  -> sendCommand(sessionId, command.name)
  -> CodeFreeOViewProvider.ts: _handleCommandExecute()
  -> client.session.command({ sessionID, command, arguments, agent, model })
```

### 1.3 Key Architectural Observations

- File mentions and slash commands are **separate Tiptap extensions** with separate trigger chars, dropdowns, and send paths.
- File mentions embed as inline nodes in the editor; slash commands delete the trigger and execute immediately.
- `extractMentions()` only collects `id` strings from Tiptap JSON — no type discrimination.
- The send path for file mentions goes through `sendPrompt()` with `FilePartInput[]`; the send path for slash commands goes through `sendCommand()` with `{ command, arguments }`.
- The SDK `session.prompt()` accepts `parts: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>`.
- The SDK `session.command()` accepts `{ command, arguments, agent?, model?, parts?: FilePartInput[] }`.

## 2. Available vs Missing SDK APIs

### 2.1 Available APIs

| API | Return Type | Status | Notes |
|-----|-------------|--------|-------|
| `client.app.agents()` | `Agent[]` | Available, already used in project | `{ name, description?, mode: "subagent"|"primary"|"all", native?, hidden?, color?, model?, variant?, prompt?, options, steps? }` |
| `client.app.skills()` | `Array<{ name, description, location, content }>` | Available in SDK types, NOT yet used in project | Returns flat list. `location` is file path, `content` is markdown body. **Requires runtime verification before implementation** — see 2.3. |
| `client.command.list()` | `Command[]` | Available, already used in project | `{ name, description?, agent?, model?, source?: "command"|"mcp"|"skill", template, subtask?, hints: string[] }` |
| `client.session.prompt()` | — | Available, already used in project | `parts: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>` |
| `client.session.command()` | — | Available, already used in project | `{ command, arguments, agent?, model?, parts?: FilePartInput[] }` |

### 2.2 SDK Part Types for Send-Time Conversion

```typescript
// Already used in project
type FilePartInput = {
  id?: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
};

// Available in SDK types, NOT yet used in project — key enabler for @-agent mentions
type AgentPartInput = {
  id?: string;
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
};

// Available in SDK types, NOT yet used in project — for sub-agent delegation (deferred)
type SubtaskPartInput = {
  id?: string;
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
};
```

### 2.3 Missing APIs / Blockers / Verification Steps

| Item | Status | Impact | Action Required |
|------|--------|--------|-----------------|
| Skill execution API | **NO dedicated skill execution endpoint** | Skills are invoked via `session.command()` where `Command.source === "skill"`. No separate `client.session.skill()` exists. | No action — skill execution via `/` commands is the existing path. |
| Skill-to-command mapping | **Implicit** | `client.command.list()` returns commands with `source: "skill"`, providing the bridge. | No action — mapping is derivable. |
| Sub-agent direct invocation | **Partial** | `SubtaskPartInput` exists in `session.prompt()` but requires `prompt` and `description` fields that the user would need to provide. `AgentPartInput` is simpler — just `name`. | Deferred to future tier. |
| `client.app.skills()` runtime behavior | **Unverified** | This API is declared in SDK types but has never been called from the project. Return shape, latency, error behavior, and empty-state handling are all unconfirmed. | **Verification step required before Phase 2 implementation**: call `client.app.skills()` from host, log the response, confirm the `Array<{ name, description, location, content }>` shape matches at runtime. If the API fails or returns unexpected data, mark skill dropdown as blocked and proceed with file + agent mentions only. |

**Conclusion**: No hard blockers for the core scope (file + agent mentions). Skill mention support is conditional on `client.app.skills()` runtime verification. Command execution remains exclusively on the `/` trigger.

## 3. Typed Mention Item Union Design

### 3.1 Current Types

```typescript
// FileMentionDropdown.tsx
interface FileItem {
  path: string;
  name: string;
}

// CommandPalette.tsx
interface CommandItem {
  name: string;
  description?: string;
}
```

### 3.2 Proposed Union Type

```typescript
// New file: src/webview/types/mention.ts

// Tier 3.2 scope: file and agent mentions only.
// Skill mentions are reference-only (no auto-execution).
// Command mentions are out of scope for @-trigger (commands use / trigger).

type MentionKind = "file" | "agent" | "skill";

interface BaseMentionItem {
  kind: MentionKind;
  id: string;          // Unique identifier for Tiptap node attrs.id
  label: string;       // Display text in dropdown and inline
  description?: string; // Secondary text in dropdown
}

interface FileMentionItem extends BaseMentionItem {
  kind: "file";
  filePath: string;    // Full workspace-relative path
  startLine?: number;
  endLine?: number;
}

interface AgentMentionItem extends BaseMentionItem {
  kind: "agent";
  agentName: string;   // SDK Agent.name
  mode: "subagent" | "primary" | "all";
}

interface SkillMentionItem extends BaseMentionItem {
  kind: "skill";
  skillName: string;   // SDK Skill.name
  location: string;    // Skill file path
  // NOTE: No commandName field. @-skill is a reference, not an execution trigger.
  // Skill execution is via / command only.
}

type MentionItem = FileMentionItem | AgentMentionItem | SkillMentionItem;
```

**Why `CommandMentionItem` is excluded from the @-mention union**: The `/` trigger and `@` trigger serve fundamentally different user intents. `/` means "execute a command"; `@` means "reference or attach context". Mixing command execution into the `@` flow would violate this separation. Commands remain exclusively on the `/` trigger via the existing `SlashCommand` extension and `CommandPalette`. The `Command.source` schema (including `source: "skill"`) is documented here for reference but is not part of the @-mention implementation.

### 3.3 Tiptap Node Schema Extension

Current file mention node:
```typescript
{ type: "fileMention", attrs: { id: string, label: string } }
```

Proposed approach — **compatible extension, not replacement**:

```typescript
// New node type for agent and skill mentions
{ type: "mention", attrs: { id: string, label: string, kind: MentionKind } }

// Existing fileMention node remains unchanged for backward compatibility
{ type: "fileMention", attrs: { id: string, label: string } }
```

**Design decision**: Keep `fileMention` as a separate node type rather than migrating it to the generic `mention` type. Rationale:
1. Existing sessions may contain `fileMention` nodes in draft content. Changing the node type would break deserialization.
2. `extractMentions()` already handles both `"mention"` and `"fileMention"` node types.
3. The `FileMention` Tiptap extension and `fileMentionSuggestion.ts` continue to work unchanged for file mentions.
4. New mention kinds (agent, skill) use the generic `mention` node type with `kind` attr.
5. Migration of `fileMention` to `mention` can happen in a future cleanup phase after test coverage is complete.

**ID encoding**: `attrs.id` uses a prefixed format for new mention kinds: `agent:<name>`, `skill:<name>`. File mentions keep their existing `attrs.id` format (the file path, unprefixed) for backward compatibility.

## 4. Mention Insertion Syntax

### 4.1 Trigger Characters

| Mention Kind | Trigger | Rationale |
|-------------|---------|-----------|
| File | `@` | Existing behavior, unchanged |
| Agent | `@` | Same trigger, different category in dropdown |
| Skill | `@` | Same trigger, different category in dropdown (reference only) |
| Command | `/` | Existing behavior, unchanged — commands remain on `/` trigger |

**Key constraint**: Slash commands and @-mentions are separate protocols. Commands stay on `/` trigger at line start; @-mentions (files, agents, skills) share the `@` trigger. `@` means "reference/attach context"; `/` means "execute a command".

### 4.2 Dropdown Grouping

When `@` is typed, the dropdown shows grouped results:

```
@
├── Files
│   ├── src/extension.ts
│   └── src/webview/App.tsx
├── Agents
│   ├── codefree-o (primary)
│   └── explore (subagent)
└── Skills
    ├── playwright
    └── review
```

### 4.3 Inline Rendering

After selection, the mention renders as a styled chip:

```
@src/extension.ts    →  <span data-type="fileMention" data-path="...">src/extension.ts</span>  (unchanged)
@explore             →  <span data-type="mention" data-kind="agent" data-id="agent:explore">explore</span>
@playwright          →  <span data-type="mention" data-kind="skill" data-id="skill:playwright">playwright</span>
```

## 5. Send-Time Conversion to SDK Payload

### 5.1 Current Conversion (File Mentions Only)

```
extractMentions(json) → string[] (file paths)
→ parseFileMentionReference() → FileMentionReference[]
→ SelectionAttachment[] → buildSelectionParts() → FilePartInput[]
→ sendPrompt(sessionId, text, agent, extraParts)
```

### 5.2 Proposed Conversion (Tier 3.2 Scope)

```
extractMentions(json) → MentionRef[] (kind + id pairs)
→ Switch on kind:
  ├── "file"    → parseFileMentionReference() → SelectionAttachment → FilePartInput (existing path, unchanged)
  ├── "agent"   → AgentPartInput { type: "agent", name: agentName, source: { value, start, end } }
  └── "skill"   → Deferred: insert as reference only, no automatic sendCommand()
→ Collect into promptParts: Array<TextPartInput | FilePartInput | AgentPartInput>
→ sendPrompt(sessionId, text, agent, promptParts, messageID, model)
```

### 5.3 Send Path Decision Logic

```typescript
// Pseudocode for handleSubmit
const mentionRefs = extractMentions(editorJSON);

const promptParts: PartInput[] = [];

for (const ref of mentionRefs) {
  switch (ref.kind) {
    case "file":
      promptParts.push(...buildFileParts(ref));
      break;
    case "agent":
      promptParts.push({
        type: "agent",
        name: ref.agentName,
        source: ref.source,
      });
      break;
    case "skill":
      // Tier 3.2: skill mentions are references only.
      // No automatic sendCommand(). The skill name is included
      // as contextual metadata in the prompt text.
      // Skill execution via / command remains the existing path.
      break;
  }
}

await sendPrompt(sessionId, text, agent, promptParts, messageID, model);
```

### 5.4 Skill Mention Handling — Two-Phase Approach

**Phase 3.2 (initial)**: `@skill` inserts a reference chip into the editor. At send time, the skill name is included as plain text context in the prompt (e.g., the rendered text `@playwright` remains in the prompt body). No `sendCommand()` is triggered. The user can see the skill reference in their message, and the server receives it as part of the text.

**Future sub-item (skill-as-command execution)**: If `@skill` should trigger command execution, this requires:
1. A clear UI indicator that the mention will execute a command (not just reference it) — e.g., a different chip style, a confirmation dialog, or a "hold Shift to execute" modifier.
2. Explicit user confirmation or opt-in behavior.
3. Mapping from `SkillMentionItem` to the corresponding `Command.name` (via `Command.source === "skill"`).

This sub-item is explicitly out of scope for Tier 3.2.

### 5.5 No Mixed @/Command Send Path

The send path is always `sendPrompt()`. There is no routing to `sendCommand()` from @-mentions. Command execution remains exclusively on the `/` trigger via `handleCommandSelect()`.

## 6. UI Change Scope

### 6.1 New Files

| File | Purpose |
|------|---------|
| `src/webview/types/mention.ts` | `MentionItem` union type and helpers |
| `src/webview/utils/mentionSuggestion.ts` | Suggestion plugin for agent/skill mentions (alongside existing fileMentionSuggestion.ts) |
| `src/webview/components/MentionDropdown.tsx` | Grouped dropdown for agents/skills (alongside existing FileMentionDropdown.tsx) |

### 6.2 Modified Files

| File | Change |
|------|--------|
| `src/webview/extensions/FileMention.ts` | Keep as-is for file mentions. New `Mention.ts` extension for agent/skill mentions. |
| `src/webview/utils/editorContent.ts` | `extractMentions()` returns `MentionRef[]` with kind discrimination for both `fileMention` and `mention` node types |
| `src/webview/utils/fileMentionReference.ts` | Keep as-is for file-specific parsing. Add `parseMentionId()` in new `mentionReference.ts` for agent/skill ID parsing. |
| `src/webview/hooks/usePromptSend.ts` | Add `AgentPartInput` construction for agent mentions. Skill mentions pass through as text context. |
| `src/webview/components/TiptapEditor.tsx` | Wire new `Mention` extension alongside existing `FileMention`. Add `insertMention()` method. |
| `src/webview/components/InputBar.tsx` | Pass agents/skills data to mention suggestion; add `search-agents`/`search-skills` message handlers |
| `src/CodeFreeOViewProvider.ts` | Add `_handleSearchAgents()` and `_handleSearchSkills()` handlers |
| `src/shared/messages.ts` | Add `search-agents`, `search-agents-result`, `search-skills`, `search-skills-result` message types; extend `AgentSchema` and add `SkillSchema` |
| `src/webview/state/bootstrap.ts` | Include sub-agents in bootstrap data (currently filtered to primary/all only) |

### 6.3 Files NOT Deleted (Compatible Evolution)

The following files are **kept** during Tier 3.2 to maintain backward compatibility:

| File | Reason for Retention |
|------|---------------------|
| `src/webview/utils/fileMentionSuggestion.ts` | Continues to serve file mention suggestions. New `mentionSuggestion.ts` handles agent/skill suggestions. Unification can happen in a future cleanup phase after test coverage is complete. |
| `src/webview/components/FileMentionDropdown.tsx` | Continues to serve file mention dropdown. New `MentionDropdown.tsx` handles agent/skill dropdown. Deletion risks breaking existing Tiptap node compatibility. |

**Rationale**: Compatible evolution reduces risk. The existing file mention flow (Tiptap extension, suggestion plugin, dropdown, send path) continues to work unchanged. New mention kinds are added as a parallel extension. Once the new flow has full test coverage and has been validated in production, the old file-specific components can be consolidated into the unified ones.

### 6.4 Host-Side Data Flow Additions

```
Webview -> "search-agents" -> CodeFreeOViewProvider._handleSearchAgents()
  -> client.app.agents() -> filter (!hidden) -> "search-agents-result"

Webview -> "search-skills" -> CodeFreeOViewProvider._handleSearchSkills()
  -> client.app.skills() -> "search-skills-result"
```

## 7. Test Plan

### 7.1 Unit Tests

| Test | File | Description |
|------|------|-------------|
| `parseMentionId` | `mention.test.ts` | Parse `agent:`, `skill:` prefixed IDs |
| `extractMentions` | `editorContent.test.ts` | Extract mentions with kind discrimination from Tiptap JSON containing both `fileMention` and `mention` node types |
| `mentionToSdkParts` | `usePromptSend.test.ts` | Convert file mentions to `FilePartInput`, agent mentions to `AgentPartInput` |
| `skillMentionNoAutoExec` | `usePromptSend.test.ts` | Skill mentions do NOT trigger `sendCommand()`; they pass through as text context |

### 7.2 Backward Compatibility Tests

| Test | Description |
|------|-------------|
| Old `fileMention` node extraction | Tiptap JSON with `node.type === "fileMention"` is still extracted correctly by `extractMentions()` |
| File mention send path unchanged | `@src/foo.ts` still produces `FilePartInput[]` via the existing `parseFileMentionReference()` → `SelectionAttachment` → `buildSelectionParts()` path |
| Slash command flow unaffected | `/review` still triggers `handleCommandSelect()` → `sendCommand()` without any interference from @-mention changes |
| Mixed @ and / in same editor | `@src/foo.ts` and `/review` can coexist in the editor without cross-contamination of send paths |

### 7.3 Integration Tests

| Test | Description |
|------|-------------|
| Agent mention send | Type `@explore`, send, verify `AgentPartInput` in prompt parts |
| Skill mention send | Type `@playwright`, send, verify NO `sendCommand()` call; skill name appears in prompt text |
| File mention backward compat | Type `@src/foo.ts`, send, verify `FilePartInput` as before |
| Slash command unchanged | Type `/review`, verify existing command flow unaffected |

### 7.4 E2E Tests

| Test | Description |
|------|-------------|
| @-agent dropdown | Verify agent items appear in dropdown when `@` is typed |
| @-skill dropdown | Verify skill items appear in dropdown when `@` is typed (conditional on `client.app.skills()` verification) |
| Mixed @ and / | Verify `@` and `/` triggers work independently |
| File mention regression | Verify existing file mention flow still works end-to-end |

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `client.app.skills()` returns empty, slow, or unexpected shape at runtime | Medium | High | **Verification step before Phase 2**: call the API from host, log response, confirm shape. If it fails, proceed with file + agent mentions only and mark skill dropdown as blocked. |
| Agent list is large (20+ sub-agents) | Low | Medium | Debounce search; limit dropdown to 10 results per category |
| `AgentPartInput` not processed by server | Low | High | Test with a simple agent mention first; fall back to text-based `@agent-name` if server ignores the part |
| Tiptap Mention extension conflicts with multiple kinds | Low | Medium | Use separate node types (`fileMention` for files, `mention` for agent/skill); test rendering thoroughly |
| Backward compatibility with existing `fileMention` nodes | Low | Low | `extractMentions()` already handles both `"mention"` and `"fileMention"` types; no migration needed |
| User confusion between @-skill (reference) and /-skill (execution) | Medium | Medium | Clear UI distinction: @-skill chips show "reference" styling; /-skill executes immediately. Add tooltip on @-skill chips explaining "reference only, use / to execute" |

## 9. Non-Goals

- **Shell mode**: Not in scope. Shell mode is a separate feature.
- **Merging @ and / protocols**: Slash commands remain on `/` trigger; @-mentions remain on `@` trigger. No unification.
- **@-command mentions**: Commands are not included in the @-mention dropdown. The `/` trigger is the exclusive path for command execution. The `Command.source` schema (including `source: "skill"`) is documented for reference only.
- **@-skill auto-execution**: `@skill` inserts a reference only. It does NOT trigger `sendCommand()`. Skill execution via `/` command is the existing and only path. Auto-execution from @-skill requires explicit UI indicators and user confirmation — deferred to a future sub-item.
- **Sub-agent delegation UI**: `SubtaskPartInput` requires `prompt` and `description` fields that need a richer UI than a simple mention. This is deferred to a future tier.
- **Mention autocomplete for command arguments**: When a skill/command is invoked via `/`, the user types free-form text as arguments. No structured argument autocomplete.
- **Inline editing of mention references**: Once inserted, mentions are atomic nodes. No inline editing of the referenced file/agent/skill.
- **Cross-session mention persistence**: Mentions are session-scoped. No persistence of mention history across sessions.
- **Custom mention categories**: Only the three defined kinds (file, agent, skill). No plugin system for custom categories.
- **Deleting existing file mention components**: `FileMentionDropdown.tsx` and `fileMentionSuggestion.ts` are retained for backward compatibility. Consolidation is a future cleanup task.

## 10. Execution Phases

### Phase 0: SDK Verification (Prerequisite)

1. Call `client.app.skills()` from `CodeFreeOViewProvider.ts` with logging.
2. Confirm the response matches `Array<{ name, description, location, content }>` at runtime.
3. Measure latency and empty-state behavior.
4. If the API fails or returns unexpected data, mark skill dropdown as blocked and proceed with file + agent mentions only.
5. Verify `AgentPartInput` is accepted by the server: send a test prompt with an `AgentPartInput` part and confirm the response.

### Phase 1: Foundation (Types + Mention Extension)

1. Create `src/webview/types/mention.ts` with `MentionItem` union (file, agent, skill) and helpers.
2. Create `src/webview/extensions/Mention.ts` — new Tiptap Mention extension for agent/skill mentions (node type `"mention"`, `kind` attr). Keep `FileMention.ts` unchanged.
3. Update `editorContent.ts` to return `MentionRef[]` with kind discrimination for both `fileMention` and `mention` node types.
4. Create `src/webview/utils/mentionReference.ts` with `parseMentionId()` for agent/skill ID parsing. Keep `fileMentionReference.ts` unchanged.
5. Update `messages.ts` with new message types (`search-agents`, `search-agents-result`, `search-skills`, `search-skills-result`) and `SkillSchema`.

### Phase 2: Host-Side Data Providers

1. Add `_handleSearchAgents()` to `CodeFreeOViewProvider.ts` — calls `client.app.agents()`, filters out hidden agents.
2. Add `_handleSearchSkills()` to `CodeFreeOViewProvider.ts` — calls `client.app.skills()`. **Conditional on Phase 0 verification passing.**
3. Update `bootstrap.ts` to include sub-agents in bootstrap data (currently filtered to primary/all only).
4. Add `SkillSchema` to `messages.ts`.

### Phase 3: Agent/Skill Dropdown (Alongside Existing File Dropdown)

1. Create `mentionSuggestion.ts` for agent/skill suggestions (alongside existing `fileMentionSuggestion.ts`).
2. Create `MentionDropdown.tsx` with grouped categories (Agents, Skills) — alongside existing `FileMentionDropdown.tsx`.
3. Wire new `Mention` extension in `TiptapEditor.tsx` alongside existing `FileMention`.
4. Wire `search-agents`/`search-skills` message handlers in `InputBar.tsx`.
5. Do NOT delete `fileMentionSuggestion.ts` or `FileMentionDropdown.tsx`.

### Phase 4: Send-Time Conversion

1. Update `usePromptSend.ts` with kind-based conversion logic.
2. Add `AgentPartInput` construction for agent mentions.
3. Skill mentions pass through as text context (no `sendCommand()`).
4. File mention send path remains unchanged.

### Phase 5: Testing + Backward Compatibility

1. Unit tests for `parseMentionId`, `extractMentions`, mention-to-SDK conversion.
2. Backward compatibility tests: old `fileMention` node extraction, file mention send path, slash command flow.
3. Integration tests for each mention kind.
4. UI polish: category headers, keyboard navigation, empty states, skill reference tooltip.
