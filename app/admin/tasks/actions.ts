"use server";

import { revalidatePath } from "next/cache";
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

export async function createTaskAction(input: { title: string; category?: string; priority?: string; dueDate?: string; status?: string }): Promise<TaskResult> {
  const r = await repo();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Enter a task" };
  const priority: TaskPriority = (TASK_PRIORITIES as readonly string[]).includes(String(input.priority)) ? (input.priority as TaskPriority) : "medium";
  const status: TaskStatus = (TASK_STATUSES as readonly string[]).includes(String(input.status)) ? (input.status as TaskStatus) : "upcoming";
  const dueDate = input.dueDate && ISO.test(input.dueDate) ? input.dueDate : null;
  await r.createTask({ title, category: (input.category ?? "").trim() || null, priority, dueDate, status });
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
  if (patch.title !== undefined) { const t = patch.title.trim(); if (!t) return { ok: false, error: "Title can't be empty" }; clean.title = t; }
  if (patch.category !== undefined) clean.category = (patch.category ?? "").toString().trim() || null;
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
