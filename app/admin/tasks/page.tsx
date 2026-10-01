import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { TaskPlanner, type TaskRow } from "@/components/admin/TaskPlanner";

export const dynamic = "force-dynamic";

export default async function AdminTasksPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  let rows: TaskRow[] = [];
  try {
    rows = (await platform.listTasks()).map((t) => ({
      id: t.id, title: t.title, category: t.category, priority: t.priority, dueDate: t.dueDate, status: t.status,
    }));
  } catch {
    // table may not exist until the migration is applied
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Task planner</h1>
      <p className="mb-6 text-sm text-slate-500">Your own to-do board — add tasks with a category, priority and due date, and move them Upcoming → Working → Complete.</p>
      <TaskPlanner tasks={rows} />
    </div>
  );
}
