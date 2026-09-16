/**
 * This is the notification schema module. It defines the structure and validation rules for creating notifications.
 * It uses the Zod library to define a schema for the notification creation request, ensuring that the input data adheres to the expected format and types.
 * The schema includes fields for user ID, channel, category, template ID, template version, data, priority, and an optional scheduled date.
 * Each field has specific validation rules, such as UUID format for IDs, enumerated values for channel and category, and constraints on priority and template version.
 * The schema also provides default values for certain fields, such as an empty object for data and a default priority of 0.
 */
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
