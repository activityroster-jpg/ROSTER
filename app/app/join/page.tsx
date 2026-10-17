import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { JoinCentre } from "@/components/mobile/JoinCentre";
import { centresOfferedByName } from "@/app/app/actions";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect("/app");
  const { control } = await getRepositories();
  const ms = await control.membershipsForUser(s.user.id);
  const pending = ms.find((m) => m.status === "requested");
  const hasActive = ms.some((m) => m.status === "active" && m.orgStatus === "active");
  // Centres that already list this email among their instructors: offered by name, no code needed.
  const offered = await centresOfferedByName();
  return <JoinCentre pendingCentre={pending?.name ?? null} canSkip={hasActive} offered={offered} />;
}
