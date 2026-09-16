import DynamicIcon from "@/helpers/DynamicIcon";

/** The small hand-off button on rows and cards. Ported from web-shared/ui.tsx. */
export default function AskButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-(--line-strong) bg-(--card) px-2.5 py-[5px] text-[12px] font-semibold text-(--ink-2) transition-colors hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent-ink)"
    >
      <DynamicIcon icon="FaWandMagicSparkles" className="text-[13px] text-(--accent)" />
      {label}
    </button>
  );
}
