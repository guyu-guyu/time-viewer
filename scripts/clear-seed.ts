import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { entries } from "../lib/schema";

config({ path: ".env.local" });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured in .env.local");
  }

  const db = drizzle(neon(databaseUrl));
  const deleted = await db
    .delete(entries)
    .where(eq(entries.source, "seed"))
    .returning({ id: entries.id });

  console.log("已删除 " + deleted.length + " 条 seed 数据");
}

main();
