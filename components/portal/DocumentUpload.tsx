"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentUpload({
  kind,
  itemId,
  hasDoc,
}: {
  kind: "compliance" | "qualification";
  itemId: string;
  hasDoc: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("itemId", itemId);
      form.set("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) setError(data.error ?? "Upload failed");
      else router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="cursor-pointer text-xs font-medium text-teal hover:underline">
      {busy ? "Uploading…" : hasDoc ? "Replace" : "Upload"}
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onChange}
        disabled={busy}
      />
      {error ? <span className="ml-2 text-port">{error}</span> : null}
    </label>
  );
}
