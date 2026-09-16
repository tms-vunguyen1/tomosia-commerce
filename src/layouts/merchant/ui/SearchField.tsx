import DynamicIcon from "@/helpers/DynamicIcon";

/** Ported from web-shared/ui.tsx's SearchField. */
export default function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-[10px] border border-(--line-strong) bg-(--card) px-3 py-[7px] text-(--ink-soft) shadow-(--shadow-sm) focus-within:border-(--accent) ${className}`}
    >
      <DynamicIcon icon="FaMagnifyingGlass" className="text-[17px]" />
      <input
        type="search"
        name="catalog-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-(--ink) outline-none placeholder:text-(--ink-faint)"
      />
    </label>
  );
}
