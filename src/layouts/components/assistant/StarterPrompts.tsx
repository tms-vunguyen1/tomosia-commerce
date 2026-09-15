"use client";

import { Starter } from "./starters";

const ICON_BG = [
  "bg-amber-100 dark:bg-amber-900/40",
  "bg-sky-100 dark:bg-sky-900/40",
  "bg-orange-100 dark:bg-orange-900/40",
  "bg-violet-100 dark:bg-violet-900/40",
];

export default function StarterPrompts({
  starters,
  onSelect,
}: {
  starters: Starter[];
  onSelect: (starter: Starter) => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 text-center">
      <div className="rounded-2xl bg-gradient-to-b from-primary/10 via-body to-transparent px-4 pt-10 pb-3 dark:from-darkmode-primary/15 dark:via-darkmode-body">
        <p className="text-3xl font-semibold text-text-dark dark:text-white">
          Hi, I&apos;m the Shopping Assistant.
        </p>
        <p className="mt-2 text-lg text-text-light dark:text-darkmode-text-light">
          Ask about products, a project, an order, or returns.
        </p>
      </div>
      <div className="grid gap-4 text-left sm:grid-cols-2">
        {starters.map((starter, index) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => onSelect(starter)}
            className="rounded-xl border border-neutral-200 bg-body p-5 text-left shadow-sm transition hover:shadow-md hover:border-primary dark:border-neutral-700 dark:bg-darkmode-body dark:hover:border-darkmode-primary"
          >
            <span
              aria-hidden
              className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg text-2xl ${ICON_BG[index % ICON_BG.length]}`}
            >
              {starter.icon}
            </span>
            <div className="text-base font-bold text-text-dark dark:text-white">
              {starter.title}
            </div>
            <div className="mt-1 text-base text-text-light dark:text-darkmode-text-light">
              {starter.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
