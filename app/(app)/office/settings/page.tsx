import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { GeneralSettingsForm } from "@/components/office/GeneralSettingsForm";
import { ConfigManager, type ConfigItem } from "@/components/office/ConfigManager";
import { BreakPolicyForm } from "@/components/office/BreakPolicyForm";
import { CompanyCodeCard } from "@/components/office/CompanyCodeCard";
import { CourseScheduleDefaults } from "@/components/office/CourseScheduleDefaults";
import { TimeclockSettingsForm } from "@/components/office/TimeclockSettingsForm";
import { parseDefaultSchedule } from "@/lib/domain";
import { packKeyFor } from "@/lib/rules/working-time/packs";
import { loadPack } from "@/lib/rules/working-time/load";
import { termRangesOf } from "@/lib/services/working-time";
import { RotaTemplateForm } from "@/components/office/RotaTemplateForm";
import { parseRotaTemplate } from "@/lib/rota/template";
import { RetentionForm } from "@/components/office/RetentionForm";
import { retentionPlan } from "@/lib/services/retention";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const t = repos.tenant;
  const [settings, slots, roles, grades, compliance, courseTypes] = await Promise.all([
    t.orgSettings.list(ctx),
    t.sessionSlot.list(ctx),
    t.roleType.list(ctx),
    t.qualificationType.list(ctx),
    t.complianceType.list(ctx),
    t.courseType.list(ctx),
  ]);
  const scheduleItems = courseTypes
    .filter((c) => c.active && c.listed)
    .map((c) => ({ id: c.id, name: c.name, schedule: parseDefaultSchedule(c.defaultSchedule) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const s = settings[0];
  const joinCode = await repos.control.ensureJoinCode(ctx.organisationId);
  const retention = await retentionPlan(repos, ctx, s, new Date());
  const packKey = packKeyFor(organisation.jurisdiction);
  const loaded = packKey ? await loadPack(repos.db, packKey) : null;
  const packStatus = loaded
    ? { name: loaded.pack.name, version: loaded.pack.version, verified: loaded.pack.verified, unverifiedCount: loaded.pack.bands.reduce((n, b) => n + b.unverified.length, 0), source: loaded.source }
    : null;

  const toItems = <T extends { id: string; active: boolean }>(rows: T[], label: (r: T) => string, meta?: (r: T) => string, edit?: (r: T) => string): ConfigItem[] =>
    rows.map((r) => ({ id: r.id, label: label(r), active: r.active, meta: meta?.(r), editValue: edit?.(r) }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Shape ActivityRoster to how your centre runs — courses, certs, roles, checks and slots are all yours to edit.
        Retiring an item hides it from new records but keeps your history intact (nothing is deleted).
      </p>

      <Card className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-navy">Company code · instructor app</h2>
          <a href="/learn?topic=app" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
        </div>
        <CompanyCodeCard code={joinCode} />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">General</h2>
        <p className="mb-3 text-xs text-slate-500">How early to warn about expiring certs, and which checks to enforce when rostering.</p>
        <GeneralSettingsForm
          schedulingMode={s?.schedulingMode ?? "session"}
          alertLeadDays={s?.alertLeadDays ?? 30}
          currency={s?.currency ?? "GBP"}
          privacyNoticeUrl={s?.privacyNoticeUrl ?? ""}
          dailyDigestEnabled={Boolean(s?.dailyDigestEnabled)}
          dailyDigestHour={s?.dailyDigestHour ?? 6}
          workingTimeMode={s?.workingTimeMode ?? "block_override"}
          termDates={termRangesOf(s)}
          packStatus={packStatus}
          idleTimeoutMinutes={s?.idleTimeoutMinutes ?? 30}
          enforceLicenceChecks={Boolean(s?.enforceLicenceChecks)}
          enforceRatioChecks={Boolean(s?.enforceRatioChecks)}
          enforceConflictChecks={Boolean(s?.enforceConflictChecks)}
          enforceAvailabilityChecks={s?.enforceAvailabilityChecks ?? true}
        />
      </Card>

      <div id="retention" className="mb-6">
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-navy">Data retention</h2>
          <a href="/learn?topic=retention" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
        </div>
        <p className="mb-3 text-xs text-slate-500">How long each kind of record is kept. The defaults follow the published retention schedule; statutory minimums cannot be shortened.</p>
        <RetentionForm initial={retention.policy} pending={retention.pending} />
      </Card>
      </div>

      <div id="rota-pdf" className="mb-6">
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-navy">Roster PDF</h2>
          <a href="/learn?topic=roster" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
        </div>
        <p className="mb-3 text-xs text-slate-500">What the downloaded roster shows and how it is laid out. You chose this when you set up; change it here any time.</p>
        <RotaTemplateForm initial={parseRotaTemplate(s?.rotaTemplate)} />
      </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-navy">Course default schedule</h2>
            <a href="/learn?topic=settings" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
          </div>
          <p className="mb-2 text-xs text-slate-500">How many sessions each course has and when they run. “Add a course” fills these in for you.</p>
          <CourseScheduleDefaults items={scheduleItems} />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Time clock &amp; pay</h2>
          <p className="mb-3 text-xs text-slate-500">Hours always come from the roster. Turn the clock on if you also want instructors to clock in and out from the app.</p>
          <TimeclockSettingsForm timeclockEnabled={Boolean(s?.timeclockEnabled)} paySource={(s?.paySource ?? "roster") as "roster" | "clock"} />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Lunch breaks</h2>
          <p className="mb-3 text-xs text-slate-500">Applied to worked hours in Payroll and its exports. Unpaid breaks are deducted from pay.</p>
          <BreakPolicyForm afterMinutes={s?.breakAfterMinutes ?? 360} breakMinutes={s?.breakMinutes ?? 0} paid={Boolean(s?.breakPaid)} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigManager
          title="Session slots"
          kind="slot"
          items={toItems(slots, (x) => `${x.code} · ${x.label}`, (x) => `${x.startTime}–${x.endTime}`, (x) => x.label)}
          extraFields={[
            { name: "code", label: "Short code (AM, PM or EV)", type: "text", placeholder: "AM" },
            { name: "startTime", label: "Start", type: "time" },
            { name: "endTime", label: "End", type: "time" },
          ]}
        />
        <ConfigManager
          title="Roles"
          kind="role"
          items={toItems(roles, (r) => r.name, (r) => [r.countsTowardRatio ? "counts in ratio" : "", r.isSafetyCover ? "safety cover" : "", r.isFirstAider ? "first aider" : ""].filter(Boolean).join(" · "))}
          extraFields={[
            { name: "countsTowardRatio", label: "Counts in ratio", type: "checkbox" },
            { name: "isSafetyCover", label: "Safety cover", type: "checkbox" },
            { name: "isFirstAider", label: "First aider", type: "checkbox" },
          ]}
        />
        <ConfigManager
          title="Certs"
          kind="grade"
          items={toItems(grades, (g) => g.name, (g) => g.discipline ?? "")}
          extraFields={[
            { name: "discipline", label: "Discipline", type: "text" },
            { name: "rank", label: "Rank", type: "number" },
            { name: "expiryTracked", label: "Has an expiry date", type: "checkbox" },
          ]}
        />
        <ConfigManager
          title="Checks (DBS, first aid, safeguarding…)"
          kind="compliance"
          items={toItems(compliance, (c) => c.name, (c) => [c.mandatory ? "must have" : "optional", c.isVetting ? "vetting: status only" : ""].filter(Boolean).join(" · "))}
          extraFields={[
            { name: "mandatory", label: "Must have to be rostered", type: "checkbox" },
            { name: "expiryTracked", label: "Has an expiry date", type: "checkbox" },
            { name: "isVetting", label: "Vetting check (DBS, PVG, AccessNI, Garda): record the status and reference only, never the certificate", type: "checkbox" },
          ]}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Equipment types and location categories are managed on the{" "}
        <a href="/office/equipment" className="font-medium text-teal hover:underline">Equipment</a> and{" "}
        <a href="/office/locations" className="font-medium text-teal hover:underline">Locations</a> tabs.
      </p>

      <Card className="mt-8">
        <h2 className="mb-1 font-semibold text-navy">More settings</h2>
        <p className="mb-3 text-xs text-slate-500">These areas have their own page — a change there is the same as here.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { href: "/office/integrations", label: "Integrations & import", desc: "Booking-system feeds & spreadsheet import" },
            { href: "/office/equipment", label: "Equipment & boats", desc: "Equipment types, quantities & your fleet" },
            { href: "/office/locations", label: "Locations", desc: "Location categories, sites & operating areas" },
            { href: "/office/course-setup", label: "Course setup", desc: "Course types, ratios & defaults" },
            { href: "/office/staff", label: "Instructors & pay", desc: "Instructors, their certs & pay rates" },
          ].map((l) => (
            <a key={l.href} href={l.href} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal hover:bg-slate-50">
              <span><span className="font-medium text-navy">{l.label}</span><span className="block text-xs text-slate-400">{l.desc}</span></span>
              <span className="text-slate-300">→</span>
            </a>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold text-navy">Data &amp; billing</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/api/office/export" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Export all data (JSON)
          </a>
          <a href="/api/billing/portal" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Manage billing
          </a>
          <a href="/security" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Security &amp; 2FA
          </a>
          <a href="/set-pin?next=/office/settings" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Change login PIN
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Your data is stored in the EU. Config is deactivate-never-delete: retiring an item keeps historical records
          intact.
        </p>
      </Card>
    </div>
  );
}
