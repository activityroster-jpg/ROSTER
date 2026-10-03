import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { PinForm } from "@/components/auth/PinForm";

export const dynamic = "force-dynamic";

export default async function SetPinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const h = new Headers(await headers());
  const s = await (await getAuth()).api.getSession({ headers: h });
  if (!s?.user) redirect("/sign-in");
  return <PinForm mode="set" next={next} userId={s.user.id} />;
}
