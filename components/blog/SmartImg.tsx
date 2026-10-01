"use client";

import { useState } from "react";

/**
 * An <img> that falls back to a local photo if its primary src fails to load
 * (e.g. a self-hosted cover whose R2 object is missing, or a stale/placeholder
 * key). Keeps the blog looking right even when cover data is incomplete.
 */
export function SmartImg({
  src,
  fallback,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? fallback : src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => { if (!failed) setFailed(true); }}
    />
  );
}
