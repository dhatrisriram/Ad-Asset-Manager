import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";

export const publishJobsTable = sqliteTable("publish_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  platformKey: text("platform_key").notNull(),
  platformName: text("platform_name").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "success", "failed", "retrying"],
  })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  error: text("error"),
  response: text("response").$type<Record<string, unknown> | null>(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: text("spend").notNull().default("0"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type PublishJob = typeof publishJobsTable.$inferSelect;
export type InsertPublishJob = typeof publishJobsTable.$inferInsert;
