// Pré-condições B4 do sync final: provisiona Matheus (UUID da origem, papel PM) e remapeia
// os vínculos restantes de Douglas (UUID antigo -> atual). Uso: node fix-accounts.mjs [--commit]
// Rollback documentado: ver docs/CUTOVER_CHECKLIST.md (apagar Matheus de auth.users/mysteptime e
// reverter user_id dos 15 eventos para 1d501add-...).
import fs from "node:fs";
import pg from "pg";
const MATHEUS = "f7644a66-87f7-46df-b4df-4ad1e5d4e075";
const DOUG_OLD = "1d501add-b207-46e2-88ee-dd1aa4f3ac56", DOUG_NEW = "e2a7ac3f-207d-437d-955b-2d2721a26218";
const commit = process.argv.includes("--commit");
const mig = fs.readFileSync(new URL("../../supabase/migrations/20261121203000_disable_legacy_auth_user_provisioning.sql", import.meta.url), "utf8");
const db = new pg.Client({ connectionString: process.env.MYSTEPTIME_DB_URL, ssl: { rejectUnauthorized: true } });
await db.connect();
const one = async (s, p) => (await db.query(s, p)).rows[0];
try {
  await db.query("begin");
  await db.query(mig);
  const src = await one("select email from lovable_export.__migration_source_users where id=$1", [MATHEUS]);
  if (!src) throw new Error("Matheus ausente no export");
  const exists = await one("select count(*)::int n from auth.users where id=$1::uuid or lower(email)=lower($2)", [MATHEUS, src.email]);
  if (exists.n === 0) {
    await db.query(`insert into auth.users (instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,now(),
        '{"provider":"email","providers":["email"]}','{}',now(),now())`, [MATHEUS, src.email]);
    await db.query(`insert into auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at)
      values (gen_random_uuid(),$1::uuid,$1::text,'email',jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',true),now(),now(),null)`, [MATHEUS, src.email]);
  }
  for (const t of ["profiles", "user_roles"]) {
    const cols = (await db.query(`select string_agg(quote_ident(c.column_name),',') l from information_schema.columns c
      join information_schema.columns s on s.table_schema='lovable_export' and s.table_name=c.table_name and s.column_name=c.column_name
      where c.table_schema='mysteptime' and c.table_name=$1 and c.is_generated='NEVER'`, [t])).rows[0].l;
    const key = t === "profiles" ? "id" : "user_id";
    await db.query(`insert into mysteptime.${t} (${cols}) select ${cols} from lovable_export.${t} where ${key}=$1 on conflict do nothing`, [MATHEUS]);
  }
  const ev = await db.query("update mysteptime.flow_track_events set user_id=$2 where user_id=$1", [DOUG_OLD, DOUG_NEW]);
  const pres = await db.query(`delete from mysteptime.flow_track_presence o using mysteptime.flow_track_presence t
    where o.user_id=$1 and t.user_id=$2 and (o.last_seen is null or t.last_seen>=o.last_seen)`, [DOUG_OLD, DOUG_NEW]);
  const check = await one(`select (select count(*) from auth.users where id=$1)::int auth,
    (select count(*) from mysteptime.profiles where id=$1)::int prof,
    (select count(*) from mysteptime.user_roles where user_id=$1 and role='pm')::int pm,
    (select count(*) from public.profiles where id=$1)::int legacy,
    (select count(*) from mysteptime.flow_track_events where user_id=$2)::int stale_ev,
    (select count(*) from mysteptime.flow_track_presence where user_id=$2)::int stale_pres`, [MATHEUS, DOUG_OLD]).catch(async (e) => { throw e; });
  console.log(JSON.stringify({ eventsRemapped: ev.rowCount, presenceRemoved: pres.rowCount, ...check }));
  if (check.auth !== 1 || check.prof !== 1 || check.pm !== 1 || check.legacy !== 0 || check.stale_ev || check.stale_pres) throw new Error("Verificação falhou");
  await db.query(commit ? "commit" : "rollback");
  console.log(commit ? "COMMIT" : "ROLLBACK");
} catch (e) { await db.query("rollback").catch(() => {}); console.error("ERRO:", e.message); process.exitCode = 1; }
finally { await db.end(); }
