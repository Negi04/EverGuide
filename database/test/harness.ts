/**
 * Offline test database: PGlite (real Postgres compiled to WebAssembly) plus minimal
 * stand-ins for the Supabase pieces our migrations rely on. Lets us run every migration
 * and test SQL functions, constraints and RLS in seconds, without Docker or the cloud.
 *
 * Not a full Supabase: the real project is still verified with `npm run db:verify`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { vector } from '@electric-sql/pglite-pgvector'

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url)

// What Supabase provides before our migrations run.
const SUPABASE_STUBS = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

-- Supabase grants these roles full access to new public tables by default; our
-- migrations revoke what they shouldn't have, so the stub must match that default.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- auth.uid(): the signed-in user, taken from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
`

export type TestDb = Awaited<ReturnType<typeof createTestDb>>

export async function createTestDb() {
  const db = await PGlite.create({ extensions: { vector, btree_gist } })
  await db.exec(SUPABASE_STUBS)

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    try {
      await db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8'))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }

  /** Create a user the way Supabase signup does (the trigger creates their profile). */
  async function createUser(fullName: string, timezone = 'Asia/Kolkata'): Promise<string> {
    const id = crypto.randomUUID()
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
      id,
      `${id}@example.com`,
      JSON.stringify({ full_name: fullName }),
    ])
    await db.query('update public.profiles set timezone = $2 where id = $1', [id, timezone])
    return id
  }

  /** Run queries as a signed-in user: role `authenticated`, RLS applies, auth.uid() = userId. */
  async function asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
      await tx.exec('set local role authenticated')
      return fn(tx)
    })
  }

  /** Run queries as an anonymous visitor. */
  async function asAnon<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.exec('set local role anon')
      return fn(tx)
    })
  }

  /** Run queries as the server's secret key does: role `service_role`, which bypasses RLS. */
  async function asService<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.exec('set local role service_role')
      return fn(tx)
    })
  }

  return { db, files, createUser, asUser, asAnon, asService }
}
