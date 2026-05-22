import { createSignal, For, Show } from "solid-js";
import type { QuestionRequest } from "../types";

interface QuestionDockProps {
  questions: QuestionRequest[];
  onReply: (requestID: string, answers: string[][]) => void;
  onReject: (requestID: string) => void;
  isReady: boolean;
}

export function QuestionDock(props: QuestionDockProps) {
  // Track selected options per question: Map<requestID, Map<questionIndex, string[]>>
  const [selections, setSelections] = createSignal<Map<string, Map<number, string[]>>>(
    new Map(),
  );
  // Track custom text per question: Map<requestID, Map<questionIndex, string>>
  const [customTexts, setCustomTexts] = createSignal<Map<string, Map<number, string>>>(
    new Map(),
  );

  function getSelected(requestID: string, qIndex: number): string[] {
    return selections().get(requestID)?.get(qIndex) ?? [];
  }

  function toggleOption(requestID: string, qIndex: number, label: string, multiple: boolean) {
    setSelections((prev) => {
      const next = new Map(prev);
      const reqMap = new Map(next.get(requestID) ?? new Map<number, string[]>());
      const current = reqMap.get(qIndex) ?? [];

      if (multiple) {
        if (current.includes(label)) {
          reqMap.set(qIndex, current.filter((l) => l !== label));
        } else {
          reqMap.set(qIndex, [...current, label]);
        }
      } else {
        // Single select: replace
        reqMap.set(qIndex, current.includes(label) ? [] : [label]);
      }

      next.set(requestID, reqMap);
      return next;
    });
  }

  function setCustomText(requestID: string, qIndex: number, text: string) {
    setCustomTexts((prev) => {
      const next = new Map(prev);
      const reqMap = new Map(next.get(requestID) ?? new Map<number, string>());
      reqMap.set(qIndex, text);
      next.set(requestID, reqMap);
      return next;
    });
  }

  function getCustomText(requestID: string, qIndex: number): string {
    return customTexts().get(requestID)?.get(qIndex) ?? "";
  }

  function handleSubmit(request: QuestionRequest) {
    const answers: string[][] = [];
    for (let i = 0; i < request.questions.length; i++) {
      const selected = getSelected(request.id, i);
      const custom = getCustomText(request.id, i).trim();
      const q = request.questions[i];

      // If custom text is provided and no option is selected (or custom is enabled), include it
      const result: string[] = [...selected];
      if (custom && (q.custom !== false)) {
        // Only add custom if it's not already matching a selected option
        if (!result.includes(custom)) {
          result.push(custom);
        }
      }

      // If nothing selected and no custom, use custom text or empty
      if (result.length === 0 && custom) {
        answers.push([custom]);
      } else {
        answers.push(result.length > 0 ? result : []);
      }
    }
    props.onReply(request.id, answers);
  }

  function handleDismiss(request: QuestionRequest) {
    props.onReject(request.id);
  }

  return (
    <div class="question-dock">
      <For each={props.questions}>
        {(request) => (
          <div class="question-dock__card">
            <For each={request.questions}>
              {(question, qIndex) => (
                <div class="question-dock__question">
                  <div class="question-dock__progress">
                    Question {qIndex() + 1} of {request.questions.length}
                  </div>

                  <Show when={question.header}>
                    <div class="question-dock__header">{question.header}</div>
                  </Show>

                  <div class="question-dock__question-text">{question.question}</div>

                  <Show when={question.options.length > 0}>
                    <div class="question-dock__options">
                      <For each={question.options}>
                        {(option) => {
                          const isSelected = () =>
                            getSelected(request.id, qIndex()).includes(option.label);

                          return (
                            <label class="question-dock__option">
                              <input
                                type={question.multiple ? "checkbox" : "radio"}
                                name={`question-${request.id}-${qIndex()}`}
                                checked={isSelected()}
                                onChange={() =>
                                  toggleOption(
                                    request.id,
                                    qIndex(),
                                    option.label,
                                    question.multiple ?? false,
                                  )
                                }
                                disabled={!props.isReady}
                              />
                              <div class="question-dock__option-content">
                                <span class="question-dock__option-label">{option.label}</span>
                                <Show when={option.description}>
                                  <span class="question-dock__option-description">
                                    {option.description}
                                  </span>
                                </Show>
                              </div>
                            </label>
                          );
                        }}
                      </For>
                    </div>
                  </Show>

                  <Show when={question.custom !== false}>
                    <input
                      type="text"
                      class="question-dock__custom-input"
                      placeholder="Custom answer..."
                      value={getCustomText(request.id, qIndex())}
                      onInput={(e) =>
                        setCustomText(request.id, qIndex(), e.currentTarget.value)
                      }
                      disabled={!props.isReady}
                    />
                  </Show>
                </div>
              )}
            </For>

            <div class="question-dock__actions">
              <button
                class="question-dock__dismiss-btn"
                onClick={() => handleDismiss(request)}
                disabled={!props.isReady}
              >
                Dismiss
              </button>
              <button
                class="question-dock__submit-btn"
                onClick={() => handleSubmit(request)}
                disabled={!props.isReady}
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
