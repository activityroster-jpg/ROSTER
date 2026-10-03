import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { JoinCentre } from "@/components/mobile/JoinCentre";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect("/app");
  const { control } = await getRepositories();
  const ms = await control.membershipsForUser(s.user.id);
  const pending = ms.find((m) => m.status === "requested");
  const hasActive = ms.some((m) => m.status === "active" && m.orgStatus === "active");
  return <JoinCentre pendingCentre={pending?.name ?? null} canSkip={hasActive} />;
}
