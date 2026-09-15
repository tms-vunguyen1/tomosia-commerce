"use client";

/**
 * The follow-ups the assistant offered, as chips on the composer.
 *
 * They come from `present_suggestions`, so picking one sends that exact text as the next
 * message — the same path as typing it. They stagger in rather than landing at once, which
 * reads as the assistant finishing its thought.
 */
export default function Suggestions({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[];
  /** A reply is streaming; a pick would queue behind it. */
  disabled: boolean;
  onPick: (suggestion: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          onClick={() => onPick(suggestion)}
          style={{ animationDelay: `${index * 70}ms` }}
          className="ac-reveal rounded-full border border-neutral-300 bg-body px-4 py-2 text-base font-medium text-text-dark transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-50 disabled:hover:border-neutral-300 disabled:hover:bg-body disabled:hover:text-text-dark dark:border-neutral-600 dark:bg-darkmode-body dark:text-white dark:hover:border-darkmode-primary dark:hover:bg-darkmode-primary/15 dark:disabled:hover:border-neutral-600 dark:disabled:hover:bg-darkmode-body dark:disabled:hover:text-white"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
