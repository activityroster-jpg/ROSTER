"use client";

import { useEffect } from "react";
import { enablePush, isNative, pushEnabled } from "@/lib/mobile/native";

/**
 * Mounted in the portal layout. Inside the app it (re)registers for push on
 * each launch once the user has opted in, so a rotated token never goes stale.
 * Renders nothing; does nothing in a normal browser.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNative() || !pushEnabled()) return;
    void enablePush();
  }, []);
  return null;
}
