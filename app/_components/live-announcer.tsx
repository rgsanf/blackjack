"use client";

import { useEffect, useEffectEvent, useState } from "react";

export interface LiveAnnouncerProps {
  /** An already-composed, self-contained sentence. */
  message: string;
}

/**
 * The single live region for the whole app.
 *
 * The naive approach - aria-live on the odds themselves - would fire roughly fifteen
 * announcements per click and, because live regions announce only what CHANGED, would
 * produce context-free number soup: "13.2 percent... 14.1 percent...". So every visible
 * odds value is a plain <output> with no live semantics, and one composed sentence is
 * announced here instead.
 *
 * aria-atomic is the load-bearing attribute: without it assistive tech reads only the
 * changed substring rather than the whole sentence.
 */
export function LiveAnnouncer({ message }: LiveAnnouncerProps) {
  const [announced, setAnnounced] = useState("");

  // useEffectEvent lets the timer read the latest message without the effect
  // resubscribing, so rapid clicks keep resetting one timer.
  const flush = useEffectEvent(() => setAnnounced(message));

  useEffect(() => {
    // Only the ANNOUNCEMENT is debounced; the visible numbers update immediately.
    // 700ms is long enough that dealing a three-card hand in quick succession yields
    // one announcement of the final state rather than three of intermediate ones.
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
    // `flush` is deliberately absent: useEffectEvent returns a stable, non-reactive
    // function, so listing it would defeat the point and re-run this on every render.
  }, [message]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announced}
    </div>
  );
}
