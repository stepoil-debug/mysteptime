// Carrega somente dados no schema lovable_export. O padrão é ROLLBACK.
// node --env-file=.env.local scripts/migracao-intranet/load-export.mjs <arquivo-ou-pasta>
// Use --format-only para identificar o arquivo sem conexão. --commit <digest> confirma só o staging.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { open, realpath, readdir, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGunzip } from "node:zlib";
import { DESTINATION_ONLY, MigrationError, STAGING, STAGING_USERS, TARGET,
  connectionConfig, ident, relation } from "./sync-final.mjs";
const IDENTIFIER = /^(?:"((?:[^"]|"")*)"|([a-z_][a-z0-9_]*))$/i;
const SQL_IDENTIFIER = '(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_]*)';
const COPY = new RegExp("^COPY (" + SQL_IDENTIFIER + ")\\.(" + SQL_IDENTIFIER +
  ") \\((.*)\\) FROM stdin;$", "i");
const COLUMN = new RegExp(SQL_IDENTIFIER, "gi");
const CSV_FILE = /^(?:(public|auth)\.)?([a-z_][a-z0-9_]*)\.csv$/i;
const BATCH_SIZE = 250;
const DIGEST = /^[a-f0-9]{64}$/;
class ExportError extends Error {}

function inputStream(path, gzip) {
  const stream = createReadStream(path);
  if (!gzip) return stream;
  const output = createGunzip();
  stream.on("error", (error) => output.destroy(error));
  output.on("close", () => stream.destroy());
  return stream.pipe(output);
}

async function identify(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    const files = await readdir(path, { withFileTypes: true });
    if (files.some((file) => file.name === "toc.dat" && file.isFile())) {
      return { label: "arquivo PostgreSQL em diretório", archive: true };
    }
    const csv = files.filter((file) => file.isFile() && CSV_FILE.test(file.name))
      .map((file) => file.name).sort();
    if (csv.length) return { label: "CSV por tabela", csv };
    throw new ExportError("A pasta não contém um export reconhecido");
  }
  if (!info.isFile()) throw new ExportError("A origem precisa ser um arquivo ou uma pasta");
  if (CSV_FILE.test(basename(path))) return { label: "CSV por tabela", csv: [basename(path)], single: true };

  const fd = await open(path, "r");
  const initial = Buffer.alloc(512);
  try {
    await fd.read(initial, 0, initial.length, 0);
  } finally {
    await fd.close();
  }
  if (initial.subarray(0, 5).toString() === "PGDMP") {
    return { label: "arquivo PostgreSQL custom (.backup)", archive: true };
  }
  if (initial.subarray(257, 262).toString() === "ustar") {
    return { label: "arquivo PostgreSQL tar", archive: true };
  }
  const gzip = initial[0] === 0x1f && initial[1] === 0x8b;
  let prefix = initial.toString("utf8");
  if (gzip) {
    for await (const chunk of inputStream(path, true)) {
      prefix = chunk.subarray(0, 512).toString("utf8");
      break;
    }
  }
  if (/PostgreSQL database dump|^\s*COPY /im.test(prefix)) {
    return { label: gzip ? "dump SQL COPY comprimido" : "dump SQL COPY", gzip };
  }
  throw new ExportError("Formato desconhecido. Use o .backup do Lovable, dump SQL COPY ou CSV por tabela");
}

function identifier(raw) {
  const match = IDENTIFIER.exec(raw);
  if (!match) throw new ExportError("Identificador SQL não reconhecido no export");
  return match[1] === undefined ? match[2].toLowerCase() : match[1].replaceAll('""', '"');
}

function copyField(value) {
  if (value === "\\N") return null;
  if (!value.includes("\\")) return value;
  const parts = [];
  let offset = 0;
  const escapes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
  for (const match of value.matchAll(/\\([0-7]{1,3}|x[0-9a-f]{1,2}|.)/gis)) {
    parts.push(Buffer.from(value.slice(offset, match.index)));
    const code = match[1];
    if (/^[0-7]/.test(code)) parts.push(Buffer.from([parseInt(code, 8)]));
    else if (/^x[0-9a-f]/i.test(code)) parts.push(Buffer.from([parseInt(code.slice(1), 16)]));
    else parts.push(Buffer.from(escapes[code] ?? code));
    offset = match.index + match[0].length;
  }
  parts.push(Buffer.from(value.slice(offset)));
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts));
}

async function readCopy(stream, loader) {
  let table = null;
  let inCopy = false;
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (inCopy) {
        if (line === "\\.") {
          if (table) await table.finish();
          inCopy = false;
          table = null;
        } else if (table) {
          const raw = line.split("\t");
          await table.add(raw, copyField);
        }
        continue;
      }
      if (!/^COPY\b/i.test(line)) continue;
      const match = COPY.exec(line);
      if (!match) throw new ExportError("Cabeçalho COPY não suportado");
      const columns = [...match[3].matchAll(COLUMN)].map((item) => identifier(item[0]));
      table = await loader.beginTable(identifier(match[1]), identifier(match[2]), columns);
      inCopy = true;
    }
    if (inCopy) throw new ExportError("Bloco COPY incompleto");
  } finally {
    lines.close();
  }
}

async function* csvRows(stream) {
  let row = [], value = "", state = "start", skipLF = false;
  const emit = () => {
    row.push(state === "start" ? null : value);
    value = "";
    state = "start";
  };
  for await (const chunk of stream) {
    for (const char of chunk) {
      if (skipLF) {
        skipLF = false;
        if (char === "\n") continue;
      }
      if (state === "quoted") {
        if (char === '"') state = "closed";
        else value += char;
        continue;
      }
      if (state === "closed" && char === '"') {
        state = "quoted";
        value += char;
        continue;
      }
      if (char === ",") emit();
      else if (char === "\n" || char === "\r") {
        emit();
        yield row;
        row = [];
        skipLF = char === "\r";
      } else if (state === "closed" || (char === '"' && state !== "start")) {
        throw new ExportError("Aspas inválidas no CSV");
      } else if (char === '"') state = "quoted";
      else {
        state = "value";
        value += char;
      }
    }
  }
  if (state === "quoted") throw new ExportError("Campo CSV incompleto");
  if (row.length || state !== "start") {
    emit();
    yield row;
  }
}

async function loadCsv(path, format, loader) {
  for (const file of format.csv) {
    const [, schema = "public", name] = CSV_FILE.exec(file);
    const stream = createReadStream(format.single ? path : join(path, file), { encoding: "utf8" });
    let table;
    try {
      for await (const row of csvRows(stream)) {
        if (table === undefined) {
          const columns = row.map((column, index) => index === 0 ? column?.replace(/^\uFEFF/, "") : column);
          table = await loader.beginTable(schema, name, columns);
        } else if (table) await table.add(row);
      }
      if (table === undefined) throw new ExportError("Arquivo CSV sem cabeçalho");
      if (table) await table.finish();
    } finally {
      stream.destroy();
    }
  }
}

async function loadArchive(path, loader) {
  for (const args of [["--schema=public"], ["--schema=auth", "--table=users"]]) {
    const env = { ...process.env };
    delete env.MYSTEPTIME_DB_URL;
    delete env.PGPASSWORD;
    delete env.PGURL;
    const child = spawn("pg_restore", ["--data-only", "--no-owner", "--no-privileges",
      "--file=-", ...args, "--", path], { env, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    const completion = new Promise((resolve) => {
      child.once("error", () => resolve(false));
      child.once("close", (code) => resolve(code === 0));
    });
    try {
      await readCopy(child.stdout, loader);
      if (!await completion) throw new ExportError("pg_restore falhou. Verifique o arquivo e o utilitário PostgreSQL 16 ou mais recente");
    } finally {
      if (child.exitCode === null) child.kill();
      await completion;
    }
  }
}

async function createLoader(db) {
  const result = await db.query(`
    select c.relname as table_name, a.attname as column_name,
      format_type(a.atttypid,a.atttypmod) as column_type
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    where n.nspname=$1 and c.relkind in ('r','p') and not c.relispartition
      and a.attgenerated=''
    order by c.relname,a.attnum`, [TARGET.schema]);
  const definitions = new Map();
  for (const row of result.rows) {
    if (DESTINATION_ONLY.has(row.table_name)) continue;
    if (!definitions.has(row.table_name)) definitions.set(row.table_name, new Map());
    definitions.get(row.table_name).set(row.column_name, row.column_type);
  }
  if (!definitions.size) throw new ExportError("As tabelas My Step Time do destino não foram localizadas");
  definitions.set(STAGING_USERS, new Map([["id", "uuid"], ["email", "text"]]));
  const seen = new Set();
  const digest = createHash("sha256");

  return {
    async beginTable(schema, name, inputColumns) {
      if (schema !== "public" && !(schema === "auth" && name === "users")) return null;
      const auth = schema === "auth";
      const table = auth ? STAGING_USERS : name;
      if (!auth && table === STAGING_USERS) throw new ExportError("Nome reservado no export");
      const types = definitions.get(table);
      if (!types) throw new ExportError("O export contém tabela public sem definição no destino");
      if (seen.has(table)) throw new ExportError("Tabela repetida no export");
      if (!inputColumns.length || inputColumns.some((column) => typeof column !== "string" || !column) ||
          new Set(inputColumns).size !== inputColumns.length) {
        throw new ExportError("Cabeçalho de tabela inválido");
      }
      const columns = auth ? ["id", "email"] : inputColumns;
      if (columns.length !== types.size ||
          columns.some((column) => !types.has(column) || !inputColumns.includes(column))) {
        throw new ExportError("Coluna exportada incompatível com a definição de destino");
      }
      const indexes = columns.map((column) => inputColumns.indexOf(column));
      const target = relation(STAGING, table);
      const names = columns.map(ident);
      await db.query("create table " + target + " (" +
        columns.map((column) => ident(column) + " " + types.get(column)).join(", ") + ")");
      seen.add(table);
      digest.update(JSON.stringify([table, columns]) + "\n");
      const batch = [];
      let count = 0;
      const flush = async () => {
        if (!batch.length) return;
        await db.query(`insert into ${target} (${names.join(", ")})
          select ${columns.map((column, index) =>
            "(r.value->>" + index + ")::" + types.get(column)).join(", ")}
          from jsonb_array_elements($1::jsonb) as r(value)`, [JSON.stringify(batch)]);
        batch.length = 0;
      };
      return {
        async add(raw, decode = (value) => value) {
          if (raw.length !== inputColumns.length) throw new ExportError("Quantidade de colunas inesperada");
          const row = indexes.map((index) => decode(raw[index]));
          if (auth && (!row[0] || !row[1])) throw new ExportError("Conta exportada sem UUID ou e-mail");
          digest.update(JSON.stringify(row) + "\n");
          batch.push(row);
          count++;
          if (batch.length >= BATCH_SIZE) await flush();
        },
        async finish() {
          await flush();
          console.log(JSON.stringify({ table, rows: count }));
        },
      };
    },
    verify() {
      const missing = [...definitions.keys()].filter((name) => !seen.has(name));
      if (missing.length) {
        console.error(JSON.stringify({ missingTables: missing }));
        throw new ExportError("Export incompleto para sincronização integral");
      }
      return digest.digest("hex");
    },
  };
}

function options(args) {
  const [path, flag, digest, ...extra] = args;
  if (!path || path.startsWith("--") || extra.length ||
      (flag !== undefined && !["--format-only", "--commit"].includes(flag)) ||
      (flag === "--commit" ? !DIGEST.test(digest ?? "") : digest !== undefined)) {
    throw new ExportError("Uso: load-export.mjs <arquivo-ou-pasta> [--format-only | --commit <digest>]");
  }
  return { path, formatOnly: flag === "--format-only", digest };
}

async function main() {
  let db, openTransaction = false;
  try {
    const opts = options(process.argv.slice(2));
    const path = await realpath(opts.path);
    const root = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
    const fromRoot = relative(root, path);
    if (!fromRoot || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(".." + sep))) {
      throw new ExportError("Mantenha o arquivo de export fora do repositório");
    }
    const format = await identify(path);
    console.log(JSON.stringify({ format: format.label }));
    if (opts.formatOnly) return;

    const config = connectionConfig(TARGET);
    const { default: pg } = await import("pg").catch(() => {
      throw new ExportError("Dependência pg indisponível");
    });
    db = new pg.Client(config);
    await db.connect();
    await db.query("begin");
    openTransaction = true;
    await db.query("set local lock_timeout='5s'; set local statement_timeout='120s'");
    await db.query("set local timezone='UTC'; set local datestyle='ISO, YMD'; set local intervalstyle='postgres'");
    const existing = await db.query("select to_regnamespace($1) is not null as exists", [STAGING]);
    if (existing.rows[0].exists) throw new ExportError("lovable_export já existe. Use a limpeza aprovada ou mantenha a cópia atual");
    await db.query("create schema " + ident(STAGING));
    await db.query("revoke all on schema " + ident(STAGING) + " from public");
    const loader = await createLoader(db);
    if (format.archive) await loadArchive(path, loader);
    else if (format.csv) await loadCsv(path, format, loader);
    else {
      const stream = inputStream(path, format.gzip);
      try { await readCopy(stream, loader); } finally { stream.destroy(); }
    }
    const digest = loader.verify();
    if (opts.digest && opts.digest !== digest) throw new ExportError("O export mudou desde o ROLLBACK");
    await db.query(opts.digest ? "commit" : "rollback");
    openTransaction = false;
    console.log(JSON.stringify({ result: opts.digest ? "COMMIT" : "ROLLBACK", digest }));
  } catch (error) {
    const result = openTransaction
      ? await db.query("rollback").then(() => "ROLLBACK", () => "TRANSACTION_STATUS_UNKNOWN")
      : "PRECHECK_BLOCKED";
    const sqlstate = /^[0-9A-Z]{5}$/.test(error?.code ?? "") ? error.code : undefined;
    // Não imprimir erros brutos, caminhos, SQL do dump ou valores do banco.
    console.error(JSON.stringify({ result, sqlstate, reason: error instanceof ExportError || error instanceof MigrationError ? error.message : undefined }));
    process.exitCode = 1;
  } finally {
    await db?.end().catch(() => {});
  }
}

export { identify, readCopy, csvRows, createLoader };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
