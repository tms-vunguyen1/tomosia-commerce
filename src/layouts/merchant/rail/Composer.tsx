"use client";

import { useEffect, useRef, useState } from "react";
import DynamicIcon from "@/helpers/DynamicIcon";

export interface Prefill {
  text: string;
  /** Changes on every request so the same text can be offered twice. */
  nonce: number;
}

/**
 * Simplified from web-shared/Composer.tsx: no attachments, no slash commands.
 * `onSend` is the live chat's `send`; `busy` disables the field while a turn streams
 * (the reference's `disabled` and `busy` are the same idea here, kept separate in case
 * a "not ready yet" state — session still starting — needs its own copy later).
 */
export default function Composer({
  prefill,
  onSend,
  busy = false,
}: {
  prefill?: Prefill | null;
  onSend?: (text: string) => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [seenNonce, setSeenNonce] = useState<number | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Adjusting state from a prop change, done during render (React's
  // documented pattern for this) rather than in an effect — react-hooks/
  // set-state-in-effect flags setState-in-effect, not this.
  if (prefill && prefill.nonce !== seenNonce) {
    setSeenNonce(prefill.nonce);
    setDraft(prefill.text);
  }

  // Focusing the field is a real imperative DOM action, so it does belong
  // in an effect — it just doesn't call setState.
  useEffect(() => {
    if (prefill) boxRef.current?.focus();
  }, [prefill]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy || !onSend) return;
    onSend(text);
    setDraft("");
  };

  return (
    <form
      className="flex items-center gap-2 rounded-[14px] border border-(--line-strong) bg-(--card) py-2 pl-4 pr-2 shadow-(--shadow-sm) transition-colors focus-within:border-(--accent)"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={boxRef}
        name="assistant-message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        rows={2}
        aria-label="Message the merchant assistant"
        placeholder="Ask about sales, stock, pricing…"
        disabled={busy}
        className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-normal text-(--ink) outline-none placeholder:text-(--ink-soft)/70 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!draft.trim() || busy}
        aria-label="Send"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-(--ink) text-(--surface) transition hover:brightness-110 disabled:opacity-35"
      >
        <DynamicIcon icon="FaArrowUp" className="text-lg" />
      </button>
    </form>
  );
}
