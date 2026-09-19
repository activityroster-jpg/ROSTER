import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Better Auth catch-all handler (sign-in, sign-up, magic link, 2FA, session).
 * The instance is built per request because D1 is a request-scoped binding.
 */
async function handler(req: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(req);
}

export { handler as GET, handler as POST };
