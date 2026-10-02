"use server";

import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { openSlots } from "@/lib/calls/slots";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { LETTER_SENDER } from "@/lib/marketing";

export type BookResult = { ok: boolean; error?: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const windowsFor = (ws: { dayOfWeek: number; startMinute: number; endMinute: number; active: boolean }[]) =>
  ws.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute, active: w.active }));

const whenLabel = (d: Date) =>
  `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} at ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} GMT`;

/** Public: book a 30-minute discovery call in one of the admin's open GMT slots. */
export async function bookCallAction(input: { startAtIso: string; name: string; email: string; centre?: string; notes?: string }): Promise<BookResult> {
  const name = (input.name ?? "").trim().slice(0, 120);
  const email = (input.email ?? "").trim().slice(0, 254);
  const centre = (input.centre ?? "").trim().slice(0, 160) || null;
  const notes = (input.notes ?? "").trim().slice(0, 2000) || null;
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  const startAt = new Date(input.startAtIso);
  if (Number.isNaN(startAt.getTime())) return { ok: false, error: "Please pick a time slot." };

  const repo = new PlatformRepository(await getDb());

  // Re-validate the slot server-side: it must be a genuine open slot and still free.
  const windows = await repo.listAvailability();
  const booked = await repo.bookedSlotsFrom(new Date());
  const open = openSlots(windowsFor(windows), booked, { maxWorkingDays: 7 });
  if (!open.some((s) => s.getTime() === startAt.getTime())) {
    return { ok: false, error: "Sorry, that slot is no longer available — please pick another." };
  }
  if (!(await repo.isSlotFree(startAt))) {
    return { ok: false, error: "Sorry, that slot was just taken — please pick another." };
  }

  await repo.createBooking({
    startAt,
    durationMin: 30,
    name,
    email,
    centre,
    notes,
    status: "booked",
  });

  // Best-effort notifications (no-op if mail isn't configured).
  const when = whenLabel(startAt);
  try {
    await sendEmail({
      to: email,
      subject: "Your ActivityRoster call is booked",
      html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks — your 30-minute call with ActivityRoster is booked for <strong>${when}</strong>.</p><p>We'll be in touch shortly with a joining link. If you need to change the time, just reply to this email.</p>`,
    });
  } catch {
    // ignore
  }
  try {
    const env = getEnv();
    const adminTo = env.SUPPORT_EMAIL || LETTER_SENDER.email;
    await sendEmail({
      to: adminTo,
      subject: `New call booking — ${name.replace(/[\r\n]+/g, " ")}`,
      html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}${centre ? `, ${escapeHtml(centre)}` : ""}) booked a 30-minute call.</p><p>When: <strong>${when}</strong></p>${notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : ""}`,
    });
  } catch {
    // ignore
  }

  return { ok: true };
}
