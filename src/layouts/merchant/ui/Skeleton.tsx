/**
 * Ported from web-shared/ui.tsx's Skeleton. The reference animates via a
 * shared `.ac-skeleton` class from its own app CSS; merchant.css is a
 * separate, scoped stylesheet, so this uses Tailwind's built-in
 * `animate-pulse` instead of duplicating that keyframe animation.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-(--well) ${className}`} />;
}
