import type { Tone } from "../lib/kinds";
import Pill from "./Pill";

export interface RecordRowData {
  id: string;
  /** Beside the id: "2 items". */
  detail?: string;
  /** Under the id: date and amount. */
  sub: string;
  status: { label: string; tone: Tone };
}

/** Recent orders: id, a detail, a second line, and a status pill. Ported from web-shared/portal/home.tsx. */
export default function RecordList({ rows, mono = false }: { rows: RecordRowData[]; mono?: boolean }) {
  return (
    <ul className="divide-y divide-(--line) px-[18px] pb-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1 tabular-nums">
            <div className="text-[13px] font-semibold text-(--ink)">
              <span className={mono ? "font-mono" : ""}>{row.id}</span>
              {row.detail ? <span className="ml-1.5 text-[12.5px] font-normal text-(--ink-soft)">· {row.detail}</span> : null}
            </div>
            <div className="text-[12px] text-(--ink-soft)">{row.sub}</div>
          </div>
          <Pill tone={row.status.tone} dot>
            {row.status.label}
          </Pill>
        </li>
      ))}
    </ul>
  );
}
