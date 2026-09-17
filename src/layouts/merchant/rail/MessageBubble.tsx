/** Simplified from web-shared/MessageBubble.tsx: no streaming caret, no
 * Markdown renderer — text still grows delta by delta as it streams
 * (`useMerchantChat` re-renders on each one), just plain and unstyled. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[72%] rounded-[16px_16px_5px_16px] bg-(--ink) px-3.5 py-2 text-[14.5px] leading-normal text-(--surface)">{text}</div>
    </div>
  );
}

export function AssistantText({ text }: { text: string }) {
  return <div className="whitespace-pre-line text-[14.5px] leading-relaxed text-(--ink)">{text}</div>;
}

/** Shown in place of an assistant turn's text/blocks until its first SSE event arrives. */
export function AssistantTyping() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
      <span className="ma-typing-dot" />
      <span className="ma-typing-dot" />
      <span className="ma-typing-dot" />
    </div>
  );
}
