import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

// NOTE: this must stay lazy. Any top-level code here runs the moment
// this module is imported - and because of this project's server-function
// code-splitting (it pins a pre-release @tanstack/react-start), this
// server-only file can end up pulled into the client bundle too. If we
// read process.env["DATABASE_URL"] and throw at import time, the browser
// hits that throw before React ever attaches the login form's submit
// handler, so the form silently falls back to a native GET reload.
// Connecting lazily means importing this module never executes anything;
// the real connection only happens the first time a server function
// actually queries the db, which is exactly when this code should run.

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (_db) return _db;

  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env (see .env.example).",
    );
  }

  const sql = neon(connectionString);
  _db = drizzle(sql, { schema });
  return _db;
}

// Proxy so every existing `import { db } from "@/db/client"` call site
// (auth.ts, orders.ts, menu.ts, payments.ts, settings.ts, seed.ts) keeps
// working unchanged - `db.select(...)`, `db.query...`, etc. still work,
// but nothing actually connects until the first property is accessed,
// which only happens when a server function runs server-side.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, _receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
