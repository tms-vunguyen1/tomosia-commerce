"use client";

import AssistantCard from "./cards";
import type { AssistantApi } from "./api";
import Markdown from "./Markdown";
import { AssistantChatItem, ChatItem } from "./protocol";
import Suggestions from "./Suggestions";

/**
 * What shows under a reply while it is being made: the step the assistant is on, or a
 * shimmer before the first word. The shimmer is two bars the width of a sentence — it
 * stands in for prose that is coming, and never for a card, whose shape is not known
 * until the model names the component.
 */
function ActivityLine({ item }: { item: AssistantChatItem }) {
  if (item.activity) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 text-base text-text-light dark:text-darkmode-text-light"
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary dark:bg-darkmode-primary" />
        <span className="min-w-0 truncate">{item.activity}</span>
      </div>
    );
  }
  if (item.segments.length > 0) return null;
  return (
    <div role="status" aria-label="Working" className="flex flex-col gap-2">
      <div className="ac-skeleton h-4 w-3/5 rounded" />
      <div className="ac-skeleton h-4 w-2/5 rounded" />
    </div>
  );
}

/**
 * One item of the transcript. An assistant reply is a list of segments in the order they
 * arrived — prose, cards, and any error — so a card that landed between two paragraphs
 * stays where the model put it.
 */
export default function MessageBubble({
  item,
  api,
  busy,
  isLast,
  onSuggestion,
}: {
  item: ChatItem;
  api: AssistantApi;
  /** A reply is streaming. */
  busy: boolean;
  /** Only the newest reply offers its follow-ups; older ones have been answered. */
  isLast: boolean;
  onSuggestion: (suggestion: string) => void;
}) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] rounded-tl-2xl rounded-tr-2xl rounded-br-[5px] rounded-bl-2xl bg-dark px-4 py-2.5 text-base leading-normal text-white shadow-sm dark:bg-light dark:text-text-dark">
          {item.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {item.segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <div
              key={`text-${index}`}
              className={`text-lg leading-relaxed text-text-dark dark:text-white ${
                item.pending && index === item.segments.length - 1
                  ? "after:ml-0.5 after:inline-block after:h-[1em] after:w-[2px] after:animate-pulse after:bg-current after:align-middle after:content-['']"
                  : ""
              }`}
            >
              {/* Only the assistant's own prose is parsed; what the shopper typed is
                  rendered as the plain text it is, above. */}
              <Markdown text={segment.text} />
            </div>
          );
        }
        if (segment.type === "error") {
          return (
            <div
              key={`error-${index}`}
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-base leading-relaxed text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300"
            >
              {segment.text}
            </div>
          );
        }
        return (
          <AssistantCard
            key={segment.slotKey}
            block={segment.block}
            status={segment.status}
            api={api}
          />
        );
      })}

      {item.pending && <ActivityLine item={item} />}

      {!item.pending && isLast && (
        <Suggestions
          suggestions={item.suggestions}
          disabled={busy}
          onPick={onSuggestion}
        />
      )}
    </div>
  );
}
