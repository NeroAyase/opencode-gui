# Tier 1: Release Blockers — E2E Verification + Source Naming Cleanup

## Workflow Constraint

This plan is an execution plan, not the source of product scope. Follow `docs/engineering/spec-sisyphus-workflow.md`.

The current source of truth is `docs/engineering/next-steps-roadmap.md` until a dedicated `specs/tier1-release-blockers.md` exists. This plan may expand task sequencing, evidence capture, agent dispatch, and final review, but it must not expand the approved scope. If execution discovers new required work, update the roadmap or create a standard spec before making that work mandatory.

## TL;DR

> **Quick Summary**: Rename all remaining "OpenCode" source files/symbols to "CodeFreeO" naming, then verify and triage the E2E test suite. The rename is a prerequisite because CodeFree-O/OMO recognition and invocation depend on the CodeFree-O naming alignment.
> 
> **Deliverables**:
> - E2E test suite runs without environment errors; failures triaged and stale specs fixed
> - All source files, classes, interfaces, functions, and properties renamed from "OpenCode" to "CodeFreeO"
> - Documentation updated to reflect new naming
> - `.vscodeignore`/`.gitignore` updated for any log file renames
> 
> **Estimated Effort**: Medium (2-3 focused sessions)
> **Parallel Execution**: LIMITED - rename must complete before E2E
> **Critical Path**: Task 2 (Naming) → Task 3 (Doc update) → Task 1 (E2E) → Final review

---

## Context

### Original Request
User wants to create a formal work plan for Tier 1 release blockers from the `next-steps-roadmap.md`: (1) E2E test suite verification and (2) source file naming cleanup.

### Interview Summary
**Key Discussions**:
- E2E environment: User confirmed codefree-o CLI is installed and API credentials are configured
- useOpenCode.tsx: Included in naming cleanup scope (3 file renames total, not just 2)
- Permissions tests: Keep skipped (test.describe.skip), don't address in Tier 1
- Documentation: Separate commit from source code rename
- OpencodeInstance interface + createOpenCode() function + opencodeClient vars: All included in rename scope

**Research Findings**:
- E2E: 9 spec files, 33 tests (27 always-active + 2 conditionally-skipped + 4 always-skipped). Tests hit real AI endpoints. No Playwright browser install step. Port 5199 hardcoded. Race condition risk in queue/thinking tests.
- Naming: 3 file renames, 11 symbol renames, 6 import path updates, 20+ doc files with ~89 references. SDK imports must NOT be renamed. `.vscodeignore`/`.gitignore` reference `OpenCode.log`.
- Test infra: Vitest 314/314 pass. No coverage config. GatekeeperHarness available.

### Metis Review
**Identified Gaps** (addressed):
- `.vscodeignore`/`.gitignore` `OpenCode.log` references: Must check and update during rename
- `OpencodeInstance` interface rename: Included in scope
- Conditional skips in `message-queue.spec.ts`: Acknowledged (2 additional runtime skips)
- `workers:1` for initial E2E run: Added as operational guidance
- `OPENCODE_CONFIG_CONTENT` env var: Must NOT be renamed (SDK string literal)
- Doc scope: Living docs + historical docs both updated

---

## Work Objectives

### Core Objective
Rename all remaining "OpenCode" source artifacts to "CodeFreeO" naming, then verify the E2E test suite against the renamed codebase. The rename is required before testing because CodeFree-O/OMO recognition and invocation depend on these source and hook names.

### Concrete Deliverables
- E2E triage report documenting pass/fail/skip status of all 33 tests
- Fixed stale E2E specs (if any category-A failures found)
- 3 renamed source files: `CodeFreeOService.ts`, `CodeFreeOViewProvider.ts`, `useCodeFreeO.tsx`
- All internal symbols renamed consistently
- Updated `.vscodeignore`/`.gitignore` (if `OpenCode.log` is renamed)
- Updated documentation files
- 2 commits: one for source renames, one for doc updates

### Definition of Done
- [ ] `grep -r "OpenCode" src/` returns only SDK import lines and env var string literals
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (314/314)
- [ ] `pnpm test:e2e --workers=1` completes without environment errors after rename
- [ ] All category-A (stale spec) E2E failures are fixed
- [ ] `pnpm package` produces valid `.vsix` without `OpenCode.log`

### Must Have
- All source-level "OpenCode" naming replaced with "CodeFreeO" (except SDK imports)
- Build and unit tests pass after rename
- E2E test suite runs without crashing against the renamed codebase (environment errors resolved)
- Two separate commits (source + docs)

### Must NOT Have (Guardrails)
- Do NOT rename SDK imports: `OpencodeClient`, `createOpencodeServer`, `createOpencodeClient`, all SDK types from `@srdcloud/codefree-o-sdk`
- Do NOT rename the `OPENCODE_CONFIG_CONTENT` env var string literal
- Do NOT rename references to the OpenCode TUI project (anomalyco/opencode) in documentation
- Do NOT add new E2E tests in Tier 1
- Do NOT fix the 4 skipped permissions tests or conditional message-queue skips
- Do NOT fix race conditions in thinking-state/message-queue tests
- Do NOT combine source rename and doc update in one commit
- Do NOT use manual find-replace for symbol renames — use `lsp_rename` for safety
- Do NOT run E2E with `fullyParallel: true` on first attempt — use `--workers=1`

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Playwright)
- **Automated tests**: Tests-after (E2E verification is triage, not TDD; rename is mechanical with build+test gate)
- **Framework**: Vitest (unit) + Playwright (E2E)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **E2E tests**: Use Bash (Playwright CLI) — Run specs, capture output, triage failures
- **Source rename**: Use Bash (build + test + grep) — Verify no broken references
- **Doc update**: Use Bash (grep) — Verify all references updated

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - prerequisite):
└── Task 2: Source file naming cleanup [unspecified-high]

Wave 2 (After Task 2):
└── Task 3: Documentation naming update [quick]

Wave 3 (After Task 3):
└── Task 1: E2E test suite verification + triage [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 2 → Task 3 → Task 1 → F1-F4 → user okay
Parallel Speedup: None by default. Use separate worktrees only if the user explicitly asks to parallelize.
Max Concurrent: 1 before final review
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 2 | - | 3, 1, F1-F4 | 1 |
| 3 | 2 | 1, F1-F4 | 2 |
| 1 | 3 | F1-F4 | 3 |
| F1 | 1, 3 | user okay | FINAL |
| F2 | 1, 3 | user okay | FINAL |
| F3 | 1, 3 | user okay | FINAL |
| F4 | 1, 3 | user okay | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 1 — T2 → `unspecified-high`
- **Wave 2**: 1 — T3 → `quick` (only after T2 completes)
- **Wave 3**: 1 — T1 → `deep` (only after T3 completes)
- **FINAL**: 4 — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

- [ ] 1. E2E Test Suite Verification + Triage

  **What to do**:
  - Confirm Task 2 source naming cleanup has completed and `pnpm build` + `pnpm test` passed before starting.
  - Install Playwright browsers: `npx playwright install chromium`
  - Run E2E tests with single worker: `pnpm test:e2e -- --workers=1 --reporter=list`
  - Capture full output (pass/fail/skip for each test)
  - Triage every failure into one of four categories:
    - **A) Stale spec / code mismatch**: Test references outdated selectors, flows, or UI structure → FIX in this task
    - **B) AI flakiness**: Test fails due to unpredictable AI response timing or content → DOCUMENT only, do not fix
    - **C) Infrastructure issue**: Test fails due to environment setup (port conflict, missing CLI, etc.) → FIX in this task
    - **D) Genuine bug**: Test reveals a real product bug → DOCUMENT only, do not fix (belongs in Tier 2+)
  - For each category-A failure: update the spec to match current UI structure, targeting stable selectors (roles, labels, `data-testid`) over fragile class names
  - Re-run fixed specs individually to verify: `pnpm test:e2e -- --grep "test name" --workers=1`
  - Create triage report at `docs/engineering/e2e-verification.md` with: test name, status (pass/fail/skip), category (if failed), fix applied (if A), and notes

  **Must NOT do**:
  - Do NOT add new E2E tests
  - Do NOT fix the 4 skipped permissions tests (`test.describe.skip` in permissions.spec.ts)
  - Do NOT fix the 2 conditional skips in message-queue.spec.ts
  - Do NOT modify test timing or retry logic
  - Do NOT attempt to fix race conditions in thinking-state/message-queue tests
  - Do NOT run with `fullyParallel: true` on first attempt

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: E2E verification requires running tests, analyzing failures, making judgment calls about triage categories, and potentially fixing stale specs. This is multi-step investigative work.
  - **Skills**: []
    - No special skills needed — standard Bash + file editing tools suffice
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed — agent runs Playwright via CLI (`pnpm test:e2e`), not via programmatic API

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 2 and Task 3)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 2 and Task 3 (rename is required for CodeFree-O/OMO recognition and invocation; docs must match the renamed code before E2E triage is recorded)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `playwright.config.ts` — Full Playwright configuration: webServer on port 5199, testDir `./tests/e2e`, chromium only, `fullyParallel: true`. Understand the server startup and base URL config before running tests.
  - `tests/e2e/fixtures.ts` — Custom Playwright fixtures that spawn `codefree-o serve` and open the standalone webview page. Understand how the test environment is set up (server spawning, page navigation to `/src/webview/standalone.html`).
  - `tests/sandbox/codefree.json` — Sandbox CodeFree-O config used by E2E tests. Note `permission: "ask"` which may trigger unexpected permission prompts.

  **Test References** (testing patterns to follow):
  - `tests/e2e/prompt.spec.ts` — 3 tests: input visibility, submit button states. Simplest spec — good first test to verify environment works.
  - `tests/e2e/session.spec.ts` — 4 tests: message list, new session, session switcher, session refresh.
  - `tests/e2e/attachments.spec.ts` — 6 tests: attachment chips, line ranges, dedup, removal, send-with-attachment.
  - `tests/e2e/thinking-state.spec.ts` — 5 tests: thinking indicator, infinite loop detection, inFlightMessage clearing. Contains deliberate race-condition testing with 2-5 second waits.
  - `tests/e2e/message-queue.spec.ts` — 3 tests: queue processing, multi-message ordering, queue button visibility. Has 2 conditional `test.skip()` calls that fire when AI responds too fast.
  - `tests/e2e/second-message-inference.spec.ts` — 4 tests: second message inference bug regression.
  - `tests/e2e/outbox.spec.ts` — 2 tests: message send + dedup.
  - `tests/e2e/session-error.spec.ts` — 2 tests: API 500 error recovery.
  - `tests/e2e/permissions.spec.ts` — 4 tests: ALL SKIPPED via `test.describe.skip`. Do NOT attempt to enable.

  **External References**:
  - Playwright CLI docs: `https://playwright.dev/docs/test-cli` — For `--workers`, `--grep`, `--reporter` flags

  **WHY Each Reference Matters**:
  - `playwright.config.ts`: Must understand server config to diagnose infrastructure failures (category C)
  - `fixtures.ts`: Must understand how `codefree-o serve` is spawned to diagnose server startup failures
  - `sandbox/codefree.json`: The `permission: "ask"` setting may cause unexpected behavior in non-permissions tests
  - Each spec file: Must read to understand what each test expects before triaging failures
  - `message-queue.spec.ts` specifically: The conditional skips are a known issue — don't treat them as bugs

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** - No human action permitted.

  - [ ] `npx playwright install chromium` completes without error
  - [ ] `pnpm test:e2e -- --workers=1 --reporter=list` completes (pass or fail — the run itself must not crash)
  - [ ] Triage report exists at `docs/engineering/e2e-verification.md` with status for all 33 tests
  - [ ] All category-A failures are fixed and verified by re-running specific specs
  - [ ] `pnpm test` (vitest) still passes 314/314

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Playwright browser installation succeeds
    Tool: Bash
    Preconditions: Clean environment, Playwright not yet installed
    Steps:
      1. Run `npx playwright install chromium`
      2. Check exit code is 0
    Expected Result: Command exits with code 0, browser binaries installed
    Failure Indicators: Exit code non-zero, "Executable doesn't exist" error
    Evidence: .sisyphus/evidence/task-1-playwright-install.txt

  Scenario: E2E test suite runs without environment crash
    Tool: Bash
    Preconditions: Playwright browsers installed, codefree-o CLI available, API credentials configured
    Steps:
      1. Run `pnpm test:e2e -- --workers=1 --reporter=list 2>&1 | tee e2e-output.txt`
      2. Check that the test runner starts and attempts to run tests (not crash on startup)
      3. Parse output for test results: passed, failed, skipped counts
    Expected Result: Test runner completes full run. At minimum, the 27 always-active tests are attempted. Output shows pass/fail/skip counts.
    Failure Indicators: "Error: No tests found", "webServer timed out", "Executable doesn't exist"
    Evidence: .sisyphus/evidence/task-1-e2e-full-run.txt

  Scenario: Triage report documents all 33 tests
    Tool: Bash
    Preconditions: E2E run completed
    Steps:
      1. Check `docs/engineering/e2e-verification.md` exists
      2. Count test entries in the report — must be 33 (or document why count differs)
      3. Verify each entry has: test name, status, category (if failed)
    Expected Result: Report exists with 33 test entries, each with status and category
    Failure Indicators: File missing, fewer than 27 entries, entries without status
    Evidence: .sisyphus/evidence/task-1-triage-report.txt

  Scenario: Category-A stale specs are fixed
    Tool: Bash
    Preconditions: Triage complete, category-A failures identified
    Steps:
      1. For each category-A failure, re-run the specific spec: `pnpm test:e2e -- --grep "test name" --workers=1`
      2. Verify each previously-failing test now passes
    Expected Result: All category-A tests pass after fix
    Failure Indicators: Any category-A test still fails after fix attempt
    Evidence: .sisyphus/evidence/task-1-stale-specs-fixed.txt

  Scenario: Unit tests unaffected by E2E changes
    Tool: Bash
    Preconditions: E2E fixes applied
    Steps:
      1. Run `npx vitest run`
      2. Verify 314/314 tests pass
    Expected Result: 314 tests pass, 0 fail
    Failure Indicators: Any test failure count > 0
    Evidence: .sisyphus/evidence/task-1-unit-tests.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-playwright-install.txt
  - [ ] task-1-e2e-full-run.txt
  - [ ] task-1-triage-report.txt
  - [ ] task-1-stale-specs-fixed.txt
  - [ ] task-1-unit-tests.txt

  **Commit**: YES
  - Message: `fix(e2e): verify and triage E2E test suite, fix stale specs`
  - Files: `tests/e2e/*`, `docs/engineering/e2e-verification.md`, `playwright.config.ts` (if changed)
  - Pre-commit: `pnpm build && pnpm test`

---

- [ ] 2. Source File Naming Cleanup

  **What to do**:
  - Execute renames in this exact order:
    1. **File renames** (use `git mv` to preserve history):
       - `src/OpenCodeService.ts` → `src/CodeFreeOService.ts`
       - `src/OpenCodeViewProvider.ts` → `src/CodeFreeOViewProvider.ts`
       - `src/webview/hooks/useOpenCode.tsx` → `src/webview/hooks/useCodeFreeO.tsx`
    2. **Import path updates** (6 import statements across 5 files):
       - `src/extension.ts`: `from "./OpenCodeService"` → `from "./CodeFreeOService"`, `from "./OpenCodeViewProvider"` → `from "./CodeFreeOViewProvider"`
       - `src/CodeFreeOViewProvider.ts`: `from "./OpenCodeService"` → `from "./CodeFreeOService"`
       - `src/webview/main.tsx`: `from './hooks/useOpenCode'` → `from './hooks/useCodeFreeO'`
       - `src/webview/App.tsx`: `from "./hooks/useOpenCode"` → `from "./hooks/useCodeFreeO"`
       - `src/webview/state/sync.tsx`: `from "../hooks/useOpenCode"` → `from "../hooks/useCodeFreeO"`
    3. **Symbol renames** (use `lsp_rename` for each — this catches all references automatically):
       - `OpenCodeService` class → `CodeFreeOService` (in CodeFreeOService.ts)
       - `OpenCodeViewProvider` class → `CodeFreeOViewProvider` (in CodeFreeOViewProvider.ts)
       - `OpencodeInstance` interface → `CodeFreeOInstance` (in CodeFreeOService.ts)
       - `createOpenCode` function → `createCodeFreeO` (in useCodeFreeO.tsx)
       - `openCodeService` variable → `codefreeOService` (in extension.ts)
       - `_openCodeService` field → `_codefreeOService` (in CodeFreeOViewProvider.ts — 33 occurrences)
       - `this.opencode` field → `this.codefreeO` (in CodeFreeOService.ts — 11 occurrences)
       - `opencodeClient` local vars → `codefreeOClient` (in useCodeFreeO.tsx — 4 occurrences)
    4. **Comment updates** (3 source files):
       - `src/extension.ts:24`: `// Create OpenCode service` → `// Create CodeFree-O service`
       - `src/extension.ts:27`: `// Initialize OpenCode with workspace root` → `// Initialize CodeFree-O with workspace root`
       - `src/webview/utils/id.ts:2`: `matching OpenCode server` → `matching CodeFree-O server`
    5. **Config/ignore file updates**:
       - Check if `OpenCode.log` is referenced in `.vscodeignore` and `.gitignore`
       - If the log file name changes as a result of the service rename, update both ignore files
       - If the log file name does NOT change, add a comment noting the discrepancy
    6. **Verification**:
       - Run `pnpm build` — must pass with zero errors
       - Run `pnpm test` — must pass 314/314
       - Run `grep -r "OpenCode" src/` — must return ONLY SDK import lines and `OPENCODE_CONFIG_CONTENT` env var string
       - Run `grep -r "opencode" src/` — must return ONLY SDK imports, SDK types, and the id.ts comment referencing anomalyco/opencode

  **Must NOT do**:
  - Do NOT rename SDK imports: `OpencodeClient`, `createOpencodeServer`, `createOpencodeClient`, all SDK types from `@srdcloud/codefree-o-sdk`
  - Do NOT rename the `OPENCODE_CONFIG_CONTENT` env var string literal
  - Do NOT rename references to the OpenCode TUI project (anomalyco/opencode) in source comments
  - Do NOT update documentation files in this task (separate Task 3)
  - Do NOT use manual find-replace for symbol renames — use `lsp_rename`
  - Do NOT combine this commit with doc updates

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Mechanical rename with many steps and strict ordering requirements. High effort due to the number of renames and verification steps, but not architecturally complex.
  - **Skills**: []
    - No special skills needed — standard file editing + LSP tools suffice
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed — `git mv` is straightforward, no complex git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (prerequisite)
  - **Blocks**: Task 1, Task 3, F1-F4
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/OpenCodeService.ts` — The main service file being renamed. Contains `export class OpenCodeService` (line 23), `interface OpencodeInstance` (line 15), `private opencode` property (line 24). Read to understand the full symbol inventory before renaming.
  - `src/OpenCodeViewProvider.ts` — The view provider being renamed. Contains `export class OpenCodeViewProvider` (line 31), `import { OpenCodeService }` (line 4), `private readonly _openCodeService: OpenCodeService` (line 41), 30+ usages of `this._openCodeService.*`. Read to understand the full reference chain.
  - `src/extension.ts` — Entry point that imports both classes (lines 2-3), instantiates `OpenCodeService` (line 25), passes to `OpenCodeViewProvider` constructor (line 44). Read to understand the wiring.
  - `src/webview/hooks/useOpenCode.tsx` — Hook file being renamed. Contains `function createOpenCode()` (line 43), exports `CodeFreeOProvider` and `useCodeFreeO` (already renamed). Internal `opencodeClient` local vars (4 occurrences). Read to understand what still needs renaming.

  **API/Type References** (contracts to preserve):
  - `node_modules/@srdcloud/codefree-o-sdk/dist/v2/gen/sdk.gen.d.ts` — SDK API surface. Contains `createOpencodeServer`, `createOpencodeClient`, `OpencodeClient` — these MUST NOT be renamed. Read to distinguish SDK names from internal names.

  **Test References** (testing patterns to follow):
  - No test files import OpenCodeService/OpenCodeViewProvider directly — safe to rename without test updates.

  **WHY Each Reference Matters**:
  - `OpenCodeService.ts`: Primary rename target — must understand all symbols defined here
  - `OpenCodeViewProvider.ts`: Secondary rename target — must understand all references to OpenCodeService
  - `extension.ts`: Wiring point — must update imports and variable names
  - `useOpenCode.tsx`: Third rename target — must update internal function and local vars
  - SDK types: Must read to know which names are external (do not rename) vs internal (rename)

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** - No human action permitted.

  - [ ] `git diff --name-status` shows 3 file renames (R100 status) + modified files
  - [ ] `pnpm build` succeeds with zero errors
  - [ ] `pnpm test` passes 314/314
  - [ ] `grep -r "OpenCode" src/` returns only SDK import lines and `OPENCODE_CONFIG_CONTENT` env var string literals
  - [ ] `grep -r "opencode" src/` returns only SDK imports, SDK types, and the id.ts comment referencing anomalyco/opencode
  - [ ] `.vscodeignore` and `.gitignore` are updated if `OpenCode.log` references are affected

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: File renames preserve git history
    Tool: Bash
    Preconditions: Working tree clean (except .sisyphus/ and docs/engineering/)
    Steps:
      1. Run `git diff --name-status HEAD` after renames
      2. Verify 3 files show R100 status (rename with 100% similarity):
         - R100 src/OpenCodeService.ts → src/CodeFreeOService.ts
         - R100 src/OpenCodeViewProvider.ts → src/CodeFreeOViewProvider.ts
         - R100 src/webview/hooks/useOpenCode.tsx → src/webview/hooks/useCodeFreeO.tsx
    Expected Result: 3 R100 entries in git diff, plus modified files for import/symbol updates
    Failure Indicators: D (delete) + A (add) instead of R100, meaning git mv wasn't used
    Evidence: .sisyphus/evidence/task-2-file-renames.txt

  Scenario: Build succeeds after all renames
    Tool: Bash
    Preconditions: All renames and import updates completed
    Steps:
      1. Run `pnpm build`
      2. Check exit code is 0
      3. Verify no TypeScript compilation errors
    Expected Result: Build completes successfully with zero errors
    Failure Indicators: Exit code non-zero, TypeScript errors about missing imports or undefined symbols
    Evidence: .sisyphus/evidence/task-2-build.txt

  Scenario: Unit tests pass after renames
    Tool: Bash
    Preconditions: Build succeeds
    Steps:
      1. Run `npx vitest run`
      2. Verify 314/314 tests pass
    Expected Result: 314 tests pass, 0 fail
    Failure Indicators: Any test failure, especially import resolution errors
    Evidence: .sisyphus/evidence/task-2-unit-tests.txt

  Scenario: No residual "OpenCode" references in source (except SDK)
    Tool: Bash
    Preconditions: All renames completed
    Steps:
      1. Run `grep -r "OpenCode" src/ --include="*.ts" --include="*.tsx"`
      2. Verify every match is either: (a) an SDK import from @srdcloud/codefree-o-sdk, or (b) the OPENCODE_CONFIG_CONTENT env var string
      3. Run `grep -r "opencode" src/ --include="*.ts" --include="*.tsx"`
      4. Verify every match is either: (a) an SDK import/type, or (b) the id.ts comment about anomalyco/opencode
    Expected Result: Zero non-SDK, non-env-var "OpenCode" references in src/
    Failure Indicators: Any "OpenCode" reference that is not an SDK import or env var string
    Evidence: .sisyphus/evidence/task-2-grep-verification.txt

  Scenario: .vsix package does not contain OpenCode.log
    Tool: Bash
    Preconditions: Build succeeds, .vscodeignore updated
    Steps:
      1. Run `pnpm package`
      2. List contents of the resulting .vsix: `npx vsce ls` or inspect the zip
      3. Verify `OpenCode.log` is NOT in the package
    Expected Result: .vsix created successfully, no OpenCode.log inside
    Failure Indicators: OpenCode.log appears in package contents, or package command fails
    Evidence: .sisyphus/evidence/task-2-package-verification.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-file-renames.txt
  - [ ] task-2-build.txt
  - [ ] task-2-unit-tests.txt
  - [ ] task-2-grep-verification.txt
  - [ ] task-2-package-verification.txt

  **Commit**: YES
  - Message: `refactor: rename OpenCode source files and symbols to CodeFreeO`
  - Files: `src/CodeFreeOService.ts`, `src/CodeFreeOViewProvider.ts`, `src/webview/hooks/useCodeFreeO.tsx`, `src/extension.ts`, `src/webview/main.tsx`, `src/webview/App.tsx`, `src/webview/state/sync.tsx`, `src/webview/utils/id.ts`, `.vscodeignore`, `.gitignore`
  - Pre-commit: `pnpm build && pnpm test`

---

- [ ] 3. Documentation Naming Update

  **What to do**:
  - Update all documentation files that reference the old file names (`OpenCodeService.ts`, `OpenCodeViewProvider.ts`, `useOpenCode.tsx`) and old symbol names (`OpenCodeService`, `OpenCodeViewProvider`, `OpencodeInstance`, `createOpenCode`, `_openCodeService`, `openCodeService`)
  - Files to update (confirmed list from explore agent):
    - **Living docs**: `AGENTS.md`, `README.md`, `HOW-TO-RUN.md`, `QUICKSTART.md`
    - **Engineering docs**: `docs/engineering/next-steps-roadmap.md`, `docs/engineering/response-to-codex-assessment.md`, `docs/engineering/project-completion-assessment.md`
    - **Todo docs**: `docs/todos/agent-switcher.md`, `docs/todos/session-switcher.md`, `docs/todos/sse-streaming.md`, `docs/todos/tool-calls.md`, `docs/todos/opencode-config-verification.md`, `docs/todos/filesystem-root-issue.md`
    - **Fix docs**: `docs/fixes/session-state-sync-fix.md`
    - **Thought docs**: `thoughts/webview-direct-sdk/SPEC.md`, `thoughts/reliable-transport/research.md`, `thoughts/reliable-transport/plan.md`
    - **Spec docs**: `specs/file-mention-menu-tiptap.md`
    - **Style docs**: `docs/todos/style-improvements-amp-style.md`
  - Replacement rules:
    - `OpenCodeService.ts` → `CodeFreeOService.ts`
    - `OpenCodeViewProvider.ts` → `CodeFreeOViewProvider.ts`
    - `useOpenCode.tsx` → `useCodeFreeO.tsx`
    - `OpenCodeService` (class name) → `CodeFreeOService`
    - `OpenCodeViewProvider` (class name) → `CodeFreeOViewProvider`
    - `OpencodeInstance` → `CodeFreeOInstance`
    - `createOpenCode` → `createCodeFreeO`
    - `_openCodeService` → `_codefreeOService`
    - `openCodeService` → `codefreeOService`
    - `OpenCodeViewProvider.viewType` → `CodeFreeOViewProvider.viewType`
  - Do NOT rename references to the OpenCode TUI project (anomalyco/opencode) — these are historical/attribution references
  - Do NOT rename SDK API names in documentation (e.g., `OpencodeClient`, `createOpencodeServer`)

  **Must NOT do**:
  - Do NOT update source code files (done in Task 2)
  - Do NOT rename references to the OpenCode TUI project (anomalyco/opencode)
  - Do NOT rename SDK API names in documentation
  - Do NOT combine this commit with the source rename commit

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical find-and-replace across documentation files. No architectural decisions, no code logic.
  - **Skills**: []
    - No special skills needed — standard file editing tools suffice
  - **Skills Evaluated but Omitted**:
    - `technical-writing`: Not needed — this is mechanical replacement, not writing new content

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential, after Task 2)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 2 (source renames must be committed first)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `AGENTS.md:17` — Architecture section references `OpenCodeService.ts` and `OpenCodeViewProvider.ts`. Update to new names.
  - `README.md:52,75,93-95,129-130` — Multiple references to both file names and class names. Update all.

  **WHY Each Reference Matters**:
  - `AGENTS.md`: The primary agent instruction file — must be accurate for future agent sessions
  - `README.md`: User-facing documentation — must reflect actual file names
  - Other docs: Historical reference — update for consistency but lower priority

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** - No human action permitted.

  - [ ] `grep -r "OpenCodeService" --include="*.md" .` returns zero matches (except in SDK context or OpenCode TUI attribution)
  - [ ] `grep -r "OpenCodeViewProvider" --include="*.md" .` returns zero matches
  - [ ] `grep -r "useOpenCode" --include="*.md" .` returns zero matches
  - [ ] `pnpm build` still passes (docs don't affect build, but verify no accidental source edits)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All old file name references removed from docs
    Tool: Bash
    Preconditions: Task 2 source renames committed
    Steps:
      1. Run `grep -r "OpenCodeService\.ts" --include="*.md" .`
      2. Run `grep -r "OpenCodeViewProvider\.ts" --include="*.md" .`
      3. Run `grep -r "useOpenCode\.tsx" --include="*.md" .`
      4. Verify all return zero matches
    Expected Result: Zero matches for old file names in markdown files
    Failure Indicators: Any match found — indicates missed update
    Evidence: .sisyphus/evidence/task-3-doc-grep.txt

  Scenario: Build unaffected by doc changes
    Tool: Bash
    Preconditions: Doc updates completed
    Steps:
      1. Run `pnpm build`
      2. Verify exit code 0
    Expected Result: Build succeeds (docs don't affect build)
    Failure Indicators: Build failure — indicates accidental source file edit
    Evidence: .sisyphus/evidence/task-3-build.txt

  Scenario: OpenCode TUI attribution references preserved
    Tool: Bash
    Preconditions: Doc updates completed
    Steps:
      1. Run `grep -r "anomalyco/opencode" --include="*.md" .`
      2. Verify references to the upstream OpenCode TUI project still exist (these are attribution, not our naming)
    Expected Result: At least 1 match for "anomalyco/opencode" in docs (attribution preserved)
    Failure Indicators: Zero matches — attribution was accidentally removed
    Evidence: .sisyphus/evidence/task-3-attribution.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-doc-grep.txt
  - [ ] task-3-build.txt
  - [ ] task-3-attribution.txt

  **Commit**: YES
  - Message: `docs: update file name references from OpenCode to CodeFreeO`
  - Files: All .md files listed above
  - Pre-commit: `pnpm build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm build` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify `grep -r "OpenCode" src/` returns only SDK imports and env var strings.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: E2E tests pass after rename, extension loads correctly. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `fix(e2e): verify and triage E2E test suite, fix stale specs` - tests/e2e/*, playwright.config.ts (if changed)
- **Task 2**: `refactor: rename OpenCode source files and symbols to CodeFreeO` - src/OpenCodeService.ts→CodeFreeOService.ts, src/OpenCodeViewProvider.ts→CodeFreeOViewProvider.ts, src/webview/hooks/useOpenCode.tsx→useCodeFreeO.tsx, src/extension.ts, .vscodeignore, .gitignore
- **Task 3**: `docs: update file name references from OpenCode to CodeFreeO` - AGENTS.md, README.md, HOW-TO-RUN.md, QUICKSTART.md, docs/**, thoughts/**, specs/**

---

## Success Criteria

### Verification Commands
```bash
pnpm build                    # Expected: success, no errors
pnpm test                     # Expected: 314/314 pass
pnpm test:e2e --workers=1     # Expected: completes without env errors, stale specs fixed
grep -r "OpenCode" src/       # Expected: only SDK imports + OPENCODE_CONFIG_CONTENT
grep -r "opencode" src/       # Expected: only SDK imports + SDK types + id.ts comment
pnpm package                  # Expected: valid .vsix, no OpenCode.log inside
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (314 unit + E2E triage complete)
- [ ] No SDK imports renamed
- [ ] Two separate commits (source + docs)
