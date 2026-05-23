import { createSignal, For, Show } from "solid-js";
import type { Todo } from "../state/types";

interface TodoDockProps {
  todos: Todo[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#8c8c8c",
  in_progress: "#0078d4",
  completed: "#388a34",
  cancelled: "#e51400",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#e51400",
  medium: "#bf8900",
  low: "#0078d4",
};

export function TodoDock(props: TodoDockProps) {
  const hasInProgress = () => props.todos.some((t) => t.status === "in_progress");
  const [expanded, setExpanded] = createSignal(hasInProgress());

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <div class="todo-dock">
      <button class="todo-dock__header" onClick={toggleExpanded}>
        <span class="todo-dock__toggle">{expanded() ? "▾" : "▸"}</span>
        <span class="todo-dock__title">Todos ({props.todos.length})</span>
      </button>
      <Show when={expanded()}>
        <div class="todo-dock__list">
          <For each={props.todos}>
            {(todo) => (
              <div class="todo-dock__item">
                <span
                  class="todo-dock__status-dot"
                  style={{ "background-color": STATUS_COLORS[todo.status] ?? STATUS_COLORS.pending }}
                />
                <span class="todo-dock__content">{todo.content}</span>
                <Show when={todo.priority}>
                  <span
                    class="todo-dock__priority"
                    style={{ color: PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS.low }}
                  >
                    {todo.priority}
                  </span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
