import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { usersTable } from "./users";

export const platformsTable = sqliteTable("platforms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  accountLabel: text("account_label").notNull(),
  status: text("status", { enum: ["active", "expired", "error"] })
    .notNull()
    .default("active"),
  credentialsRef: text("credentials_ref").notNull(),
  config: text("config").notNull().$defaultFn(() => JSON.stringify({})),
  connectedAt: text("connected_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  lastSyncedAt: text("last_synced_at"),
});

export type Platform = typeof platformsTable.$inferSelect;
export type InsertPlatform = typeof platformsTable.$inferInsert;
