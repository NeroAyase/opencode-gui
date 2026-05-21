# AGENTS.md

## Commands

- **Build**: `pnpm build` (builds extension + webview)
- **Watch**: `pnpm watch` (dev mode with hot reload)
- **Test**: `pnpm test` (runs vitest)
- **Single test**: `pnpm test -- path/to/file.test.ts`
- **E2E Tests**: `pnpm test:e2e` (runs playwright e2e tests with AI generation)
- **Package**: `pnpm package` (creates .vsix)
- **UI Kit**: `pnpm uikit` (opens component playground)

## Architecture

VSCode extension with SolidJS webview. Two build targets:

- **Extension** (`src/extension.ts`, `OpenCodeService.ts`, `OpenCodeViewProvider.ts`) - VSCode extension host
- **Webview** (`src/webview/`) - SolidJS chat UI communicating via `@srdcloud/codefree-o-sdk`

## Code Style

- TypeScript with strict mode, no `any` types
- SolidJS for webview components (signals, createMemo, Show/For)
- Functional components with hooks in `src/webview/hooks/`
- CSS files colocated with components (App.css, uikit.css)
- Use VSCode API types from `@types/vscode`
- Prefer explicit imports, avoid barrel files
- Error handling: use VSCode's `window.showErrorMessage` and `LogOutputChannel`

## SolidJS Store Pitfall: createMemo + store proxy

**NEVER wrap a store property lookup in `createMemo` if downstream consumers need to react to in-place mutations (e.g. `produce`, `push`, `splice`).**

`createMemo` compares values with `===`. A store proxy reference stays the same after in-place mutations, so the memo silently swallows the update. Use a plain function instead:

```ts
// ❌ BAD — createMemo returns same proxy ref, suppresses downstream updates
const messages = createMemo(() => store.message[sessionId()] ?? []);

// ✅ GOOD — plain function, consumers track the store proxy directly
const messages = () => store.message[sessionId()] ?? [];
```

`createMemo` is fine for derived computations that produce new values (e.g. `.map()`, `new Map(...)`, arithmetic).

## Publishing

Use the `pnpm run publish` script to publish the extension to the VSCode and OVSX marketplaces.

## Logging into gcloud

CRITICAL: If you try to run a command get an error related to the user not being logged into Gcloud e.g. `{"error":"invalid_grant","error_description":"reauth related error (invalid_rapt)","error_uri":"https://support.google.com/a/answer/9368756","error_subtype":"invalid_rapt"}`, then you MUST instruct the user to log into gcloud before you can continue.

## CodeFree-O SDK

This extension uses the CodeFree-O SDK (`@srdcloud/codefree-o-sdk`), which is a fork of the Opencode SDK (`@opencode-ai/sdk`). CodeFree-O (https://www.srdcloud.cn/feedback/feedback) is a coding agent by China Telecom, employing a client-server architecture. The frontend for this extension acts as a client. The extension backend spawns the CodeFree-O server as a separate process.

The SDK is a strict superset of the Opencode SDK with full API compatibility. Key differences:
- Spawns `codefree-o` instead of `opencode`
- Uses `x-codefree-o-directory` header (backward compatible with `x-opencode-directory`)
- Uses `x-codefree-o-workspace` header (backward compatible with `x-opencode-workspace`)
- Adds AbortSignal support

You will frequently find issues where some functionality from the SDK is not wired up correctly. In these cases, use the Opencode TUI (https://github.com/anomalyco/opencode/tree/dev/packages/console) as the reference implementation for SDK usage patterns.
