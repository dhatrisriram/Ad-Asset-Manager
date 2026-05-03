import {
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { usersTable } from "./users";

export const campaignsTable = sqliteTable("campaigns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  objective: text("objective").notNull().default("traffic"),
  budget: text("budget").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status", {
    enum: [
      "draft",
      "scheduled",
      "publishing",
      "live",
      "partial",
      "failed",
      "paused",
    ],
  })
    .notNull()
    .default("draft"),
  targetPlatforms: text("target_platforms")
    .notNull()
    .$defaultFn(() => JSON.stringify([])),
  scheduleStart: text("schedule_start"),
  scheduleEnd: text("schedule_end"),
  creative: text("creative")
    .$type<{
      type: "image" | "video" | "text" | "carousel";
      headline: string;
      body: string;
      callToAction?: string | null;
      mediaUrl?: string | null;
      mediaId?: string | null;
    }>()
    .notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertCampaign = typeof campaignsTable.$inferInsert;
