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
    // Every centre lives on its own subdomain, so redirects/callbacks to any
    // {slug}.apex must be trusted (Better Auth only trusts the baseURL by default).
    trustedOrigins: [
      `https://${env.APP_APEX_DOMAIN}`,
      `https://*.${env.APP_APEX_DOMAIN}`,
    ],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, session, account, verification, twoFactor: twoFactorTable },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    // New owners must confirm their email before they can get into their centre.
    // Better Auth sends the link on sign-up and signs them in once confirmed.
    emailVerification: {
      // We send the confirmation email explicitly after provisioning (see
      // /api/signup) so a mail hiccup can never fail account creation.
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your email to activate your ActivityRoster centre",
          html: `
            <p>Welcome to ActivityRoster!</p>
            <p>Confirm your email to activate your centre and sign in:</p>
            <p><a href="${url}" style="display:inline-block;background:#0072CE;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm my email</a></p>
            <p style="color:#64748b;font-size:12px">Or paste this link into your browser:<br>${url}</p>
          `,
        });
      },
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
      // Two-factor is optional. Members can enable an authenticator app (TOTP)
      // or receive a one-time code by email as their second factor.
      twoFactor({
        otpOptions: {
          async sendOTP({ user, otp }) {
            await sendEmail({
              to: user.email,
              subject: "Your ActivityRoster verification code",
              html: `<p>Your verification code is:</p><p style="font-size:22px;font-weight:700;letter-spacing:3px">${otp}</p><p style="color:#64748b;font-size:12px">It expires shortly. If you didn't request it, you can ignore this email.</p>`,
            });
          },
        },
      }),
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
