"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TraceEntry } from "./protocol";

/**
 * What the assistant actually did this reply.
 *
 * Follows `examples/web-shared/Inspector.tsx`: a call and its result are one row, and
 * opening a row shows the arguments the model sent and the result it read back. None of
 * it is a summary written for this panel — it is the turn's own event stream, so what a
 * gate held or an error said is visible rather than described.
 */

interface ToolRow {
  tool: string;
  input?: string;
  result?: string;
  /** The head of a long result; `result` is then the "ok" summary. */
  excerpt?: string;
  isError?: boolean;
  status?: string;
  reason?: string;
  startedAt: number;
  durationMs?: number;
}

/** Pairs a tool's k-th call with its k-th result; a turn can call one tool twice. */
function buildToolRows(entries: TraceEntry[]): ToolRow[] {
  const rows: ToolRow[] = [];
  const open = new Map<string, ToolRow[]>();
  for (const entry of entries) {
    if (entry.kind === "tool_call") {
      const row: ToolRow = {
        tool: entry.label,
        input: entry.detail,
        startedAt: entry.at,
      };
      rows.push(row);
      open.set(entry.label, [...(open.get(entry.label) ?? []), row]);
    } else if (entry.kind === "tool_result") {
      const row = open.get(entry.label)?.shift();
      if (!row) continue;
      row.result = entry.detail;
      row.excerpt = entry.excerpt;
      row.isError = entry.isError;
      row.status = entry.status;
      row.reason = entry.reason;
      row.durationMs = Math.max(0, entry.at - row.startedAt);
    }
  }
  return rows;
}

const GATE_LABELS: Record<string, string> = {
  provenance: "provenance gate",
  options: "options gate",
  approval: "approval gate",
  guardrail: "guardrail",
};

type RowStatus = "running" | "blocked" | "error" | "ok";

const GLYPH: Record<RowStatus, string> = {
  running: "◌",
  blocked: "◦",
  error: "✕",
  ok: "✓",
};

const TONE: Record<RowStatus, string> = {
  running: "animate-pulse text-text-light dark:text-darkmode-text-light",
  blocked: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
  ok: "text-text-light dark:text-darkmode-text-light",
};

const RESULT_TONE: Record<RowStatus, string> = {
  running: "",
  blocked:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  error: "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",
  ok: "bg-neutral-100 text-text-dark dark:bg-neutral-800 dark:text-white",
};

function rowStatus(row: ToolRow): RowStatus {
  if (row.result === undefined) return "running";
  if (row.status === "blocked") return "blocked";
  return row.isError ? "error" : "ok";
}

function trailing(row: ToolRow, status: RowStatus): string {
  switch (status) {
    case "running":
      return "running…";
    case "blocked":
      return `held · ${GATE_LABELS[row.reason ?? ""] ?? "safety gate"}`;
    case "error":
      return "error";
    default:
      return row.durationMs != null && row.durationMs < 1
        ? "<1 ms"
        : `${Math.round(row.durationMs ?? 0)} ms`;
  }
}

function Detail({
  label,
  tone,
  text,
}: {
  label: string;
  tone: string;
  text: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-text-light dark:text-darkmode-text-light">
        {label}
      </div>
      <pre
        className={`mt-1 max-h-40 overflow-auto rounded p-2 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap ${tone}`}
      >
        {text}
      </pre>
    </div>
  );
}

function ToolCallRow({ row }: { row: ToolRow }) {
  const [open, setOpen] = useState(false);
  const status = rowStatus(row);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-1.5 text-left"
      >
        <span
          aria-hidden
          className={`w-3.5 shrink-0 text-center text-sm leading-none ${TONE[status]}`}
        >
          {GLYPH[status]}
        </span>
        {status === "ok" && <span className="sr-only">ok</span>}
        <span className="min-w-0 flex-1 truncate font-mono text-base text-text-dark dark:text-white">
          {row.tool}
        </span>
        <span
          className={`ml-auto shrink-0 text-right font-mono text-sm tabular-nums ${TONE[status]}`}
        >
          {trailing(row, status)}
        </span>
      </button>
      {open && (
        <div className="mb-2 ml-5 space-y-2">
          {row.input && (
            <Detail
              label="Input"
              tone="bg-neutral-100 text-text-dark dark:bg-neutral-800 dark:text-white"
              text={row.input}
            />
          )}
          {row.excerpt !== undefined ? (
            <Detail
              label="Result (excerpt)"
              tone={RESULT_TONE[status]}
              text={row.excerpt || "(empty)"}
            />
          ) : row.result !== undefined ? (
            <Detail
              label="Result"
              tone={RESULT_TONE[status]}
              text={row.result || "(empty)"}
            />
          ) : null}
        </div>
      )}
    </li>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-text-dark dark:text-white">
      {children}
    </h3>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-base text-text-light dark:text-darkmode-text-light">
      {children}
    </p>
  );
}

export default function ActivityPanel({
  trace,
  busy,
  onClose,
}: {
  trace: TraceEntry[];
  busy: boolean;
  onClose: () => void;
}) {
  const turns = useMemo(
    () => [...new Set(trace.map((entry) => entry.turn))].sort((a, b) => a - b),
    [trace],
  );
  const total = turns.length;
  // null follows the newest reply; a number pins one (1-indexed, as the label reads).
  const [pinned, setPinned] = useState<number | null>(null);
  const position = pinned ?? total;
  const turn = turns[position - 1];

  const entries = useMemo(
    () => trace.filter((entry) => entry.turn === turn),
    [trace, turn],
  );
  const rows = useMemo(() => buildToolRows(entries), [entries]);
  const done = entries.find((entry) => entry.kind === "turn_complete");
  const working = busy && position === total;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stepTo = (next: number) =>
    setPinned(next >= total ? null : Math.max(1, next));
  const stepButton =
    "rounded-md px-2 py-1 text-base leading-none text-text-light hover:text-text-dark disabled:opacity-30 dark:text-darkmode-text-light dark:hover:text-white";

  return (
    <aside className="hidden w-96 shrink-0 flex-col border-l border-neutral-200 lg:flex dark:border-neutral-700">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <div className="flex min-w-0 items-start gap-2">
          {total > 1 && (
            <span
              className="flex shrink-0 items-center gap-0.5"
              role="group"
              aria-label="Reply"
            >
              <button
                type="button"
                onClick={() => stepTo(position - 1)}
                disabled={position <= 1}
                aria-label="Previous reply"
                className={stepButton}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => stepTo(position + 1)}
                disabled={position >= total}
                aria-label="Next reply"
                className={stepButton}
              >
                ›
              </button>
            </span>
          )}
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-baseline gap-x-1.5 text-base text-text-dark dark:text-white">
              {total === 0 ? (
                <span className="font-bold">Activity</span>
              ) : (
                <>
                  <span className="font-bold">
                    Reply {position}
                    {total > 1 && (
                      <span className="font-normal text-text-light dark:text-darkmode-text-light">
                        {" "}
                        of {total}
                      </span>
                    )}
                  </span>
                  <span className="font-normal text-text-light dark:text-darkmode-text-light">
                    {working ? (
                      <span className="animate-pulse">· working…</span>
                    ) : (
                      <>
                        · {rows.length} step{rows.length === 1 ? "" : "s"}
                        {done?.elapsedMs && done.elapsedMs >= 100
                          ? ` · ${(done.elapsedMs / 1000).toFixed(1)}s`
                          : ""}
                      </>
                    )}
                  </span>
                </>
              )}
            </h2>
            {done?.detail && (
              <p className="mt-0.5 font-mono text-sm text-text-light dark:text-darkmode-text-light">
                tokens {done.detail}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity"
          className="shrink-0 rounded-md px-2 py-0.5 text-xl leading-none text-text-light hover:text-text-dark dark:text-darkmode-text-light dark:hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <section>
          <Heading>Steps</Heading>
          {total === 0 ? (
            <Empty>No replies yet.</Empty>
          ) : rows.length === 0 ? (
            <Empty>{working ? "Working…" : "No tool calls this reply."}</Empty>
          ) : (
            <ul className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-700">
              {rows.map((row, index) => (
                <ToolCallRow key={`${row.tool}-${index}`} row={row} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
