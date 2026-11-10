// Entrada em massa do M.O (pedido dela, 2026-11-09): colar do Excel (colunas B:H da aba "M.O":
// QTD, FUNÇÃO, UNID, PM, BSP, DATA EMB., DATA DES) e importar o .xlsx (cabeçalho na linha 2,
// dados a partir da linha 3). Puro — a aba mostra a pré-visualização e grava as válidas.
import * as XLSX from "xlsx";
import { normalizarTexto } from "./mo-planejado";

export interface MoLinhaImportada {
  linha: number;
  qtd: number | null;
  funcao: string;
  unidade: string;
  pm: string | null;
  bsp: string | null;
  data_embarque: string | null;
  data_desembarque: string | null;
  erros: string[];
}

export type CelulaBruta = string | number | Date | null | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

/** Data em "YYYY-MM-DD" a partir de dd/mm/aaaa, aaaa-mm-dd, serial do Excel ou Date. */
export function parseDataMo(v: CelulaBruta): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number") {
    // Serial do Excel (dias desde 30/12/1899).
    if (v < 20000 || v > 80000) return null;
    return new Date(Math.round((v - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  const s = v.trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const iso = `${ano}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    return dataValida(iso) ? iso : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(m[0]) ? m[0] : null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseDataMo(Number(s));
  return null;
}

function dataValida(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function parseQtd(v: CelulaBruta): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

const texto = (v: CelulaBruta) => (v == null ? "" : v instanceof Date ? "" : String(v));

/** Valida uma linha [QTD, FUNÇÃO, UNID, PM, BSP, DATA EMB., DATA DES]; null = linha vazia. */
export function parseLinhaMo(cells: CelulaBruta[], linha: number): MoLinhaImportada | null {
  const [qtdC, funcaoC, unidC, pmC, bspC, embC, desC] = cells;
  const funcao = normalizarTexto(texto(funcaoC));
  if (parseQtd(qtdC) == null && !funcao) return null;
  // QTD em branco com função preenchida entra como 0: a planilha também não soma essas linhas
  // (ex.: equipe ainda sem quantidade definida), e assim elas não se perdem na importação.
  const qtd = parseQtd(qtdC) ?? 0;
  const erros: string[] = [];
  if (Number.isNaN(qtd) || qtd < 0 || !Number.isInteger(qtd)) erros.push("QTD inválida");
  if (!funcao) erros.push("Função vazia");
  const unidade = normalizarTexto(texto(unidC));
  if (!unidade) erros.push("Unidade vazia");
  const data_embarque = parseDataMo(embC);
  const data_desembarque = parseDataMo(desC);
  if (!data_embarque) erros.push("Data de embarque inválida");
  if (!data_desembarque) erros.push("Data de desembarque inválida");
  if (data_embarque && data_desembarque && data_desembarque < data_embarque)
    erros.push("Desembarque antes do embarque");
  // BSP mantém quebra de linha (texto livre da planilha); só tira espaço das pontas.
  const bspTexto = texto(bspC)
    .split(/\r?\n/)
    .map((l) => normalizarTexto(l))
    .filter(Boolean)
    .join("\n");
  return {
    linha,
    qtd: Number.isNaN(qtd) ? null : qtd,
    funcao,
    unidade,
    pm: normalizarTexto(texto(pmC)) || null,
    bsp: bspTexto || null,
    data_embarque,
    data_desembarque,
    erros,
  };
}

// Divide o texto colado do Excel em linhas/colunas, respeitando células entre aspas (o Excel
// põe aspas quando a célula tem quebra de linha, comum na coluna BSP).
export function dividirTsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let atual: string[] = [];
  let celula = "";
  let aspas = false;
  const t = texto.replace(/\r\n?/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"' && celula === "") aspas = true;
    else if (c === "\t") {
      atual.push(celula);
      celula = "";
    } else if (c === "\n") {
      atual.push(celula);
      linhas.push(atual);
      atual = [];
      celula = "";
    } else celula += c;
  }
  if (celula !== "" || atual.length) {
    atual.push(celula);
    linhas.push(atual);
  }
  return linhas;
}

/** Bloco colado (B:H). Pula um cabeçalho "QTD | FUNÇÃO..." se vier junto. */
export function parseColagemMo(texto: string): MoLinhaImportada[] {
  const out: MoLinhaImportada[] = [];
  dividirTsv(texto).forEach((cells, i) => {
    if (i === 0 && /^\s*QTD/i.test(cells[0] ?? "")) return;
    const r = parseLinhaMo(cells, i + 1);
    if (r) out.push(r);
  });
  return out;
}

/** Linhas da aba "M.O" lidas com sheet_to_json(header: 1): dados da linha 3, colunas B:H. */
export function parsePlanilhaMo(matriz: CelulaBruta[][]): MoLinhaImportada[] {
  const out: MoLinhaImportada[] = [];
  matriz.forEach((row, i) => {
    if (i < 2) return;
    const r = parseLinhaMo((row ?? []).slice(1, 8), i + 1);
    if (r) out.push(r);
  });
  return out;
}

/**
 * Matriz da aba a partir de A1. A aba "M.O" começa em B2 e o sheet_to_json, sem range, conta
 * linhas/colunas a partir da primeira célula usada — deslocaria tudo (B:H viraria A:G).
 */
export function matrizDesdeA1(ws: XLSX.WorkSheet): CelulaBruta[][] {
  const fim = XLSX.utils.decode_range(ws["!ref"] ?? "A1").e;
  return XLSX.utils.sheet_to_json<CelulaBruta[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: fim }),
  });
}

/** É um bloco colado do Excel (várias células), e não um texto simples numa célula? */
export const pareceBlocoExcel = (texto: string) => texto.includes("\t");
