import { plural } from "../lib/format";
import ViewLink from "./ViewLink";

/** The footer under a capped queue. Ported from web-shared/portal/home.tsx. */
export default function QueueOverflow({ hidden, link }: { hidden: number; link?: { label: string; onClick: () => void } }) {
  if (hidden <= 0) return null;
  return (
    <div className="flex items-center gap-2 border-t border-(--line) px-[18px] py-2.5 text-[12.5px] text-(--ink-soft)">
      <span>{plural(hidden, "more item")} in the queue</span>
      {link ? <ViewLink label={link.label} onClick={link.onClick} className="ml-auto" /> : null}
    </div>
  );
}
