import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { listForInstructor } from "@/lib/services/notifications";
import { NotificationsList, type NotificationUi } from "@/components/portal/NotificationsList";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalNotificationsPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p>
      </Card>
    );
  }

  const rows = await listForInstructor(repos, ctx, me.id);
  const items: NotificationUi[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    when: n.createdAt.toISOString().slice(0, 16).replace("T", " "),
    read: n.readAt != null,
  }));

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-semibold text-navy">Notifications</h1>
      <NotificationsList items={items} />
    </div>
  );
}
