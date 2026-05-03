import {
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { usersTable } from "./users";

export const auditLogsTable = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  campaignId: text("campaign_id"),
  platformKey: text("platform_key"),
  action: text("action").notNull(),
  level: text("level", { enum: ["info", "warn", "error"] })
    .notNull()
    .default("info"),
  message: text("message").notNull(),
  meta: text("meta").$type<Record<string, unknown> | null>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
