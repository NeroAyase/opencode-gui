# E2E Test Suite Verification & Triage Report

**Date**: 2026-05-24
**Platform**: Windows (win32)
**Node**: v22.x
**Playwright**: Chromium 143.0.7499.4
**CLI**: `codefree-o` at `C:\Users\neroa\AppData\Roaming\npm\codefree-o.cmd`

---

## Summary

| Metric | Value |
|--------|-------|
| Total tests | 35 |
| Passed | 29 |
| Skipped | 6 |
| Failed | 0 |
| Duration | ~2.4 min |

All 29 non-skipped tests pass after fixing a Windows-specific infrastructure issue.

---

## Triage Categories

| Category | Description | Count | Action |
|----------|-------------|-------|--------|
| **A** — Stale spec / code mismatch | Selectors no longer match current UI | 0 | N/A |
| **B** — AI flakiness | Non-deterministic AI responses cause failures | 0 | Documented |
| **C** — Infrastructure issue | Environment/setup problems | 1 (caused 31 failures) | **Fixed** |
| **D** — Genuine bug | Real product defect exposed by test | 0 | N/A |

---

## Category C: Infrastructure Fix

### Problem

On Windows, `child_process.spawn("codefree-o", ...)` fails with `ENOENT` because npm installs global binaries as `.cmd` wrapper scripts (e.g., `codefree-o.cmd`). Node.js `spawn` without `shell: true` cannot resolve `.cmd` files — it only finds plain executables.

This caused **all 31 test failures** in the initial run. Every test that required the `codefree-o serve` process to start would fail immediately with:

```
Error: spawn codefree-o ENOENT
```

### Fix

Added `shell: process.platform === "win32"` to the spawn options in `tests/e2e/fixtures.ts` (line 134):

```ts
spawn(
  codefreeOPath,
  [
    "serve",
    "--port", String(port),
    "--host", "http://localhost:5199",
    "--cors", "http://127.0.0.1:5199",
    "--print-logs",
  ],
  {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    shell: process.platform === "win32",  // ← added
  }
);
```

On Windows, `shell: true` causes `spawn` to use `cmd.exe /c codefree-o ...`, which correctly resolves `.cmd` files. On macOS/Linux, `shell: false` (default) preserves the existing behavior.

### Verification

After the fix, the second E2E run: **29 passed, 6 skipped, 0 failed**.

---

## Per-Spec Results

### prompt.spec.ts (3 tests)

| Test | Status |
|------|--------|
| should show input field with correct aria-label | ✅ Passed |
| should show submit button when text is entered | ✅ Passed |
| should hide submit button when input is empty | ✅ Passed |

### session.spec.ts (4 tests)

| Test | Status |
|------|--------|
| should display message list with log role | ✅ Passed |
| should create new session on button click | ✅ Passed |
| should switch session via session switcher | ✅ Passed |
| should refresh session list | ✅ Passed |

### attachments.spec.ts (7 tests)

| Test | Status |
|------|--------|
| should display attachment chip after adding file | ✅ Passed |
| should show line range in attachment chip | ✅ Passed |
| should deduplicate identical attachments | ✅ Passed |
| should remove attachment on remove button click | ✅ Passed |
| should send message with attachment | ✅ Passed |
| should normalize file paths in attachments | ✅ Passed |
| should handle multiple attachments | ✅ Passed |

### thinking-state.spec.ts (6 tests)

| Test | Status |
|------|--------|
| should show thinking indicator during processing | ✅ Passed |
| should detect infinite loop in thinking state | ✅ Passed |
| should clear inFlightMessage on session idle | ✅ Passed |
| should process queued messages after thinking completes | ✅ Passed |
| should handle delayed POST response | ✅ Passed |
| should recover from thinking state on session.idle | ✅ Passed |

### message-queue.spec.ts (3 tests)

| Test | Status |
|------|--------|
| should process queued messages in order | ✅ Passed |
| should maintain message order across multiple queues | ⏭️ Skipped (conditional) |
| should show queue button when shift is held during thinking | ⏭️ Skipped (conditional) |

### second-message-inference.spec.ts (4 tests)

| Test | Status |
|------|--------|
| should not duplicate assistant message on second prompt | ✅ Passed |
| should correctly append second assistant response | ✅ Passed |
| should maintain message order after multiple prompts | ✅ Passed |
| should handle rapid sequential prompts without duplication | ✅ Passed |

### outbox.spec.ts (2 tests)

| Test | Status |
|------|--------|
| should send message and display in message list | ✅ Passed |
| should deduplicate messages in outbox | ✅ Passed |

### session-error.spec.ts (2 tests)

| Test | Status |
|------|--------|
| should display error alert on API 500 response | ✅ Passed |
| should recover from error on subsequent message | ✅ Passed |

### permissions.spec.ts (4 tests)

| Test | Status |
|------|--------|
| should show permission prompt for tool execution | ⏭️ Skipped (`test.describe.skip`) |
| should allow approving permission request | ⏭️ Skipped (`test.describe.skip`) |
| should allow denying permission request | ⏭️ Skipped (`test.describe.skip`) |
| should persist permission decisions | ⏭️ Skipped (`test.describe.skip`) |

---

## Skipped Tests Detail

### permissions.spec.ts — 4 tests (intentionally skipped)

The entire `permissions.spec.ts` file is wrapped in `test.describe.skip`. These tests require permission prompt UI that is not yet fully implemented. Per task constraints, these are **not to be fixed** in this verification cycle.

### message-queue.spec.ts — 2 tests (conditionally skipped)

Two tests in `message-queue.spec.ts` use `test.skip()` with a runtime condition. These are skipped due to known race conditions in the message queue testing infrastructure. Per task constraints, these are **not to be fixed** and race conditions are **not to be addressed**.

---

## Selector Verification

All E2E test selectors were verified against the current UI component code:

| Selector | Component | Match |
|----------|-----------|-------|
| `getByRole("textbox", { name: "Message input" })` | TiptapEditor.tsx | ✅ |
| `getByRole("button", { name: "Submit" })` | InputBar.tsx | ✅ |
| `getByRole("button", { name: "Stop" })` | InputBar.tsx | ✅ |
| `getByRole("button", { name: "Queue message" })` | InputBar.tsx | ✅ |
| `getByRole("log", { name: "Messages" })` | MessageList.tsx | ✅ |
| `getByRole("button", { name: "Switch session" })` | SessionSwitcher.tsx | ✅ |
| `getByRole("button", { name: "New session" })` | NewSessionButton.tsx | ✅ |
| `getByRole("article", { name: /message/ })` | MessageItem.tsx | ✅ |
| `getByRole("alert")` | MessageList.tsx | ✅ |
| `getByRole("button", { name: /remove\|delete/i })` | InputBar.tsx | ✅ |

No stale selectors found. All tests use stable accessibility-based selectors (roles, labels) rather than fragile CSS class names.

---

## Unit Tests

`npx vitest run` — **314/314 passed** (3.17s)

No regressions from the infrastructure fix.

---

## Build

`pnpm build` — **passes**

Both extension and webview bundles compile without errors.

---

## Evidence Files

| File | Description |
|------|-------------|
| `.sisyphus/evidence/task-1-playwright-install.txt` | Playwright chromium install output |
| `.sisyphus/evidence/task-1-e2e-full-run.txt` | Full E2E test run output (29 passed / 6 skipped) |
