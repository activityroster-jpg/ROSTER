import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, twoFactor } from "better-auth/plugins";
import type { Database } from "@/lib/db/client";
import { account, session, twoFactor as twoFactorTable, user, verification } from "@/lib/db/schema";
import { getDb, getEnv, type CloudflareEnv } from "@/lib/cf/bindings";
import { sendEmail } from "@/lib/mail";

/**
 * Better Auth is the source of truth for authentication (email/password, magic
 * link, 2FA). Org membership + RBAC live in our own `membership` table and are
 * resolved per request in lib/tenant — the auth session only proves *who* the
 * user is, never *which centre* they may act in.
 *
 * The instance is built per request because D1 is a request-scoped binding.
 */
export function createAuth(db: Database, env: CloudflareEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL ?? `https://${env.APP_APEX_DOMAIN}`,
    secret: env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, session, account, verification, twoFactor: twoFactorTable },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    // One session cookie across every centre's subdomain; membership is still
    // re-checked per request server-side.
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
        domain: `.${env.APP_APEX_DOMAIN}`,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            to: email,
            subject: "Your ActivityRoster sign-in link",
            html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p>`,
          });
        },
      }),
      twoFactor(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let cached: Auth | null = null;

/** The request-scoped Better Auth instance. */
export async function getAuth(): Promise<Auth> {
  if (cached) return cached;
  cached = createAuth(await getDb(), getEnv());
  return cached;
}
