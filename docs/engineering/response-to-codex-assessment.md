# Response to Codex Project Completion Assessment

## Purpose

This document responds to the Codex-generated project completion assessment dated 2026-05-23. It provides updated status for each identified risk, corrects inaccuracies, and re-evaluates the suggested task order based on work completed after the assessment was written.

## Snapshot Update

| Field | Assessment Value | Current Value |
|-------|-----------------|---------------|
| Worktree state | Dirty (12 modified, 2 untracked) | Clean (all committed) |
| Latest commit | Not recorded | `04a5261` |
| Test results | 313/313 pass | 313/313 pass |
| Build status | Pass | Pass |
| Estimated completion | 70-80% | 80-85% |

The dirty worktree cited in the assessment has been fully committed across seven commits (`8681dff` through `04a5261`). The `TodoDock.tsx` file is no longer untracked; it was committed in `9580348`.

## Risk-by-Risk Response

### 1. E2E pipeline is not currently runnable

**Assessment severity: high**
**Current status: Unchanged, but deprioritized**

The `playwright.config.ts` web server command remains `"pnpm dev:webview --port 5199 --strictPort"`. No CI workflow exists for E2E tests; the only workflow (`.github/workflows/review.yml`) is an auto-review bot with no test execution steps.

However, this is an environment/tooling issue, not a product defect. The E2E specs themselves are structurally sound. The fix is straightforward: either add a CI workflow with `pnpm/action-setup` before running Playwright, or replace the web server command with `npx vite --port 5199 --strictPort` to remove the pnpm dependency. The TODO.md already tracks this item.

**Recommended action**: Replace `pnpm dev:webview` with `npx vite` in `playwright.config.ts` to eliminate the global pnpm requirement. This is a one-line change.

### 2. SDK optional API handling is incomplete

**Assessment severity: high**
**Current status: Fixed in production code, test coverage gap remains**

Commit `04a5261` addressed this directly. The `BootstrapContext` type now marks all four flagged APIs as optional:

```typescript
permission?: { list: ... };
question?: { list: ... };
session.todo?: (opts: ...) => ...;
session.status?: (opts: ...) => ...;
```

The runtime code uses feature-detect guards before each call:

- `if (client.permission?.list)` at line 165
- `if (client.question?.list)` at line 186
- `if (client.session.todo)` at line 295
- `typeof client.session.status === "function"` at line 134

When an API is absent, the code skips the call and returns empty maps as fallback. The logs no longer show `Cannot read properties of undefined` or `is not a function` errors for these APIs.

**Remaining gap**: No test explicitly constructs a `BootstrapContext` without optional APIs and asserts that the result contains empty maps. The `simple-bootstrap.test.ts` file incidentally exercises the "no question/todo" path by omitting them, but lacks explicit assertions on `questionMap` and `todoMap`. A dedicated test case should be added.

**Recommended action**: Add one test case: "should handle client without optional APIs" that provides only `app` and `session` in the context, calls `fetchBootstrapData`, and asserts `permissionMap`, `questionMap`, `todoMap`, and `sessionStatusMap` are all empty objects.

### 3. App.tsx is carrying too much behavior

**Assessment severity: medium**
**Current status: Valid concern, partially addressed, clear extraction path identified**

App.tsx is 1,220 lines. The assessment's "over 1,000 lines" characterization is accurate. However, the assessment understates the extraction that has already occurred:

| Extracted module | Lines | What it offloaded |
|-----------------|-------|-------------------|
| `hooks/useOpenCode.tsx` | 315 | SDK client, connection lifecycle, all API wrappers |
| `hooks/useAutoAccept.ts` | 25 | Auto-accept toggle + localStorage persistence |
| `state/sync.tsx` | ~400 | Server-owned state, SSE, session management |
| `state/eventHandlers.ts` | ~200 | SSE event processing |
| `state/bootstrap.ts` | ~360 | Session bootstrap logic |
| 41 component files | ~3000+ | All UI rendering |

The remaining 1,220 lines in App.tsx concentrate five identifiable domains that could each become a custom hook:

| Domain | Approximate lines | Proposed hook |
|--------|-------------------|---------------|
| Attachment management (signals, handlers, builders) | ~150 | `useAttachments` |
| Message queue + outbox (queue, inFlight, processNext) | ~200 | `useMessageQueue` |
| Mention insertion (insert, queue, flush, normalize) | ~100 | `useMentionInsertion` |
| Session draft state (drafts, draftContents, sessionAgents) | ~50 | `useSessionDrafts` |
| Submit logic (handleSubmit alone) | ~130 | Split with `useMessageQueue` |

Extracting these five domains would reduce App.tsx to approximately 690 lines (orchestration + JSX template), which is a reasonable size for a top-level component.

**Recommended action**: Extract `useAttachments` and `useMessageQueue` first, as they are the largest and most self-contained domains. Defer the remaining three until a feature change touches those areas.

### 4. Documentation is stale in places

**Assessment severity: medium**
**Current status: Largely fixed**

Commit `04a5261` updated both flagged files:

- `HOW-TO-RUN.md`: No React references remain. SolidJS and CodeFree-O branding is used throughout. The only residual "OpenCode" mention is the source filename `OpenCodeViewProvider.ts`, which is a codebase naming decision (the file exists at that path), not a documentation error.
- `TODO.md`: Completed items are marked with `[x]`. New items have been added for remaining work (App.tsx refactoring, bundle optimization, E2E environment, image paste capability check).

The assessment's recommendation to "update HOW-TO-RUN.md to reflect SolidJS, CodeFree-O naming" and "reconcile TODO.md against implemented features" has been fulfilled.

**Remaining gap**: The source filename `OpenCodeViewProvider.ts` retains the "OpenCode" prefix. Renaming it to align with CodeFree-O branding would require updating all imports across the codebase. This is a cosmetic change with moderate churn.

**Recommended action**: Consider renaming `OpenCodeViewProvider.ts` and `OpenCodeService.ts` in a dedicated cleanup commit. Low priority.

### 5. Webview bundle size is large

**Assessment severity: medium**
**Current status: Partially valid, but the architecture has improved significantly since assessment**

The assessment cites "~1.6 MB before gzip" for the main app chunk. Current measurements:

| Component | Size (KB) | Loading |
|-----------|-----------|---------|
| main.js (entry) | 199.5 | Eager |
| App chunk (SolidJS + Shiki core + app) | 1,565.7 | Eager |
| Language grammar chunks (230 files) | 7,827.3 | Lazy (dynamic import) |
| Theme chunks (57 files) | 1,175.0 | Lazy (dynamic import) |
| WASM (oniguruma) | 607.9 | Lazy |
| CSS | 53.8 | Eager |

The assessment's figure of ~1.6 MB is accurate for the eager App chunk. However, the assessment did not account for the lazy-loading architecture:

- Shiki 3.x automatically code-splits language grammars and themes into individual chunks loaded via dynamic `import()`. Only 18 common languages and 2 themes are eagerly initialized.
- The 97 additional language grammars and 55 additional themes are never fetched unless explicitly requested at runtime.
- The `vite.config.ts` has `minify: false`, which means the 1,565.7 KB App chunk would reduce by approximately 40-60% with minification enabled (estimated 600-940 KB, or ~200-350 KB gzipped).

**Recommended action**: Enable minification in `vite.config.ts` (`build.minify: 'esbuild'`). Consider adding `manualChunks` to split Shiki core out of the App chunk for better caching. These are optimization tasks, not correctness blockers.

### 6. Current feature work needs product-level review

**Assessment severity: medium**
**Current status: Resolved**

The dirty worktree has been committed and tested. All 313 unit tests pass. The specific files cited (TodoDock.tsx, App.tsx, bootstrap.ts, eventHandlers.ts) are now in committed state across multiple well-scoped commits:

| Commit | Scope |
|--------|-------|
| `202724d` | Wave 1: Shiki highlighting, Question Dock backend, Permission enhancement |
| `101849a` | Wave 2: Model/Agent selection, Question Dock UI, Slash commands |
| `ffc3890` | Wave 3: Diff Editor, Terminal, Session Fork/Revert/Share |
| `9580348` | Wave 4+5: Todo Dock, Session Delete/Rename, Copy Message, Image Paste |
| `04a5261` | SDK optional API fix, documentation updates |

Each commit was verified with `pnpm build` and `npx vitest run` before committing.

## Revised Task Order

The assessment's suggested task order should be updated to reflect completed work:

| Priority | Assessment Task | Status | Updated Recommendation |
|----------|----------------|--------|----------------------|
| 1 | Fix pnpm execution for build/test/e2e | Done for build/test | Fix E2E only: replace `pnpm dev:webview` with `npx vite` in playwright.config.ts |
| 2 | Make optional SDK APIs safe + add tests | Production code done | Add one test case for absent-API scenario |
| 3 | Review and stabilize dirty worktree | Done | No action needed |
| 4 | Run full verification suite | Done (313/313 pass) | Re-run after E2E fix |
| 5 | Update HOW-TO-RUN.md, README.md, TODO.md | Done | Consider renaming OpenCode*.ts files |
| 6 | Bundle-size optimization | Not started | Enable minification, add manualChunks |

## Corrections to the Assessment

1. **Worktree state**: The assessment was written while the worktree was dirty. All changes are now committed. The "do not assume every listed behavior is committed" caveat no longer applies.

2. **SDK error logs**: The assessment cites `Cannot read properties of undefined (reading 'list')` and `client.session.todo is not a function` as current errors. These errors no longer appear in test output after commit `04a5261`. The feature-detect guards prevent these calls when the APIs are absent.

3. **Bundle architecture**: The assessment describes the bundle as a single large chunk. The current build uses Shiki 3.x automatic code-splitting with lazy-loaded language/theme chunks. The eager payload is limited to the App chunk (~1.57 MB unminified), not the full Shiki library.

4. **Completion estimate**: The assessment estimates 70-80% completion. Given that all Phase 1-3 code is committed, the SDK optional API fix is in place, and documentation is updated, 80-85% is a more accurate estimate. The remaining 15-20% consists of: E2E environment fix, App.tsx refactoring, bundle optimization, and optional test coverage improvements.

## Summary

Of the six risks identified in the assessment, two are fully resolved (dirty worktree, documentation staleness), one is fixed in production code with a minor test gap (SDK optional APIs), one is an environment configuration issue with a straightforward fix (E2E pipeline), and two are optimization concerns that do not affect correctness (App.tsx size, bundle size). The project is past the "functional beta" stage described in the assessment and is closer to a release candidate, pending E2E verification and the minor items listed above.
