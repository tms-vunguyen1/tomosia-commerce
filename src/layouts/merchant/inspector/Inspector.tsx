"use client";

import { useState } from "react";
import type { TraceEntry, TraceGroup } from "../lib/fixtures/trace";
import Sheet from "../ui/Sheet";

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-(--ink-soft)">{label}</div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-(--well)/70 p-2 font-mono text-[11px] leading-relaxed text-(--ink)">{text}</pre>
    </div>
  );
}

function ToolCallRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2 py-1.5 text-left">
        <span aria-hidden className="w-3.5 shrink-0 text-center text-[12px] leading-none text-(--ok)">
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-(--ink)">{entry.tool}</span>
      </button>
      {open ? (
        <div className="mb-2 ml-5 space-y-2">
          <Detail label="Input" text={entry.input} />
          <Detail label="Result" text={entry.result} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The Activity panel, simplified from web-shared/Inspector.tsx: no
 * turn-stepping (this transcript has 3 static replies, shown all at once,
 * not paged), no memory section (memory is off across this whole project),
 * no live/working state — every entry here already happened. Built on the
 * existing Sheet primitive rather than a second scrim+portal implementation.
 */
export default function Inspector({ groups, onClose }: { groups: TraceGroup[]; onClose: () => void }) {
  const stepCount = groups.reduce((sum, group) => sum + group.entries.length, 0);
  return (
    <Sheet title="Activity" detail={`${stepCount} step${stepCount === 1 ? "" : "s"}`} onClose={onClose} closeLabel="Close activity">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className="text-[13px] font-semibold text-(--ink)">{group.label}</h3>
            <ul className="mt-1 divide-y divide-(--line)">
              {group.entries.map((entry, index) => (
                <ToolCallRow key={index} entry={entry} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
