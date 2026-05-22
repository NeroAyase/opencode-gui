import { createSignal, createMemo } from "solid-js";

const AUTO_ACCEPT_KEY = "codefree-o.autoAccept";

export function useAutoAccept() {
  const [enabled, setEnabled] = createSignal(
    typeof localStorage !== "undefined"
      ? localStorage.getItem(AUTO_ACCEPT_KEY) === "true"
      : false
  );

  const toggle = () => {
    const next = !enabled();
    setEnabled(next);
    try {
      localStorage.setItem(AUTO_ACCEPT_KEY, String(next));
    } catch {
      // localStorage may be unavailable in some webview contexts
    }
  };

  const isEnabled = createMemo(() => enabled());

  return { isEnabled, toggle };
}
