"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Px from the bottom within which the reader still counts as following. */
const STICK_PX = 96;

/**
 * Keeps the transcript pinned to the newest words while a reply streams, and lets go the
 * moment the reader scrolls up to re-read something. Sending re-engages it.
 *
 * Ported from `examples/web-shared/scroll.ts`.
 */
export function useStickToBottom(items: readonly unknown[], busy: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const programmaticUntil = useRef(0);
  const previousCount = useRef(0);
  const [stuck, setStuck] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const node = scrollRef.current;
    if (!node) return;
    // Ignore the scroll events this raises; a smooth scroll emits them well past the next frame.
    programmaticUntil.current =
      performance.now() + (behavior === "smooth" ? 500 : 50);
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    stickRef.current = true;
    setStuck(true);
    scrollToBottom("auto");
  }, [scrollToBottom]);

  // A send appends an item and gets one smooth scroll; the per-token updates in between
  // scroll instantly so the animations do not pile up.
  useEffect(() => {
    const appended = items.length !== previousCount.current;
    previousCount.current = items.length;
    if (appended) {
      stickRef.current = true;
      setStuck(true);
    }
    if (stickRef.current) scrollToBottom(appended ? "smooth" : "auto");
  }, [items, scrollToBottom]);

  const onScroll = useCallback(() => {
    if (performance.now() < programmaticUntil.current) return;
    const node = scrollRef.current;
    if (!node) return;
    const stick =
      node.scrollHeight - node.scrollTop - node.clientHeight < STICK_PX;
    stickRef.current = stick;
    setStuck(stick);
  }, []);

  return { scrollRef, onScroll, showLatest: busy && !stuck, jumpToLatest };
}
