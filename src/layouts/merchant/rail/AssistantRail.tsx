import type { ReactNode } from "react";

/** Simplified from web-shared/portal/AssistantRail.tsx: fixed width, no
 * drag-resize, no fullscreen, no localStorage — desktop-only per the spec
 * (interview item 11), so there's no mobile overlay/collapse variant either. */
export default function AssistantRail({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="hidden w-[380px] shrink-0 lg:block">{children}</div>;
}
