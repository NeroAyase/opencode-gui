import { Extension } from "@tiptap/core";
import suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { render } from "solid-js/web";
import { CommandPalette, type CommandPaletteRef, type CommandItem } from "../components/CommandPalette";

export interface SlashCommandOptions {
  commands: CommandItem[];
  onCommandSelect: (command: CommandItem) => void;
  onSuggestionStart?: () => void;
  onSuggestionExit?: () => void;
  suggestion: Record<string, unknown>;
}

const DROPDOWN_PADDING = 8;
const DROPDOWN_FALLBACK_WIDTH = 300;
const DROPDOWN_FALLBACK_HEIGHT = 194;

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      commands: [] as CommandItem[],
      onCommandSelect: (_command: CommandItem) => {},
      onSuggestionStart: () => {},
      onSuggestionExit: () => {},
      suggestion: {},
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    const suggestionConfig: Omit<SuggestionOptions, "editor"> = {
      char: "/",

      allow: ({ state, range }) => {
        const $from = state.doc.resolve(range.from);
        return $from.parentOffset === 1;
      },

      items: ({ query }) => {
        return extensionThis.options.commands
          .filter((cmd: CommandItem) =>
            cmd.name.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10);
      },

      render: () => {
        let container: HTMLElement | null = null;
        let paletteRef: CommandPaletteRef | null = null;
        let dispose: (() => void) | null = null;
        let selectedIndex = 0;
        let items: CommandItem[] = [];
        let currentPosition = { top: 0, left: 0 };

        const getReferenceRect = (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions["render"]>>["onStart"]>>[0]) => {
          const clientRect = props.clientRect?.();
          if (clientRect) {
            return clientRect;
          }

          const { view } = props.editor;
          const coords = view.coordsAtPos(props.range.to);
          return {
            top: coords.top,
            bottom: coords.bottom,
            left: coords.left,
            right: coords.left,
            width: 0,
            height: coords.bottom - coords.top,
            x: coords.left,
            y: coords.top,
            toJSON: () => ({}),
          } as DOMRect;
        };

        const getDropdownPosition = (
          props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions["render"]>>["onStart"]>>[0],
          dropdownElement?: HTMLDivElement | null,
        ) => {
          const reference = getReferenceRect(props);
          const dropdownWidth = dropdownElement?.offsetWidth ?? DROPDOWN_FALLBACK_WIDTH;
          const dropdownHeight = dropdownElement?.offsetHeight ?? DROPDOWN_FALLBACK_HEIGHT;

          let top = reference.bottom;
          let left = reference.left;

          const maxLeft = window.innerWidth - dropdownWidth - DROPDOWN_PADDING;
          left = Math.min(Math.max(left, DROPDOWN_PADDING), Math.max(DROPDOWN_PADDING, maxLeft));

          if (top + dropdownHeight > window.innerHeight - DROPDOWN_PADDING) {
            top = Math.max(DROPDOWN_PADDING, reference.top - dropdownHeight);
          }

          return { top, left };
        };

        const renderPalette = (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions["render"]>>["onStart"]>>[0]) => {
          if (!container) {
            return;
          }

          if (dispose) {
            dispose();
            dispose = null;
          }

          const PaletteComponent = () => {
            return CommandPalette({
              items,
              selectedIndex,
              onSelect: (item) => {
                props.command(item);
              },
              position: currentPosition,
              ref: (ref) => {
                paletteRef = ref;
              },
            });
          };

          dispose = render(PaletteComponent, container);
        };

        return {
          onStart: (props) => {
            extensionThis.options.onSuggestionStart?.();
            items = props.items as CommandItem[];
            selectedIndex = 0;

            container = document.createElement("div");
            container.id = "command-palette-container";
            container.style.position = "fixed";
            container.style.zIndex = "10000";
            container.style.top = "0";
            container.style.left = "0";
            container.style.pointerEvents = "none";
            document.body.appendChild(container);
            container.style.background = "transparent";
            container.style.border = "none";
            container.style.padding = "0";

            currentPosition = getDropdownPosition(props, paletteRef?.getElement());
            renderPalette(props);
          },

          onUpdate: (props) => {
            selectedIndex = 0;
            items = props.items as CommandItem[];

            if (container) {
              currentPosition = getDropdownPosition(props, paletteRef?.getElement());
              renderPalette(props);
            }
          },

          onKeyDown: (props) => {
            if (paletteRef && paletteRef.onKeyDown(props.event)) {
              return true;
            }
            return false;
          },

          onExit: () => {
            extensionThis.options.onSuggestionExit?.();
            if (dispose) {
              dispose();
              dispose = null;
            }
            if (container) {
              if (container.parentNode) {
                document.body.removeChild(container);
              }
              container = null;
            }
            paletteRef = null;
          },
        };
      },

      command: ({ editor, range, props }) => {
        editor.chain().focus().deleteRange(range).run();
        extensionThis.options.onCommandSelect(props as CommandItem);
      },
    };

    return [
      suggestion({
        editor: this.editor,
        ...suggestionConfig,
      }),
    ];
  },
});
