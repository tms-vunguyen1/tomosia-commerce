"use client";

import { useEffect, useRef, useState } from "react";
import DynamicIcon from "@/helpers/DynamicIcon";

export interface Prefill {
  text: string;
  /** Changes on every request so the same text can be offered twice. */
  nonce: number;
}

/**
 * Simplified from web-shared/Composer.tsx: this portal has no live agent to
 * send to (per the spec, the rail is a static transcript), so submitting
 * only prevents the page reload — typing and a prefilled draft both work,
 * nothing is ever appended to the transcript.
 */
export default function Composer({ prefill }: { prefill?: Prefill | null }) {
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

  return (
    <form
      className="flex items-center gap-2 rounded-[14px] border border-(--line-strong) bg-(--card) py-2 pl-4 pr-2 shadow-(--shadow-sm) transition-colors focus-within:border-(--accent)"
      onSubmit={(event) => event.preventDefault()}
    >
      <textarea
        ref={boxRef}
        name="assistant-message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
          }
        }}
        rows={2}
        aria-label="Message the merchant assistant"
        placeholder="Ask about sales, stock, pricing…"
        className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-normal text-(--ink) outline-none placeholder:text-(--ink-soft)/70"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        aria-label="Send"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-(--ink) text-(--surface) transition hover:brightness-110 disabled:opacity-35"
      >
        <DynamicIcon icon="FaArrowUp" className="text-lg" />
      </button>
    </form>
  );
}
