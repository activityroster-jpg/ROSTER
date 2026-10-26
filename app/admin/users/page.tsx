import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getRepositories } from "@/lib/cf/bindings";
import { Card } from "@/components/ui";
import { RemoveUserButton } from "@/components/admin/RemoveUserButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

const LIMIT = 500;
const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "never");

/** Every login on the platform: who they are, which centres they're in, and a way to remove one. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { email: me } = await requirePlatformAdmin();
  const q = String((await searchParams).q ?? "").slice(0, 100);
  const { control } = await getRepositories();
  const users = await control.listAllUsers({ search: q, limit: LIMIT });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every login on ActivityRoster, newest first. Removing one deletes the login and anonymises the person in every centre they&apos;re in;
          roster and pay history stays as &ldquo;Former staff member&rdquo;. The owner of a live centre can&apos;t be removed until the centre has another owner.
        </p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Search</button>
        {q ? <Link href="/admin/users" className="px-2 py-2 text-sm text-slate-500">Clear</Link> : null}
      </form>
      <Card>
        <p className="mb-3 text-sm text-slate-500">{users.length === LIMIT ? `Showing the newest ${LIMIT}. Search to find others.` : `${users.length} ${users.length === 1 ? "login" : "logins"}${q ? ` matching “${q}”` : ""}.`}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Person</th>
                <th className="py-2 pr-3">Centres</th>
                <th className="py-2 pr-3 whitespace-nowrap">Joined</th>
                <th className="py-2 pr-3 whitespace-nowrap">Last signed in</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-navy">{u.name || "—"}</div>
                    <div className="text-slate-500">{u.email}{u.emailVerified ? null : <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">unverified</span>}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {u.centres.length === 0 ? <span className="text-slate-400">none</span> : (
                      <ul className="space-y-0.5">
                        {u.centres.map((c) => (
                          <li key={c.organisationId}>
                            <Link href={`/admin/centres/${c.organisationId}`} className="text-teal hover:underline">{c.name}</Link>
                            <span className="text-slate-500"> · {c.role}{c.status !== "active" ? ` (${c.status})` : ""}{c.orgStatus !== "active" ? ` · centre ${c.orgStatus}` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-slate-600">{fmt(u.createdAt)}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap tabular-nums text-slate-600">{fmt(u.lastActiveAt)}</td>
                  <td className="py-2.5 text-right">
                    {u.email.toLowerCase() === me.toLowerCase() ? <span className="text-xs text-slate-400">you</span> : <RemoveUserButton userId={u.id} email={u.email} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
