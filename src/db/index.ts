import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

function sqliteFilePath(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/local.db";
  const withoutScheme = raw.startsWith("file:")
    ? raw.slice("file:".length)
    : raw;
  return path.isAbsolute(withoutScheme)
    ? withoutScheme
    : path.join(process.cwd(), withoutScheme);
}

const sqlite = new Database(sqliteFilePath());

export const db = drizzle(sqlite, { schema });

export type Db = typeof db;
