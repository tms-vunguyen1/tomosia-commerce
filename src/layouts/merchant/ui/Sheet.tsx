"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import DynamicIcon from "@/helpers/DynamicIcon";

function IconButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-(--ink-soft) transition-colors hover:bg-(--ground) hover:text-(--ink)"
    >
      <DynamicIcon icon={icon} className="text-[17px]" />
    </button>
  );
}

/** A right-hand sheet over a scrim, portalled to the body; Escape and the scrim close it.
 * Ported from web-shared/ui.tsx. */
export default function Sheet({
  title,
  detail,
  onClose,
  footer,
  children,
  closeLabel = "Close",
}: {
  title: ReactNode;
  detail?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // This view only ever mounts a Sheet from a client-side click well after
  // the initial render, so there's no SSR payload to hydrate against —
  // reading `document.body` directly (not via useState+effect, which the
  // set-state-in-effect rule flags) is safe here.
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-40 bg-black/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(96vw,468px)] flex-col overflow-hidden bg-(--card) shadow-(--shadow-lg) sm:inset-y-2.5 sm:right-2.5 sm:rounded-[18px]"
      >
        <div className="flex items-center gap-2 border-b border-(--line) py-3 pl-[18px] pr-3">
          <div id={titleId} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-(--ink)">
            {title}
            {detail ? <span className="ml-2 font-normal tabular-nums text-(--ink-soft)">{detail}</span> : null}
          </div>
          <IconButton icon="FaXmark" label={closeLabel} onClick={onClose} />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-[18px]">{children}</div>
        {footer ? <div className="flex items-center gap-2 border-t border-(--line) px-[18px] py-3">{footer}</div> : null}
      </aside>
    </>,
    document.body,
  );
}
