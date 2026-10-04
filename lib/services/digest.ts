import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { createTenantRepositories, type Repositories } from "@/lib/db/repositories";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { addDays, getWeekRota, weekStart } from "./schedule";
import { describeProblem, findProblems } from "./problems";
import { fmtWallTime, hourIn, isoDateInTz } from "@/lib/domain";

const SLOT: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };


/**
 * Opt-in morning roster email for every admin of a centre: the offline fallback
 * from the compliance spec. Runs from the hourly tick; a KV marker makes it
 * once per centre per day. Uses a system context per centre, so every read
 * stays tenant-scoped, and never includes contact details, only names, roles,
 * times and places, plus a link to the printable roster.
 */
export async function sendDailyDigests(db: Database, env: CloudflareEnv, now = new Date()): Promise<{ checked: number; sent: number; skipped: number }> {
  const platform = new PlatformRepository(db);
  const control = new ControlPlaneRepository(db);
  const repos: Repositories = { db, control, tenant: createTenantRepositories(db) } as Repositories;
  let checked = 0, sent = 0, skipped = 0;
  for (const org of await platform.listOrganisations()) {
    if (org.status !== "active") continue;
    const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "daily-digest" };
    const settings = (await repos.tenant.orgSettings.list(ctx))[0];
    // "6am" means 6am where the centre is: its zone was detected at sign-up and is used only here.
    const tz = settings?.timezone || undefined;
    const hour = hourIn(tz, now.getTime());
    const today = isoDateInTz(now, tz);
    if (!settings?.dailyDigestEnabled || settings.dailyDigestHour !== hour) continue;
    checked++;
    const marker = `digest:${org.id}:${today}`;
    if (await env.TENANT_CACHE.get(marker)) { skipped++; continue; }
    const admins = await control.adminEmailsForOrg(org.id);
    if (admins.length === 0) { skipped++; continue; }
    const rota = await getWeekRota(repos, ctx, weekStart(new Date(`${today}T00:00:00Z`)));
    const day = rota.find((d) => d.date === today);
    const sessions = day?.sessions ?? [];
    const time = (ms: number) => fmtWallTime(ms);
    const nice = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const rows = sessions.map((s) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(s.courseName)}</strong><br><span style="color:#64748b">${SLOT[s.slot] ?? s.slot} ${time(s.startAt)}–${time(s.endAt)}${s.locations.length ? ` · ${escapeHtml(s.locations.join(", "))}` : ""}</span></td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${s.staff.length ? s.staff.map((m) => `${escapeHtml(m.name)} <span style="color:#64748b">(${escapeHtml(m.role)}${m.status === "confirmed" ? "" : m.status === "declined" ? ", declined" : ", unconfirmed"})</span>`).join("<br>") : '<span style="color:#b91c1c">nobody rostered</span>'}${s.understaffed || s.missingSafetyCover ? '<br><span style="color:#b91c1c">⚠ short-staffed or no safety cover</span>' : ""}</td></tr>`).join("");
    const problems = await findProblems(repos, ctx, { from: today, to: addDays(today, 1) }).catch(() => null);
    const problemsHtml = problems && problems.problems.length ? `<p style="margin-top:12px"><strong style="color:#b91c1c">⚠ ${problems.problems.length} problem${problems.problems.length === 1 ? "" : "s"} today</strong></p><ul style="margin:4px 0 0 18px;padding:0;font-size:13px;color:#334155">${problems.problems.slice(0, 12).map((p) => `<li>${escapeHtml(describeProblem(p))}</li>`).join("")}</ul>` : "";
    const url = `https://${org.slug}.${env.APP_APEX_DOMAIN}/office/rota`;
    const html = sessions.length
      ? `<p>Today's roster for <strong>${escapeHtml(org.name)}</strong>, ${nice}:</p><table style="border-collapse:collapse;width:100%;font-size:14px"><tr><th style="text-align:left;padding:6px 8px">Session</th><th style="text-align:left;padding:6px 8px">Who</th></tr>${rows}</table>${problemsHtml}<p style="margin-top:12px"><a href="${url}">Open the roster</a> to print it or save as PDF. The <a href="${url}/emergency">emergency sheet</a> has today's contacts.</p><p style="color:#64748b;font-size:12px">You asked for this email in Office → Settings. Switch it off there any time.</p>`
      : `<p>No sessions are rostered for <strong>${escapeHtml(org.name)}</strong> today, ${nice}.</p><p style="color:#64748b;font-size:12px">You asked for this email in Office → Settings. Switch it off there any time.</p>`;
    await Promise.all(admins.map((to) => sendEmail({ to, subject: `Today's roster · ${org.name} · ${nice}`, html }).catch(() => {})));
    await env.TENANT_CACHE.put(marker, "1", { expirationTtl: 36 * 3600 });
    sent++;
  }
  return { checked, sent, skipped };
}
