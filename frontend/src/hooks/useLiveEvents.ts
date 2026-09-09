import { useEffect, useRef } from "react";
import type { AlertiousEvent } from "../types";

/**
 * Subscribes to the backend's SSE event stream and invokes onEvent for every
 * newly created event. Falls back silently if EventSource is unavailable.
 */
export function useLiveEvents(onEvent: (event: AlertiousEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    source.addEventListener("event_created", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        callbackRef.current(data);
      } catch {
        /* ignore malformed payloads */
      }
    });
    source.onerror = () => {
      // Browser EventSource auto-reconnects; nothing to do here.
    };
    return () => source.close();
  }, []);
}
