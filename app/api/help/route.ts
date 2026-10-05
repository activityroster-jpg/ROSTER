import { NextResponse } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/help/search";
import { recordHelpQuestion } from "@/lib/services/help";
import { resolveTenant } from "@/lib/tenant/resolve";
import { can } from "@/lib/auth/rbac";
import { getRepositories } from "@/lib/cf/bindings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(1).max(300),
  path: z.string().max(300).optional(),
  surface: z.enum(["office", "site"]),
});

/**
 * The help assistant. No AI: the answer is a search over the Learning Centre
 * and the setup FAQ (lib/help/search). Questions asked inside a centre's
 * office by one of its office users are kept for 30 days (no answers, no
 * names); questions from the public site are never stored.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`help:${clientIp(req)}`, 60, 60 * 60);
  if (!limit.allowed) return tooManyRequests();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question of up to 300 characters." }, { status: 400 });
  const { question, path, surface } = parsed.data;
  const reply = answerQuestion(question, path);

  if (surface === "office") {
    try {
      const res = await resolveTenant(req.headers);
      if (res.ok && can(res.ctx, "office.view")) {
        await recordHelpQuestion(await getRepositories(), res.ctx, { question, reply, path: path ?? null });
      }
    } catch (err) {
      // Recording is a nice-to-have; the answer still goes back.
      console.warn("[help] could not record question:", (err as Error).message);
    }
  }
  return NextResponse.json(reply);
}
