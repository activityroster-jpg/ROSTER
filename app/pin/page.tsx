import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { PinForm } from "@/components/auth/PinForm";

export const dynamic = "force-dynamic";

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const h = new Headers(await headers());
  const s = await (await getAuth()).api.getSession({ headers: h });
  if (!s?.user) redirect("/sign-in");
  const { control } = await getRepositories();
  const sec = await control.getUserSecurity(s.user.id);
  if (!sec?.pinHash) redirect(`/set-pin?next=${encodeURIComponent(next)}`);
  const hasPassword = await control.hasCredentialPassword(s.user.id);
  return <PinForm mode="enter" next={next} hasPassword={hasPassword} />;
}
