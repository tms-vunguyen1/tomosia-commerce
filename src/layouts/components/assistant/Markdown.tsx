/**
 * The small subset of markdown a reply actually uses — bold, italic, inline code,
 * bullets, blockquotes, tables, horizontal rules.
 *
 * Ported from `examples/web-shared/Markdown.tsx` of anthropics/commerce-agents. It
 * builds React text nodes only and never touches `dangerouslySetInnerHTML`: the text
 * here is written by the model or copied out of the catalogue, so it stays inert markup
 * no matter what it contains.
 */

import { Fragment, type ReactNode } from "react";
import QuotedAsData from "./QuotedAsData";

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;
const BULLET = /^\s*[-•]\s+/;
const QUOTE = /^\s*>\s?/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const HORIZONTAL_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-neutral-100 px-1 font-mono text-[0.9em] dark:bg-neutral-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** A figure to line up, not prose: digits and punctuation, no letters. */
function isNumeric(cell: string): boolean {
  return /\d/.test(cell) && !/[A-Za-z]/.test(cell);
}

function Table({ rows, id }: { rows: string[]; id: string }) {
  const hasHeader = rows.length > 1 && TABLE_SEPARATOR.test(rows[1]);
  const header = hasHeader ? splitRow(rows[0]) : null;
  const body = (hasHeader ? rows.slice(2) : rows).map(splitRow);
  // A column is right-aligned and tabular only when every cell in it is a figure; a
  // comparison table's columns are as often text ("Cotton", "Brass") as they are prices.
  const columns = Math.max(
    header?.length ?? 0,
    ...body.map((row) => row.length),
  );
  const alignEnd = Array.from(
    { length: columns },
    (_, c) =>
      body.length > 0 &&
      body.every((row) => row[c] === undefined || isNumeric(row[c])),
  );
  const cellAlign = (c: number) =>
    alignEnd[c] ? "text-right font-mono tabular-nums" : "";
  return (
    // A wide table scrolls inside its own box rather than stretching the reply.
    <div className="my-2 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full border-collapse text-left text-base">
        {header ? (
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
              {header.map((cell, i) => (
                <th
                  key={i}
                  className={`px-2.5 py-1.5 text-sm font-bold tracking-wide uppercase text-text-light dark:text-darkmode-text-light ${alignEnd[i] ? "text-right" : ""}`}
                >
                  {renderInline(cell, `${id}-h${i}`)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((cells, r) => (
            <tr
              key={r}
              className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
            >
              {cells.map((cell, c) => (
                <td
                  key={c}
                  className={`px-2.5 py-1.5 text-text-dark dark:text-white ${cellAlign(c)}`}
                >
                  {renderInline(cell, `${id}-${r}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let rows: string[] = [];
  let quote: string[] = [];

  const flush = (at: number) => {
    if (bullets.length) {
      const list = bullets;
      bullets = [];
      blocks.push(
        <ul key={`ul-${at}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((item, i) => (
            <li key={i}>{renderInline(item, `ul-${at}-${i}`)}</li>
          ))}
        </ul>,
      );
    }
    if (rows.length) {
      const table = rows;
      rows = [];
      blocks.push(<Table key={`t-${at}`} rows={table} id={`t-${at}`} />);
    }
    if (quote.length) {
      const lines = quote;
      quote = [];
      blocks.push(
        <div key={`q-${at}`} className="my-1.5">
          <blockquote className="border-l-2 border-neutral-300 pl-2.5 text-base leading-relaxed italic text-text-light dark:border-neutral-600 dark:text-darkmode-text-light">
            {lines.map((line, i) => (
              <p key={i}>{renderInline(line, `q-${at}-${i}`)}</p>
            ))}
          </blockquote>
          <QuotedAsData subject="Quoted message" className="mt-1 pl-2.5" />
        </div>,
      );
    }
  };

  text.split("\n").forEach((line, index) => {
    if (TABLE_ROW.test(line)) {
      if (!rows.length) flush(index);
      rows.push(line);
    } else if (BULLET.test(line)) {
      if (!bullets.length) flush(index);
      bullets.push(line.replace(BULLET, ""));
    } else if (QUOTE.test(line)) {
      if (!quote.length) flush(index);
      quote.push(line.replace(QUOTE, ""));
    } else {
      flush(index);
      if (HORIZONTAL_RULE.test(line)) {
        blocks.push(
          <hr
            key={`hr-${index}`}
            className="my-3 border-t border-neutral-200 dark:border-neutral-700"
          />,
        );
      } else if (line.trim() === "") {
        blocks.push(<div key={`sp-${index}`} className="h-2" />);
      } else {
        blocks.push(
          <p key={`p-${index}`}>{renderInline(line, `p-${index}`)}</p>,
        );
      }
    }
  });
  flush(-1);
  return <>{blocks}</>;
}
