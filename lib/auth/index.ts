import { codeEmailHtml } from "@/lib/mail/code-email";
import { readInviteNote } from "./invite-note";
import { inviteEmail } from "@/lib/mail/invite-email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, magicLink, twoFactor } from "better-auth/plugins";
import type { Database } from "@/lib/db/client";
import { account, session, twoFactor as twoFactorTable, user, verification } from "@/lib/db/schema";
import { getDb, getEnv, type CloudflareEnv } from "@/lib/cf/bindings";
import { sendEmail } from "@/lib/mail";
import { notifySecurityChange, recordSecurityEvent } from "@/lib/security/events";
import { authSecret } from "@/lib/security/secrets";
import { createAuthMiddleware } from "better-auth/api";
import { LV_PENDING_COOKIE, LV_PROVEN_MAX_AGE_S, lvPendingValue } from "./login-verify";

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
    // Hard-fails in production when the secret is missing (see lib/security/secrets).
    secret: authSecret(env),
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
      minPasswordLength: 8,
      requireEmailVerification: true,
      // A password reset logs out every other session — an intruder who
      // triggered the reset (or was already inside) loses access.
      revokeSessionsOnPasswordReset: true,
      // Tell the user, and log it, whenever their password is reset.
      onPasswordReset: async ({ user: u }) => {
        await notifySecurityChange(u.id, "Your ActivityRoster password was reset", "<p>Your password was just reset via the “Forgot password” link, and every other signed-in session has been logged out.</p>");
        await recordSecurityEvent("password_changed", { userId: u.id, meta: { via: "reset" } });
      },
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your ActivityRoster password",
          html: `
            <p>We received a request to reset your ActivityRoster password.</p>
            <p><a href="${url}" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
            <p style="color:#64748b;font-size:12px">If you didn't ask for this, you can safely ignore this email. The link expires shortly.</p>
            <p style="color:#64748b;font-size:12px">Or paste this into your browser:<br>${url}</p>
          `,
        });
      },
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
    // A sign-in that came from an emailed link or code has just proved the
    // email address, so the office's "check your email" step must not ask for
    // a second code (see lib/auth/login-verify.ts). Leave the proof bound to
    // the new session; the person still chooses "stay signed in?" and a PIN.
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!EMAIL_PROOF_PATHS.has(ctx.path)) return;
        const created = ctx.context.newSession;
        if (!created?.session?.id) return;
        ctx.setCookie(LV_PENDING_COOKIE, await lvPendingValue(authSecret(env), created.session.id), {
          httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: LV_PROVEN_MAX_AGE_S,
        });
      }),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      // Six-digit codes for the mobile app's sign-up (typing a code beats
      // tapping an email link on a phone). Also usable for password resets.
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        async sendVerificationOTP({ email, otp, type }) {
          const kind = type === "email-verification"
            ? { subject: `${otp} is your ActivityRoster email confirmation code`, label: "email confirmation code" }
            : type === "forget-password"
              // Reset codes stay out of the subject (lock screens show subjects); sign-in and verification codes go in it.
              ? { subject: "Reset your ActivityRoster password", label: "password reset code" }
              : { subject: `${otp} is your ActivityRoster sign-in code`, label: "sign-in code" };
          await sendEmail({
            to: email,
            subject: kind.subject,
            code: true,
            html: codeEmailHtml({ label: kind.label, code: otp, details: ["Enter it in the ActivityRoster app."], footnote: "It expires in 10 minutes. If you didn't request it, you can ignore this email." }),
          });
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const invite = await readInviteNote(email);
          if (invite) {
            await sendEmail({ to: email, ...inviteEmail({ ...invite, url, email }) });
            return;
          }
          await sendEmail({
            to: email,
            subject: "Your ActivityRoster sign-in link",
            html: `
              <p>Here's your secure link to sign in to ActivityRoster.</p>
              <p>If this is your first time, it'll take you straight in to set up your account (your password &amp; PIN).</p>
              <p><a href="${url}" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in to ActivityRoster</a></p>
              <p style="color:#64748b;font-size:12px">This link works once and expires shortly. If you didn't request it, you can ignore this email.</p>
              <p style="color:#64748b;font-size:12px">Or paste this into your browser:<br>${url}</p>
            `,
          });
        },
      }),
      // Two-factor is optional. People choose their second step: an
      // authenticator app (TOTP) or a one-time code by email.
      twoFactor({
        otpOptions: {
          async sendOTP({ user, otp }) {
            await sendEmail({
              to: user.email,
              subject: `${otp} is your ActivityRoster verification code`,
              code: true,
              html: codeEmailHtml({ label: "verification code", code: otp, footnote: "It expires shortly. If you didn't request it, you can ignore this email." }),
            });
          },
        },
      }),
    ],
  });
}

/** Endpoints whose success proves the person holds the email address. */
const EMAIL_PROOF_PATHS = new Set(["/magic-link/verify", "/verify-email", "/sign-in/email-otp", "/email-otp/verify-email"]);

export type Auth = ReturnType<typeof createAuth>;

let cached: Auth | null = null;

/** The request-scoped Better Auth instance. */
export async function getAuth(): Promise<Auth> {
  if (cached) return cached;
  cached = createAuth(await getDb(), getEnv());
  return cached;
}
