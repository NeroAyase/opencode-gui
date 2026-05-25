# Tier 2.1 App.tsx Refactoring: Worktree Audit

Date: 2026-05-25
HEAD: `d026fbf` (Tier 2.2 bundle optimization)
Branch: `main` (synced with origin/main)

## Git Status

```
 M src/webview/App.tsx          (27 insertions, 232 deletions)
?? src/webview/hooks/useSessionDrafts.ts
?? src/webview/hooks/useAttachments.ts
?? src/webview/hooks/useMentionInsertion.ts
```

No staged changes. All modifications are in the working tree.

## Completed Tiers (pushed)

| Tier | Commit | Description |
|------|--------|-------------|
| 1 | `d326667` | Source file naming cleanup, .gitignore, .vscodeignore, package script |
| 2.3 | `13ff885` | Image paste capability check |
| 2.2 | `d026fbf` | Bundle optimization (shiki selective imports, minification) |

## Hook-by-Hook Status

### Hook 1: useSessionDrafts -- COMPLETE

File: `src/webview/hooks/useSessionDrafts.ts` (71 lines)

App.tsx integration done:
- `drafts`, `draftContents`, `setDrafts`, `setDraftContents` signals removed from App.tsx
- `sessionKey`, `input`, `setInput`, `clearDraftContent` destructured from hook
- `createEffect` for restoring editor content on session change moved into hook
- `NEW_SESSION_KEY` constant moved into hook and re-exported

Behavioral equivalence: verified. Logic is identical to the original inline code.

### Hook 2: useAttachments -- COMPLETE

File: `src/webview/hooks/useAttachments.ts` (209 lines)

App.tsx integration done:
- `selectionAttachmentsBySession`, `imageAttachmentsBySession` signals removed from App.tsx
- All attachment-related functions destructured from hook: `selectionAttachments`, `setSelectionAttachments`, `setSelectionAttachmentsForKey`, `imageAttachments`, `setImageAttachmentsBySession`, `handleImagePaste`, `attachmentChips`, `handleRemoveAttachment`, `buildSelectionParts`, `buildImageParts`, `buildWorkspaceFileUrl`, `getFilename`, `formatSelectionLabel`
- Types exported: `SelectionAttachment`, `ImageAttachment`, `AttachmentChip`

Behavioral equivalence: verified. Logic is identical to the original inline code.

### Hook 3: useMentionInsertion -- HALF-DONE (critical)

File: `src/webview/hooks/useMentionInsertion.ts` (125 lines) -- exists and is self-contained.

Problem: App.tsx imports the hook but never calls it. All mention insertion logic remains inline in App.tsx.

Evidence:
1. Line 16: `import { useMentionInsertion, type FileMentionInsertRequest }` -- import present but `useMentionInsertion()` is never invoked
2. Lines 264-353: Full inline implementation still present in App.tsx:
   - `normalizeSelectionRange` (264)
   - `mentionInsertionKey` (276)
   - `insertMentionFromHostSelection` (283)
   - `queueMentionInsertion` (306)
   - `flushPendingMentionInsertions` (316)
   - `focusEditorOrQueue` (330)
   - `handleEditorMethodsReady` (339)
   - `insertMentionOrQueue` (348)
3. Signals `pendingMentionInsertions` and `pendingEditorFocus` still declared inline in App.tsx
4. `encodeFileMentionReference` still imported and used in App.tsx (line 277) -- would become unused after integration

Root cause: The previous session's background agent created the hook file but did not complete the App.tsx integration step (removing inline code, calling the hook, destructuring return values).

### Hook 4: useMessageQueue -- NOT STARTED

No file, no changes.

### Hook 5: usePromptSend -- NOT STARTED

No file, no changes.

## Design Issue: editorMethods Ownership

`editorMethods` is currently a `let` variable in App.tsx (line 105). It is consumed by:

1. `useSessionDrafts` -- receives `() => editorMethods` as a parameter
2. Inline mention insertion logic -- reads and writes `editorMethods` directly
3. `handleSubmit` -- reads `editorMethods` for clearing, extracting mentions
4. `handleQueueMessage` -- reads `editorMethods` for clearing
5. `handleCommandSelect` -- reads `editorMethods` for clearing
6. `handleEditQueuedMessage` -- reads `editorMethods` for setContent

The `useMentionInsertion` hook internally manages its own `editorMethods` via `handleEditorMethodsReady`. Integrating it requires deciding who owns `editorMethods`.

Two approaches:

**A. useMentionInsertion owns editorMethods**
- Hook returns `editorMethods()` getter
- `useSessionDrafts` receives the getter from `useMentionInsertion`'s return value
- Other consumers (handleSubmit, handleQueueMessage, etc.) call `mentionHook.editorMethods()`
- Pro: Single owner, clear lifecycle
- Con: Hook 3 must be initialized before Hook 1 (ordering constraint)

**B. editorMethods stays in App.tsx**
- Both hooks receive `editorMethods` via parameter
- `handleEditorMethodsReady` stays in App.tsx as the wiring point
- Pro: No ordering constraint between hooks
- Con: App.tsx still owns a piece of state that conceptually belongs to the mention domain

Recommendation: Approach A. The mention insertion hook's core responsibility is managing editor interaction (insert, focus, pending queue). `editorMethods` naturally belongs there. The ordering constraint is acceptable because App.tsx is the composition root and controls initialization order.

## Remaining Imports After Hook 3 Integration

After completing Hook 3 integration, these imports in App.tsx become removable:
- `encodeFileMentionReference` from `./utils/fileMentionReference` (line 41 area)

These imports must remain:
- `extractMentions` from `./utils/editorContent` -- still used in `handleSubmit` (line 520)
- `parseFileMentionReference` from `./utils/fileMentionReference` -- still used in `handleSubmit` (line 529)

## Proposed Next Steps

| Step | Action | Risk | Verification |
|------|--------|------|-------------|
| 1 | Commit Hook 1+2 (useSessionDrafts + useAttachments) | Low | `pnpm build`, `pnpm test`, LSP diagnostics |
| 2 | Complete Hook 3 integration: remove inline code, call `useMentionInsertion()`, resolve editorMethods ownership | Medium | `pnpm build`, `pnpm test`, manual: prompt send, mentions, session drafts |
| 3 | Commit Hook 3 | Low | Same as step 2 |
| 4 | Extract Hook 4: useMessageQueue | Medium | `pnpm build`, `pnpm test`, manual: message queue, outbox |
| 5 | Extract Hook 5: usePromptSend | High | `pnpm build`, `pnpm test`, manual: prompt send, command select, edit submit |

Each step is one commit. No step mixes refactoring with other concerns (per Tier 2.2 separation rule).

## Constraints

- Do not mix bundle optimization changes with refactoring changes (Tier 2.2 is already pushed)
- Each hook extraction is independent, verified, and committed separately
- Preserve behavioral equivalence -- no functional changes during extraction
- Run `pnpm build`, `pnpm test`, and LSP diagnostics before each commit
- Focus verification on: prompt send, attachments, mentions, session drafts, message queue
- Sisyphus plan controls execution orchestration only; it must not expand roadmap/spec scope
