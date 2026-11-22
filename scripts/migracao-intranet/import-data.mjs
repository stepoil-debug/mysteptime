// Importa os dados exportados do Lovable (mysteptime_import.inbox) para o schema mysteptime da Intranet.
// Uso: node import-data.mjs [--commit]   (sem --commit => ROLLBACK)
// Expected counts: export_counts.json ({tabela: linhas}) gerado a partir do navegador.
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const commit = process.argv.includes("--commit");
const expected = existsSync("export_counts.json") ? JSON.parse(readFileSync("export_counts.json", "utf8")) : {};
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL_DASHBOARD, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, params) => (await c.query(sql, params)).rows;

try {
  await c.query("begin");
  await c.query("set local statement_timeout = 0; set local lock_timeout = '30s'");
  await c.query("set local session_replication_role = replica"); // sem triggers/FK durante a carga

  // 1) Contas de Auth (sem senha: entrada só pela ponte da Intranet), mesmo UUID do Lovable
  const created = await q(`
    with p as (
      select distinct on (lower(trim(r->>'email'))) (r->>'id')::uuid id, lower(trim(r->>'email')) email, r->>'full_name' full_name
      from mysteptime_import.inbox i, jsonb_array_elements(i.rows) r where i.tbl = 'profiles' order by lower(trim(r->>'email'))
    ), ins as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email, '', now(),
        jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'origem','mysteptime-lovable'),
        jsonb_build_object('full_name', p.full_name), now(), now(), '', '', '', ''
      from p
      where not exists (select 1 from auth.users u where lower(u.email) = p.email)
        and not exists (select 1 from auth.users u where u.id = p.id)
      returning id, email
    ), idt as (
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
      select gen_random_uuid(), ins.id, ins.id::text,
        jsonb_build_object('sub', ins.id::text, 'email', ins.email, 'email_verified', true), 'email', now(), now()
      from ins returning user_id
    ) select count(*) n from idt`);
  console.log("contas Auth criadas:", created[0].n);

  // ids do Lovable cujo e-mail já tinha conta na Intranet -> remapear
  const remap = await q(`
    select (r->>'id')::uuid old_id, u.id new_id
    from mysteptime_import.inbox i, jsonb_array_elements(i.rows) r
    join auth.users u on lower(u.email) = lower(trim(r->>'email'))
    where i.tbl = 'profiles' and u.id <> (r->>'id')::uuid`);
  console.log("usuários a remapear:", remap.length);

  // 2) Carga tabela a tabela
  const tables = (await q(`select distinct tbl from mysteptime_import.inbox order by 1`)).map((r) => r.tbl);
  const result = {};
  const extraCols = [];
  const relaxed = [];
  for (const t of tables) {
    // só as colunas que existem no banco real do Lovable (as demais ficam com o default do schema)
    const exported = new Set((await q(`
      select jsonb_object_keys(i.rows->0) k from mysteptime_import.inbox i
      where i.tbl = $1 and jsonb_array_length(i.rows) > 0 order by i.page limit 500`, [t])).map((r) => r.k));
    const all = (await q(`
      select a.attname from pg_attribute a
      where a.attrelid = ('mysteptime.' || quote_ident($1))::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
      order by a.attnum`, [t])).map((r) => r.attname);
    if (!exported.size) { result[t] = 0; continue; }
    for (const col of all) if (!exported.has(col)) extraCols.push(`${t}.${col}`);
    const cols = all.filter((col) => exported.has(col)).map((col) => `"${col}"`).join(", ");
    // NOT NULL do repo que o banco real não tinha (há nulos nos dados) -> segue o banco real
    const notNull = (await q(`
      select a.attname from pg_attribute a where a.attrelid = ('mysteptime.' || quote_ident($1))::regclass
      and a.attnum > 0 and not a.attisdropped and a.attnotnull`, [t])).map((r) => r.attname).filter((col) => exported.has(col));
    for (const col of notNull) {
      const has = await q(`select 1 from mysteptime_import.inbox i, jsonb_array_elements(i.rows) r
        where i.tbl = $1 and (r->$2) = 'null'::jsonb limit 1`, [t, col]);
      if (has.length) {
        await c.query(`alter table mysteptime."${t}" alter column "${col}" drop not null`);
        relaxed.push(`${t}.${col}`);
      }
    }
    await c.query(`delete from mysteptime."${t}"`);
    const r = await c.query(`
      insert into mysteptime."${t}" (${cols}) overriding system value
      select ${cols} from mysteptime_import.inbox i, jsonb_populate_recordset(null::mysteptime."${t}", i.rows)
      where i.tbl = $1`, [t]);
    result[t] = r.rowCount;
  }

  // 3) Remapeia ids de usuário já existentes na Intranet em todas as colunas uuid/texto
  if (remap.length) {
    const cols = await q(`
      select c.table_name, c.column_name, c.data_type from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'mysteptime' and c.data_type in ('uuid','text')`);
    let touched = 0;
    for (const { old_id, new_id } of remap) {
      for (const col of cols) {
        const r = await c.query(
          `update mysteptime."${col.table_name}" set "${col.column_name}" = $2${col.data_type === "uuid" ? "::uuid" : ""} where "${col.column_name}" = $1${col.data_type === "uuid" ? "::uuid" : ""}`,
          [old_id, new_id]);
        touched += r.rowCount;
      }
    }
    console.log("valores remapeados:", touched);
  }

  // 4) sequences
  await c.query(`do $$ declare r record; begin
    for r in select s.relname seq, t.relname tbl, a.attname col from pg_class s
      join pg_depend d on d.objid = s.oid join pg_class t on t.oid = d.refobjid
      join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
      where s.relkind = 'S' and s.relnamespace = 'mysteptime'::regnamespace loop
      execute format('select setval(%L, coalesce((select max(%I) from mysteptime.%I), 0) + 1, false)', 'mysteptime.' || r.seq, r.col, r.tbl);
    end loop; end $$`);

  // 5) Conferência
  await c.query("set local session_replication_role = origin");
  const diffs = Object.entries(expected).filter(([t, n]) => (result[t] ?? 0) !== n);
  const fk = await q(`
    select count(*) n from mysteptime.user_roles ur where not exists (select 1 from auth.users u where u.id = ur.user_id)`);
  console.log("colunas do repo que não existem no Lovable (ficaram com default):", extraCols.join(", ") || "nenhuma");
  console.log("NOT NULL removido (banco real aceita nulo):", relaxed.join(", ") || "nenhum");
  console.log("tabelas importadas:", Object.keys(result).length, "linhas:", Object.values(result).reduce((a, b) => a + b, 0));
  console.log("divergências vs exportação:", diffs.length ? diffs.map(([t, n]) => `${t}: esperado ${n}, importado ${result[t] ?? 0}`) : "nenhuma");
  console.log("user_roles sem conta Auth:", fk[0].n);
  if (commit && (diffs.length || Number(fk[0].n))) throw new Error("não faço commit com divergências");
  await c.query(commit ? "commit" : "rollback");
  console.log(commit ? "COMMIT" : "ROLLBACK (teste)");
} catch (e) {
  console.error("FALHOU:", e.message, e.detail ?? "", e.where ?? "");
  await c.query("rollback");
  process.exitCode = 1;
} finally {
  await c.end();
}
