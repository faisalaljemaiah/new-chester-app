// Runs the migration and seed on PGlite (Postgres in WebAssembly) with a small stand-in for
// Supabase's auth schema, so the access rules can be tested without Docker or a real project.
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { SUPABASE_STUB } from "./stub.mjs";

const root = new URL("../", import.meta.url);

export async function createDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(new URL("migrations/", root)).sort()) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Creates a sign-up the way Supabase Auth does, returning the new user id. */
export async function signUp(db: Db, email: string, displayName: string, phone?: string) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ display_name: displayName, phone })],
  );
  return rows[0].id;
}

/** Runs a query as a signed-in user (or as anon when uid is null), with RLS applied. */
export async function as<T = Record<string, unknown>>(db: Db, uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await tx.exec(`set local role ${uid ? "authenticated" : "anon"}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
