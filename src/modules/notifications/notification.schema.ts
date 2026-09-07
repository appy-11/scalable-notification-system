import { z } from "zod";

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),

  channel: z.enum(["EMAIL", "SMS", "PUSH"]),

  category: z.enum(["TRANSACTIONAL", "MARKETING", "SECURITY", "SYSTEM"]),

  templateId: z.string().uuid(),

  templateVersion: z.number().int().positive(),

  data: z.record(z.string(), z.unknown()).default({}),

  priority: z.number().int().min(0).max(10).default(0),

  scheduledAt: z.coerce.date().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
