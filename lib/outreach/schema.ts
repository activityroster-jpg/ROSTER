import { z } from "zod";
import { PROSPECT_STATUSES } from "@/lib/db/schema";

/** Zod schemas for everything the Dev Center sends to the outreach actions. */

export const sequenceStepSchema = z.object({
  gapDays: z.coerce.number().int().min(0).max(60),
  purpose: z.string().trim().min(1, "Say what this step is for").max(300),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  body: z.string().trim().min(1, "Body is required").max(3000),
});

export const audienceSchema = z.object({
  regions: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  statuses: z.array(z.enum(PROSPECT_STATUSES)).max(10).default([]),
  requireWebsite: z.boolean().default(true),
  excludeContactedDays: z.coerce.number().int().min(0).max(365).default(90),
  limit: z.coerce.number().int().min(1).max(2000).default(200),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name").max(120),
  pitch: z.string().trim().min(20, "Describe what you sell in a sentence or two").max(2000),
  targetRoles: z.string().trim().min(1, "Who should we write to?").max(300),
  tone: z.string().trim().max(500).optional().or(z.literal("")),
  fromName: z.string().trim().min(1, "Sender name is required").max(80),
  fromEmail: z.string().trim().email("Enter a valid sender address").max(200),
  replyTo: z.string().trim().email("Enter a valid reply-to address").max(200).optional().or(z.literal("")),
  dailyCap: z.coerce.number().int().min(1).max(200).default(40),
  sendWindowStart: z.coerce.number().int().min(0).max(23).default(8),
  sendWindowEnd: z.coerce.number().int().min(1).max(24).default(18),
  weekdaysOnly: z.boolean().default(true),
  aiPersonalise: z.boolean().default(true),
  steps: z.array(sequenceStepSchema).min(1, "Add at least one step").max(6),
  audience: audienceSchema,
}).refine((c) => c.sendWindowEnd > c.sendWindowStart, { message: "Sending hours must end after they start", path: ["sendWindowEnd"] });

export type CampaignInput = z.infer<typeof campaignSchema>;
