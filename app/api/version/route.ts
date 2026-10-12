import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/build-id";

export const dynamic = "force-dynamic";

/** Which build is live. Public, tiny and never cached: open pages poll it when they regain focus. */
export function GET() {
  return NextResponse.json({ build: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
