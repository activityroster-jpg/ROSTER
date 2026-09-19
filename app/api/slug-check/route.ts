import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/cf/bindings";
import { validateSlug } from "@/lib/tenant/reserved";
import { slugCheckSchema } from "@/lib/validation/signup";

export const dynamic = "force-dynamic";

/** Public slug-availability check. Cheap, rate-limit-worthy, no auth. */
export async function POST(req: Request) {
  const parsed = slugCheckSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ available: false, reason: "format" }, { status: 400 });
  }

  const validation = validateSlug(parsed.data.slug);
  if (!validation.ok) {
    return NextResponse.json({ available: false, reason: validation.reason });
  }

  const { control } = await getRepositories();
  const taken = await control.slugTaken(validation.slug);
  return NextResponse.json({ available: !taken, reason: taken ? "taken" : undefined });
}
