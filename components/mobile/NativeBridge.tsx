"use client";

import { useEffect } from "react";
import { enablePush, initDeepLinks, isNative, pushEnabled } from "@/lib/mobile/native";

/**
 * Mounted in the app's layouts. Inside the native shell it (re)registers for
 * push on each launch once the user has opted in, so a rotated token never goes
 * stale, and listens for our universal links so they open in the app.
 * Renders nothing; does nothing in a normal browser.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNative()) return;
    initDeepLinks();
    if (pushEnabled()) void enablePush();
  }, []);
  return null;
}
