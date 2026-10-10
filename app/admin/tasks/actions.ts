"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/db/schema";

export type TaskResult = { ok: boolean; error?: string };

async function repo() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const titleSchema = z.string().transform((v) => v.replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "Enter a task").max(200, "Keep the title under 200 characters"));
const categorySchema = z.string().nullable().optional().transform((v) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || null);

export async function createTaskAction(input: { title: string; category?: string; priority?: string; dueDate?: string; status?: string }): Promise<TaskResult> {
  const r = await repo();
  const parsedTitle = titleSchema.safeParse(input.title ?? "");
  if (!parsedTitle.success) return { ok: false, error: parsedTitle.error.issues[0]?.message ?? "Enter a task" };
  const title = parsedTitle.data;
  const priority: TaskPriority = (TASK_PRIORITIES as readonly string[]).includes(String(input.priority)) ? (input.priority as TaskPriority) : "medium";
  const status: TaskStatus = (TASK_STATUSES as readonly string[]).includes(String(input.status)) ? (input.status as TaskStatus) : "upcoming";
  const dueDate = input.dueDate && ISO.test(input.dueDate) ? input.dueDate : null;
  const category = categorySchema.safeParse(input.category ?? null);
  if (!category.success) return { ok: false, error: "Check the category" };
  await r.createTask({ title, category: category.data, priority, dueDate, status });
  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function setTaskStatusAction(id: string, status: string): Promise<TaskResult> {
  const r = await repo();
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status" };
  const updated = await r.setTaskStatus(id, status as TaskStatus);
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function updateTaskAction(id: string, patch: { title?: string; category?: string | null; priority?: string; dueDate?: string | null }): Promise<TaskResult> {
  const r = await repo();
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = titleSchema.safeParse(patch.title);
    if (!t.success) return { ok: false, error: t.error.issues[0]?.message === "Enter a task" ? "Title can't be empty" : t.error.issues[0]?.message ?? "Check the title" };
    clean.title = t.data;
  }
  if (patch.category !== undefined) {
    const c = categorySchema.safeParse(patch.category);
    if (!c.success) return { ok: false, error: "Check the category" };
    clean.category = c.data;
  }
  if (patch.priority !== undefined && (TASK_PRIORITIES as readonly string[]).includes(patch.priority)) clean.priority = patch.priority;
  if (patch.dueDate !== undefined) clean.dueDate = patch.dueDate && ISO.test(patch.dueDate) ? patch.dueDate : null;
  const updated = await r.updateTask(id, clean);
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<TaskResult> {
  const r = await repo();
  await r.deleteTask(id);
  revalidatePath("/admin/tasks");
  return { ok: true };
}
