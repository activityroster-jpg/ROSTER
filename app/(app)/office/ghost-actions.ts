"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { GHOST_COOKIE, verifyGhostToken } from "@/lib/auth/ghost";
import { authSecret } from "@/lib/security/secrets";
import { recordSecurityEvent } from "@/lib/security/events";

/**
 * Leave Ghost Mode: clear the cookie, log the end owner-side, and go back to
 * the centre's page in the platform admin. Deliberately does NOT use
 * requireTenant (server actions are refused in ghost mode).
 */
export async function exitGhostAction(): Promise<void> {
  const env = getEnv();
  const jar = await cookies();
  const claims = await verifyGhostToken(authSecret(env), jar.get(GHOST_COOKIE)?.value);
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });

  jar.set(GHOST_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: 0 });

  if (claims && s?.user?.id === claims.adminUserId) {
    const { control } = await getRepositories();
    const org = await control.organisationById(claims.organisationId);
    await recordSecurityEvent("ghost_end", { userId: claims.adminUserId, organisationId: claims.organisationId, meta: { slug: org?.slug ?? null } });
    redirect(`https://${env.APP_APEX_DOMAIN}/admin/centres/${claims.organisationId}`);
  }
  redirect(`https://${env.APP_APEX_DOMAIN}/admin`);
}
