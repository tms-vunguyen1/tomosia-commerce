import DynamicIcon from "@/helpers/DynamicIcon";

/** "All orders →" style link to another view. Ported from web-shared/portal/home.tsx. */
export default function ViewLink({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--ink) hover:underline ${className}`}>
      {label} <DynamicIcon icon="FaArrowRight" className="text-[13px]" />
    </button>
  );
}
