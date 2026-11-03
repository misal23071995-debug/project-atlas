"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, MINUTE / 4);
  return () => clearInterval(timer);
}

// Rounded to the minute so the snapshot stays the same between ticks
function getSnapshot() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

function getServerSnapshot() {
  return null;
}

// The current time, updated every minute. Null on the server and during hydration, so the markup matches.
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
