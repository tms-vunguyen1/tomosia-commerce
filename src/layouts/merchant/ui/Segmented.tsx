export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  count?: number | null;
}

/** Ported from web-shared/ui.tsx's Segmented. */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-[9px] bg-(--ground) p-[3px] text-[12.5px]">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.id)}
            className={`rounded-[7px] px-2.5 py-1 transition-colors ${
              on ? "bg-(--card) font-semibold text-(--ink) shadow-(--shadow-sm)" : "font-medium text-(--ink-soft) hover:text-(--ink)"
            }`}
          >
            {option.label}
            {option.count != null ? <span className="ml-1 font-medium tabular-nums text-(--ink-faint)">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
