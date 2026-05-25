# Next Steps Roadmap

## Current State

- Latest commit: `4f8e63f`
- Tests: 314/314 pass
- Build: pass
- Completion estimate: 85-90%
- Tier 2.1 (App.tsx refactoring) complete — 5 hooks extracted, App.tsx reduced from 1,220 to 606 lines

All Phase 1-3 feature work is committed. The Codex assessment risks have been addressed: SDK optional APIs are feature-detected, E2E config no longer requires global pnpm, documentation is updated, and the dirty worktree is clean.

Note for follow-up agents: at the time this roadmap was reviewed, source files were clean, but documentation files under `docs/engineering/` and `.sisyphus/` could still be untracked. Run `git status --short --branch` before making edits, and do not remove untracked paths unless the user explicitly asks for cleanup.

## Remaining Work

Organized by priority tier. Each item includes scope, rationale, and acceptance criteria.

### Tier 1: Release Blockers

These must be resolved before the extension can be considered release-ready.

#### 1.1 E2E test suite verification

- **Scope**: Run `pnpm test:e2e` end-to-end and confirm all specs pass
- **Rationale**: The `playwright.config.ts` fix (commit `3db9fbf`) removed the pnpm dependency, but the E2E specs themselves have never been verified against the current codebase. They were written for the original opencode-gui and may reference outdated selectors or flows. Run this only after the source naming cleanup, because CodeFree-O/OMO recognition depends on the CodeFree-O naming alignment.
- **Implementation guidance**:
  - Treat 1.2 as a prerequisite. Do not start E2E verification against the old OpenCode source/hook names.
  - Start with `pnpm test:e2e -- --reporter=list` or the equivalent Playwright CLI if `pnpm` is unavailable.
  - If the dev server fails before specs run, inspect `playwright.config.ts` first rather than editing specs.
  - If selectors fail, update tests to target stable UI roles, labels, or `data-testid` attributes instead of fragile class names.
  - Triage failures into product bugs versus stale specs before changing production code.
  - Record the final failing/passing spec list in this roadmap or a linked `docs/engineering/e2e-verification.md` note.
- **Acceptance criteria**:
  - `pnpm test:e2e` runs without environment errors
  - All passing specs are documented; failing specs are triaged as bugs or outdated specs
  - If specs are outdated, update them to match current UI structure

#### 1.2 Source file naming cleanup

- **Scope**: Rename `CodeFreeOService.ts` and `CodeFreeOViewProvider.ts` to use CodeFree-O naming
- **Rationale**: These are the last source files retaining the "OpenCode" prefix. All imports, the extension entry point, and any string references must be updated in lockstep. This is a functional prerequisite for CodeFree-O/OMO-driven recognition and invocation, not only cosmetic polish.
- **Implementation guidance**:
  - Treat this as a mechanical rename only. Do not combine it with behavioral changes.
  - Rename files with git-aware commands so history remains easy to follow.
  - Update class names only if the churn stays contained. If class renames cascade into large diffs, rename files first and leave class renames for a second cleanup commit.
  - Search with `rg "OpenCode|opencode|Open Code"` after the rename and classify matches as source symbols, SDK compatibility references, or historical documentation.
  - Keep SDK import names from `@srdcloud/codefree-o-sdk` unchanged when they mirror upstream Opencode naming.
- **Acceptance criteria**:
  - Files renamed to `CodeFreeOService.ts` and `CodeFreeOViewProvider.ts`
  - All imports updated across the codebase
  - `pnpm build` passes
  - `npx vitest run` passes (314/314)

### Tier 2: Quality Improvements

These improve maintainability and reduce regression risk. Not blockers, but should be done before adding new features.

#### 2.1 App.tsx refactoring ✅ COMPLETE

- **Scope**: Extract behavior from App.tsx (1,220 lines) into focused custom hooks
- **Rationale**: App.tsx was a god component owning 13 signals, 20 handlers, and 5 distinct behavioral domains
- **Completed extraction**:

  | Hook | Lines | Domain | Commit |
  |------|-------|--------|--------|
  | `useSessionDrafts` | 71 | Per-session drafts, draftContents, sessionKey, input/setInput, clearDraftContent | `e3eadea` |
  | `useAttachments` | 209 | Selection/image attachment signals, builders, chip rendering, remove handler | `e3eadea` |
  | `useMentionInsertion` | 125 | Editor methods ownership, mention insertion queue, focus management, host selection | `e3eadea` |
  | `useMessageQueue` | 210 | Queue state, inFlight tracking, processNextQueuedMessage, onSessionIdle drain | `24441f5` |
  | `usePromptSend` | 342 | handleSubmit, handleCommandSelect, handleSubmitEdit, getSdkErrorMessage, getResponseStatus | `4f8e63f` |

- **Results**:
  - App.tsx: 1,220 → 606 lines (50% reduction)
  - Hook files total: 957 lines (well-organized, single-responsibility)
  - `getSdkErrorMessage` and `getResponseStatus` consolidated in `usePromptSend.ts` (exported)
  - `InFlightMessage` type exported from `useMessageQueue.ts` for cross-hook type sharing
  - All 5 hooks accept dependencies explicitly (no global sync state imports inside hooks)
- **Acceptance criteria met**:
  - ✅ App.tsx reduced to ~606 lines (orchestration + JSX template)
  - ✅ Each extracted hook has a clear interface and no cross-hook state coupling
  - ✅ `pnpm build` passes
  - ✅ `pnpm vitest run` passes (314/314)
  - ✅ No behavioral changes (pure refactor)

#### 2.2 Bundle optimization

- **Scope**: Reduce webview eager payload size
- **Rationale**: The App chunk is 1,565 KB unminified (`minify: false` in vite.config.ts). Enabling minification and splitting Shiki core out would improve webview startup time and extension package size
- **Proposed changes**:
  1. Enable `build.minify: 'esbuild'` in `vite.config.ts`
  2. Add `manualChunks` to separate Shiki core from app code
  3. Audit `SUPPORTED_LANGS` in `src/webview/utils/shiki.ts` — remove languages that always fall back to plaintext
- **Implementation guidance**:
  - Make minification the first change and measure before adding manual chunks.
  - Keep sourcemaps if debugging the VS Code webview still depends on them.
  - Inspect `out/` after each build and record App chunk, main entry, CSS, and largest lazy chunks.
  - Do not remove a language unless tests or manual checks confirm that highlighted code still falls back cleanly.
  - Verify at least TypeScript, JavaScript, JSON, Markdown, shell, diff, and Python code blocks in the webview after changes.
- **Acceptance criteria**:
  - Eager App chunk under 600 KB unminified (or under 250 KB gzipped)
  - No regression in syntax highlighting for the 18 eagerly-loaded languages
  - `pnpm build` passes
  - Extension loads and highlights code correctly in VSCode

#### 2.3 Image paste capability check

- **Scope**: Check `capabilities.attachment` or `capabilities.input.image` before allowing image paste
- **Rationale**: Currently, image paste is always enabled regardless of whether the current model supports image input. Pasting an image into a text-only model will fail at the API level with an unhelpful error
- **Implementation guidance**:
  - Start by inspecting the provider/model payload returned through `provider.list` and the current `ModelSelection` shape.
  - Add a small capability resolver in `src/webview/utils/modelResolution.ts` or a nearby utility instead of embedding capability checks inside components.
  - Keep the UI behavior graceful: allow text paste normally, block image paste only when capability is known to be unsupported, and show a concise warning when capability is unknown.
  - Ensure queued messages, direct submit, and edited prompts all share the same attachment validation path.
  - Add tests around the resolver if the SDK metadata shape is stable enough to mock.
- **Acceptance criteria**:
  - Image paste UI is disabled or shows a warning when the current model does not support image input
  - Capability information is derived from the agent/model metadata available through the SDK
  - Existing image paste functionality is preserved for capable models

### Tier 3: Feature Enhancements

These are new features from the original TODO.md. Implement after Tier 1-2 are stable.

#### 3.1 Session restoration on tab switch

- **Scope**: Persist and restore the active session when switching between VSCode tabs/workspaces
- **Rationale**: Currently, switching away from the extension and back loses the active session context. Users expect their conversation to persist
- **Implementation guidance**:
  - First confirm whether the current loss occurs on webview hide/show, VS Code tab switch, workspace switch, or extension host reload. These are different lifecycle events.
  - Prefer workspace-scoped persistence for active session selection so one repository does not restore another repository's session.
  - Check existing session restoration behavior in `CodeFreeOViewProvider._handleReady` and `src/webview/state/sync.tsx` before adding new storage.
  - When restoring, validate that the session still exists and belongs to the current workspace directory.
  - Add an integration or e2e test if the lifecycle can be reproduced reliably.
- **Acceptance criteria**:
  - Active session ID is persisted (e.g., via `vscode.workspace.globalState`)
  - Returning to the extension restores the previous session
  - If the session no longer exists, gracefully falls back to session list

#### 3.2 @-mentions expansion

- **Scope**: Extend @-mention support beyond files to include skills, sub-agents, and slash commands
- **Rationale**: The current @-mention system only supports file references. CodeFree-O supports skills and sub-agents that should be mentionable
- **Implementation guidance**:
  - Start with `src/webview/extensions/FileMention.ts`, `src/webview/utils/fileMentionSuggestion.ts`, and `src/webview/components/FileMentionDropdown.tsx`.
  - Define a typed mention item union before adding new sources. Keep file, skill, agent, and command payloads distinct.
  - Fetch skills/sub-agents through existing SDK or host message paths if available. If no reliable API exists, document the blocker instead of inventing a local format.
  - Keep slash commands and @-mentions conceptually separate unless the SDK expects the same input representation.
  - Extend mention serialization and parsing tests before wiring new UI behavior.
- **Acceptance criteria**:
  - Typing `@` shows a dropdown with files, skills, and sub-agents
  - Selecting a skill or sub-agent inserts the appropriate mention syntax
  - The mention is correctly converted to the SDK input format on send

#### 3.3 Shell mode

- **Scope**: Type `!` to enter shell command mode, similar to how `/` triggers slash commands
- **Rationale**: CodeFree-O supports shell command execution. A dedicated input mode makes this discoverable
- **Implementation guidance**:
  - Confirm the SDK method and payload shape for shell execution before adding UI.
  - Reuse the command palette/input-mode patterns from slash commands where possible.
  - Define how shell mode interacts with queued messages, attachments, selected agent, selected model, and permissions.
  - Avoid sending shell commands through the generic prompt path unless the SDK explicitly requires that representation.
  - Add e2e coverage for entering shell mode, submitting a command, and rendering output.
- **Acceptance criteria**:
  - Typing `!` at the start of input switches to shell mode with visual indicator
  - Shell commands are sent to the SDK with the appropriate command type
  - Output is rendered in the message stream

### Tier 4: Long-term / Nice-to-have

#### 4.1 CI pipeline for E2E

- **Scope**: Add a GitHub Actions workflow that runs E2E tests on push/PR
- **Rationale**: E2E tests are currently manual. A CI pipeline would catch regressions automatically
- **Implementation guidance**:
  - Do this after Tier 1 proves the e2e suite passes locally.
  - Keep the first workflow minimal: checkout, setup Node, setup pnpm, install dependencies, install Playwright browsers, run e2e.
  - Cache dependencies only after the basic workflow is green.
  - If tests need secrets or real CodeFree-O credentials, split mocked webview e2e from live integration tests and keep live tests manual.
- **Acceptance criteria**:
  - `.github/workflows/e2e.yml` exists
  - Installs pnpm via `pnpm/action-setup`, Node.js via `actions/setup-node`
  - Runs `pnpm test:e2e` on every push to main and on PRs

#### 4.2 LSP type error cleanup

- **Scope**: Fix pre-existing LSP type errors in test files (missing `slug`/`version` on Session type, `SelectionAttachment` type mismatch in App.tsx)
- **Rationale**: These are not runtime errors but indicate type drift between the SDK and internal types
- **Implementation guidance**:
  - Treat SDK-generated or SDK-exported types as the source of truth.
  - Prefer narrow test fixture builders over widening production types to satisfy tests.
  - Avoid `as any`, `@ts-ignore`, or broad index signatures. Use `satisfies` and explicit fixture factories where possible.
  - Run TypeScript compilation, Vitest, and any LSP diagnostics workflow available in the editor after changes.
- **Acceptance criteria**:
  - `lsp_diagnostics` reports zero errors on all modified files
  - No `as any` or `@ts-ignore` introduced

#### 4.3 Extension packaging and marketplace publishing

- **Scope**: Package the extension as `.vsix` and publish to VSCode Marketplace and Open VSX
- **Rationale**: The extension is approaching release readiness. Publishing makes it installable without cloning the repo
- **Implementation guidance**:
  - Package locally before publishing. Install the `.vsix` into a clean VS Code profile and verify activation, sidebar rendering, and basic prompt flow.
  - Confirm `.vscodeignore` excludes test artifacts, screenshots, Playwright reports, and development-only notes that should not ship.
  - Check that `package.json` version, publisher, repository, icon, categories, commands, and marketplace description are final.
  - Do not run publish commands until tokens and release target are confirmed by the project owner.
- **Acceptance criteria**:
  - `pnpm package` produces a valid `.vsix`
  - Extension installs and activates correctly from the `.vsix`
  - Published to both marketplaces (requires PAT tokens)

## Suggested Execution Order

```
1.2 Source file naming cleanup ─────────────────────┐
1.1 E2E verification ───────────────────────────────┤
                                                    ├─ Tier 1 (release blockers)
                                                    │
2.1 App.tsx refactoring ───────────────────────────┤
2.2 Bundle optimization ───────────────────────────┤
2.3 Image paste capability check ──────────────────┤
                                                    ├─ Tier 2 (quality)
                                                    │
3.1 Session restoration ───────────────────────────┤
3.2 @-mentions expansion ──────────────────────────┤
3.3 Shell mode ────────────────────────────────────┤
                                                    ├─ Tier 3 (features)
                                                    │
4.1 CI pipeline ───────────────────────────────────┤
4.2 LSP type cleanup ──────────────────────────────┤
4.3 Marketplace publishing ────────────────────────┘
                                                    └─ Tier 4 (long-term)
```

Within Tier 1, complete 1.2 before 1.1. Other items within a tier can be parallelized only when their prerequisites are satisfied and separate worktrees are used for conflicting edits. Between tiers, complete the current tier before starting the next.

## TODO.md Sync

After completing items from this roadmap, update `TODO.md` to reflect the current state. The existing TODO.md items map to this roadmap as follows:

| TODO.md Item | Roadmap Item |
|-------------|-------------|
| Restoring selected session on tab switch | 3.1 |
| @-mentions | 3.2 |
| Shell mode | 3.3 |
| App.tsx refactoring | 2.1 |
| Bundle optimization | 2.2 |
| Image paste model capability check | 2.3 |
| E2E test environment | 1.1 (config fixed, verification pending) |

## Agent Handoff Rules

- Start each work item by reading the files named in its implementation guidance.
- Keep one work item per branch or commit unless the user asks for a larger batch.
- Prefer tests that lock the fixed behavior over broad snapshots.
- Update this roadmap when an item is completed, blocked, or found to be obsolete.
- Update `TODO.md` in the same change when roadmap status changes.
- Do not promote Tier 3 feature work ahead of Tier 1 verification unless the user explicitly changes priorities.
