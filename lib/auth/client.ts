"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

/**
 * Browser auth client. baseURL defaults to the current origin, so it talks to
 * the /api/auth handler on whichever subdomain the user is on; the session
 * cookie is scoped to `.activityroster.com` for cross-subdomain sign-in.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
