import DynamicIcon from "@/helpers/DynamicIcon";

/** Ported from web-shared/portal/cards.tsx. */
export default function GuardrailNotes({ notes }: { notes?: string[] | null }) {
  if (!notes?.length) return null;
  return (
    <ul className="mx-3.5 mt-2.5 space-y-1 rounded-[11px] bg-(--warn-soft) px-3 py-2 text-[12.5px] leading-snug text-(--ink)">
      {notes.map((note) => (
        <li key={note} className="flex gap-2">
          <DynamicIcon icon="FaTriangleExclamation" className="mt-[2px] text-[14px] text-(--warn)" />
          <span>{note}</span>
        </li>
      ))}
    </ul>
  );
}
