/** Simplified from web-shared/MessageBubble.tsx: no streaming caret, no
 * Markdown renderer — this rail's assistant text is static fixture copy,
 * not a live streamed reply. */
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
