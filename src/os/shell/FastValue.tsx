// src/os/shell/FastValue.tsx
//
// Adopted from the researched pattern: reads one field off the
// telemetry store and writes it straight into a DOM node via ref,
// subscribing outside React's render lifecycle. Use this for any value
// that could update often once a real push transport exists (see note
// in telemetry-store.ts) -- for the current 1.5s polling cadence it's
// mostly future-proofing, but it's real and wired to real data now, not
// a placeholder.

import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../state/telemetry-store.ts';

type Field = 'activeNode' | 'completedSteps' | 'totalSteps' | 'missionStatus';

export function FastValue({ field, suffix = '', className }: { field: Field; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Set initial value immediately (subscribe() only fires on change).
    const initial = useTelemetryStore.getState()[field];
    if (ref.current) ref.current.textContent = `${initial}${suffix}`;

    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const value = state[field];
      if (ref.current) ref.current.textContent = `${value}${suffix}`;
    });
    return unsubscribe;
  }, [field, suffix]);

  return <span ref={ref} className={className} />;
}
