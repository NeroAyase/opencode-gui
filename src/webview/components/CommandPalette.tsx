import { createSignal, For, onMount, Show } from "solid-js";
import "./CommandPalette.css";

export interface CommandItem {
  name: string;
  description?: string;
}

export interface CommandPaletteProps {
  items: CommandItem[];
  selectedIndex: number;
  onSelect: (item: CommandItem) => void;
  position: { top: number; left: number };
}

export interface CommandPaletteRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
  getElement: () => HTMLDivElement;
}

export function CommandPalette(props: CommandPaletteProps & { ref?: (ref: CommandPaletteRef) => void }) {
  let containerRef!: HTMLDivElement;
  const [localSelectedIndex, setLocalSelectedIndex] = createSignal(props.selectedIndex);

  onMount(() => {
    if (props.ref) {
      props.ref({
        onKeyDown: handleKeyDown,
        getElement: () => containerRef,
      });
    }
  });

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    const itemCount = props.items.length;

    if (itemCount === 0) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setLocalSelectedIndex((prev) => (prev + 1) % itemCount);
      scrollToSelected();
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setLocalSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount);
      scrollToSelected();
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const selected = props.items[localSelectedIndex()];
      if (selected) {
        props.onSelect(selected);
      }
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      return true;
    }

    return false;
  };

  const scrollToSelected = () => {
    const selected = containerRef?.querySelector(`[data-index="${localSelectedIndex()}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      ref={containerRef}
      class="command-palette"
      style={{
        position: "fixed",
        top: `${props.position.top}px`,
        left: `${props.position.left}px`,
        "pointer-events": "auto",
      }}
    >
      <Show
        when={props.items.length > 0}
        fallback={<div class="command-palette__empty">No commands found</div>}
      >
        <For each={props.items}>
          {(item, index) => (
            <div
              class={`command-palette__item ${
                index() === localSelectedIndex() ? "command-palette__item--selected" : ""
              }`}
              data-index={index()}
              onClick={() => props.onSelect(item)}
              onMouseEnter={() => setLocalSelectedIndex(index())}
            >
              <span class="command-palette__name">{item.name}</span>
              {item.description && <span class="command-palette__description">{item.description}</span>}
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
