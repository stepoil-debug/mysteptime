// Executa o SQL gerado arquivo por arquivo dentro de UMA transação.
// Uso: node run-sql.mjs <arquivo.sql> [--drift drift.sql] [--commit]   (sem --commit => ROLLBACK)
// - Duplicados (já existe) são ignorados e listados.
// - Comandos que falham por coluna/tabela/função inexistente (divergência entre o repo e o banco real
//   do Lovable) são adiados; depois aplica-se o drift (colunas do types.ts) e eles são repetidos.
// Conexão: env SUPABASE_DB_URL_DASHBOARD (Intranet). Nunca imprime a URL.
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { splitSql } from "./split.mjs";

const DUP = new Set(["42710", "42P07", "42701", "42P06", "42723", "42P16"]);
const MISSING = new Set(["42703", "42P01", "42883", "42704"]);
const args = process.argv.slice(2);
const file = args[0];
const commit = args.includes("--commit");
const driftFile = args.includes("--drift") ? args[args.indexOf("--drift") + 1] : null;
const sql = readFileSync(file, "utf8");
const chunks = sql.split(/\n-- >>> FILE /);
const skipped = [];
let deferred = [];

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL_DASHBOARD, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("begin");
await client.query("set local statement_timeout = 0; set local lock_timeout = '15s'");

async function tryStmt(st, name) {
  await client.query("savepoint s");
  try { await client.query(st); return null; }
  catch (e) { await client.query("rollback to savepoint s"); return e; }
}

async function runFile(name, body) {
  await client.query("savepoint f");
  try { await client.query(body); return; }
  catch (e0) {
    if (!DUP.has(e0.code) && !MISSING.has(e0.code)) throw Object.assign(e0, { file: name, body });
    await client.query("rollback to savepoint f");
  }
  for (const st of splitSql(body)) {
    const e = await tryStmt(st, name);
    if (!e) continue;
    if (DUP.has(e.code)) { skipped.push(`${name}: ${e.message}`); continue; }
    if (MISSING.has(e.code)) { deferred.push({ name, st, err: e.message }); continue; }
    throw Object.assign(e, { file: name, body: st });
  }
}

try {
  for (const [i, c] of chunks.entries()) {
    const name = i === 0 ? "PRELUDE" : c.slice(0, c.indexOf("\n"));
    const body = i === 0 ? c : c.slice(c.indexOf("\n") + 1);
    if (body.trim()) await runFile(name, body);
  }
  console.log(`passo 1: ${chunks.length} arquivos; adiados ${deferred.length}; duplicados ${skipped.length}`);
  if (driftFile) { await runFile("DRIFT", readFileSync(driftFile, "utf8")); console.log("drift aplicado"); }
  // repete adiados até não haver progresso
  for (let round = 1; deferred.length; round++) {
    const before = deferred.length; const again = [];
    for (const d of deferred) { const e = await tryStmt(d.st, d.name); if (e) again.push({ ...d, err: e.message }); }
    deferred = again;
    console.log(`rodada ${round}: restam ${deferred.length}`);
    if (deferred.length === before) break;
  }
  // divergência de colunas vs types.ts
  const types = JSON.parse(readFileSync(new URL("./types_cols.json", import.meta.url), "utf8"));
  const { rows } = await client.query(`select table_name, column_name, data_type, udt_name from information_schema.columns where table_schema='mysteptime'`);
  const have = {};
  for (const r of rows) (have[r.table_name] ??= {})[r.column_name] = r.udt_name;
  const missing = [];
  for (const [t, cols] of Object.entries(types)) {
    if (!have[t]) { missing.push({ table: t, column: "*TABELA*" }); continue; }
    for (const [c, info] of Object.entries(cols)) if (!have[t][c]) missing.push({ table: t, column: c, ...info });
  }
  writeFileSync("drift_report.json", JSON.stringify({ missing, deferred: deferred.map((d) => ({ name: d.name, err: d.err, st: d.st.slice(0, 400) })) }, null, 1));
  const r = await client.query(`select count(*) filter (where c.relkind='r') tabelas, count(*) filter (where c.relkind='v') views,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mysteptime') funcoes,
    (select count(*) from pg_policies where schemaname='mysteptime') policies
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='mysteptime'`);
  console.log("resultado", r.rows[0], `| colunas faltando vs types.ts: ${missing.length} | adiados sem solução: ${deferred.length}`);
  if (commit && (missing.length || deferred.length)) throw new Error("não faço commit com divergências pendentes");
  await client.query(commit ? "commit" : "rollback");
  console.log(commit ? "COMMIT" : "ROLLBACK (teste)");
} catch (e) {
  console.error(`FALHOU${e.file ? " em " + e.file : ""}: ${e.message}`);
  if (e.body) console.error(String(e.body).slice(0, 600));
  await client.query("rollback");
  console.log("ROLLBACK após erro");
  process.exitCode = 1;
} finally {
  await client.end();
}
