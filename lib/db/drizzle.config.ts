import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || ":memory:",
  },
});
