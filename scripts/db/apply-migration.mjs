// Aplica UMA migration no Supabase do Mysteptime (knzszyxsspdjzgqkfrdt), dentro de transação.
//
//   npm run db:migration -- supabase/migrations/<arquivo>.sql            -> ensaio (ROLLBACK, nada muda)
//   npm run db:migration -- supabase/migrations/<arquivo>.sql --commit   -> grava de verdade
//
// Conexão: MYSTEPTIME_DB_URL no .env.local (nunca commitar). Certificado: supabase/prod-ca-2021.crt
// (CA pública do Supabase; a verificação TLS continua ligada).
// Registra cada migration gravada em mysteptime.app_migrations e recusa aplicar a mesma duas vezes.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const commit = args.includes("--commit");
if (!file || !fs.existsSync(file)) {
  console.error("Uso: npm run db:migration -- supabase/migrations/<arquivo>.sql [--commit]");
  process.exit(2);
}
if (!process.env.MYSTEPTIME_DB_URL) {
  console.error("MYSTEPTIME_DB_URL ausente. Coloque no .env.local (peça a conexão ao responsável).");
  process.exit(2);
}
const sql = fs.readFileSync(file, "utf8");
const name = path.basename(file);
if (/\bpublic\.(?!handle_new_user)/i.test(sql) && !/search_path\s*=\s*mysteptime/i.test(sql)) {
  console.warn("AVISO: a migration cita o schema public. As tabelas do app ficam no schema mysteptime.");
}

const db = new pg.Client({
  connectionString: process.env.MYSTEPTIME_DB_URL,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(new URL("../../supabase/prod-ca-2021.crt", import.meta.url)) },
});
await db.connect();
try {
  await db.query(`create table if not exists mysteptime.app_migrations (
    name text primary key, applied_at timestamptz not null default now(), applied_by text);
    alter table mysteptime.app_migrations enable row level security;
    revoke all on mysteptime.app_migrations from anon, authenticated;`);
  const done = await db.query("select applied_at from mysteptime.app_migrations where name=$1", [name]);
  if (done.rowCount) {
    console.error(`Já aplicada em ${done.rows[0].applied_at.toISOString()}: ${name}`);
    process.exit(1);
  }
  await db.query("begin");
  await db.query("set local search_path = mysteptime, public, extensions");
  await db.query(sql);
  await db.query("insert into mysteptime.app_migrations(name, applied_by) values ($1, $2)",
    [name, process.env.USERNAME || process.env.USER || null]);
  // Recarrega o cache do PostgREST para a API enxergar colunas/tabelas novas.
  await db.query("notify pgrst, 'reload schema'");
  await db.query(commit ? "commit" : "rollback");
  console.log(commit ? `COMMIT: ${name} aplicada.` : `ENSAIO OK (ROLLBACK): ${name}. Rode de novo com --commit para gravar.`);
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(`ERRO (nada foi gravado): ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
