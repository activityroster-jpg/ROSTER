import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AppSignIn } from "@/components/mobile/AppSignIn";
import { appLandingAction } from "./actions";

export const dynamic = "force-dynamic";

/** App start: signed in → straight to the right place; otherwise sign in / create account. */
export default async function AppStartPage() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (s?.user) redirect(await appLandingAction());
  return <AppSignIn />;
}
