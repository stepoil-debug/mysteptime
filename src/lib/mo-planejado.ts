// M.O — Mão de Obra Planejada (pedido dela, 2026-11-09). Replica a aba "Apresentação 1 -
// Planejado" da planilha da liderança. Funções puras: a aba M.O calcula a prévia a partir das
// linhas, e o Dashboard a partir dos agregados da RPC mo_planejado_diario (mesma regra no SQL).
// Datas sempre "YYYY-MM-DD", sem hora.

export interface MoLinha {
  qtd: number;
  funcao: string;
  bsp: string | null;
  data_embarque: string;
  data_desembarque: string;
}

/** Headcount planejado de uma função num dia — H(d, f). */
export interface MoDiario {
  dia: string;
  funcao: string;
  qtd_total: number;
}

export interface MoSemana {
  inicio: string;
  fim: string;
  rotulo: string;
  total: number;
  porFuncao: { funcao: string; qtd: number }[];
}

export interface MoMes {
  mes: string;
  rotulo: string;
  somaDias: number;
  media: number;
}

export const MO_STATUS_BSP = ["EM PLANEJAMENTO", "ENCERRADA", "ON HOLD", "PULMÃO"] as const;

const DIA_MS = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDiasIso = (iso: string, n: number) => toIso(toMs(iso) + n * DIA_MS);

export const ehOnHold = (bsp: string | null | undefined) =>
  (bsp ?? "").trim().toUpperCase() === "ON HOLD";
export const ehEncerrada = (bsp: string | null | undefined) =>
  (bsp ?? "").trim().toUpperCase() === "ENCERRADA";

/** Entra no planejado: qtd > 0 e BSP diferente de ON HOLD (ENCERRADA conta normalmente). */
export function linhaConta(l: Pick<MoLinha, "qtd" | "bsp">): boolean {
  return l.qtd > 0 && !ehOnHold(l.bsp);
}

/** H(d, f) de cada dia entre inicio e fim (inclusivos), a partir das linhas. */
export function headcountDiario(linhas: MoLinha[], inicio: string, fim: string): MoDiario[] {
  const m = new Map<string, number>();
  for (const l of linhas) {
    if (!linhaConta(l)) continue;
    const de = l.data_embarque > inicio ? l.data_embarque : inicio;
    const ate = l.data_desembarque < fim ? l.data_desembarque : fim;
    for (let d = de; d <= ate; d = addDiasIso(d, 1)) {
      const chave = `${d}|${l.funcao}`;
      m.set(chave, (m.get(chave) ?? 0) + l.qtd);
    }
  }
  return Array.from(m, ([chave, qtd_total]) => {
    const [dia, funcao] = chave.split("|");
    return { dia, funcao, qtd_total };
  });
}

/** H(d) — total do dia, todas as funções. */
export function totalPorDia(diario: MoDiario[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of diario) m.set(r.dia, (m.get(r.dia) ?? 0) + Number(r.qtd_total));
  return m;
}

// ROUND do Excel: meio pra longe do zero (aqui sempre positivo). O epsilon evita 2,4999999…
// de ponto flutuante virar 2 quando a média exata é 2,5.
export const roundExcel = (x: number) => Math.floor(x + 0.5 + 1e-9);

/** Domingo da semana (WEEKNUM tipo 1: domingo a sábado). */
export function domingoDaSemana(iso: string): string {
  return addDiasIso(iso, -new Date(toMs(iso)).getUTCDay());
}

// WEEKNUM(data;1) do Excel: semana 1 é a que contém 1º de janeiro, semanas de domingo a sábado.
function weeknum(iso: string): number {
  const ano = iso.slice(0, 4);
  const jan1 = `${ano}-01-01`;
  const diaDoAno = Math.round((toMs(iso) - toMs(jan1)) / DIA_MS);
  return Math.floor((diaDoAno + new Date(toMs(jan1)).getUTCDay()) / 7) + 1;
}

/**
 * Rótulo "{nº}/{ano}" pela data real da semana. Usa o SÁBADO: a semana que contém 1º de
 * janeiro vira "1/{ano novo}" (a planilha mostrava "54/2026" nessa virada); nas demais semanas
 * o número é o mesmo do WEEKNUM do domingo.
 */
export function rotuloSemana(domingo: string): string {
  const sabado = addDiasIso(domingo, 6);
  return `${weeknum(sabado)}/${sabado.slice(0, 4)}`;
}

/**
 * 17 semanas: a primeira contém (hoje − 7 dias). Valor da semana = soma, por função, de
 * ROUND(média de H(d, f) nos 7 dias) — arredonda por função e só depois soma.
 */
export function calcularSemanas(diario: MoDiario[], hoje: string, quantidade = 17): MoSemana[] {
  const porDiaFuncao = new Map<string, Map<string, number>>();
  for (const r of diario) {
    if (!porDiaFuncao.has(r.dia)) porDiaFuncao.set(r.dia, new Map());
    const f = porDiaFuncao.get(r.dia)!;
    f.set(r.funcao, (f.get(r.funcao) ?? 0) + Number(r.qtd_total));
  }
  const primeira = domingoDaSemana(addDiasIso(hoje, -7));
  return Array.from({ length: quantidade }, (_, i) => {
    const inicio = addDiasIso(primeira, i * 7);
    const somaFuncao = new Map<string, number>();
    for (let k = 0; k < 7; k++) {
      porDiaFuncao.get(addDiasIso(inicio, k))?.forEach((q, f) => {
        somaFuncao.set(f, (somaFuncao.get(f) ?? 0) + q);
      });
    }
    const porFuncao = Array.from(somaFuncao, ([funcao, soma]) => ({
      funcao,
      qtd: roundExcel(soma / 7),
    }))
      .filter((x) => x.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd || a.funcao.localeCompare(b.funcao, "pt-BR"));
    return {
      inicio,
      fim: addDiasIso(inicio, 6),
      rotulo: rotuloSemana(inicio),
      total: porFuncao.reduce((s, x) => s + x.qtd, 0),
      porFuncao,
    };
  });
}

/**
 * 8 meses a partir do atual. Soma de dias trabalhados = Σ H(d) no mês (homem-dia); média =
 * essa soma ÷ dias corridos do mês (dias com zero entram na média).
 */
export function calcularMeses(diario: MoDiario[], hoje: string, quantidade = 8): MoMes[] {
  const porDia = totalPorDia(diario);
  const ano0 = Number(hoje.slice(0, 4));
  const mes0 = Number(hoje.slice(5, 7)) - 1;
  return Array.from({ length: quantidade }, (_, i) => {
    const ano = ano0 + Math.floor((mes0 + i) / 12);
    const mes = ((mes0 + i) % 12) + 1;
    const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
    let somaDias = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      somaDias += porDia.get(`${prefixo}-${String(d).padStart(2, "0")}`) ?? 0;
    }
    return {
      mes: prefixo,
      rotulo: `${mes}/${ano}`, // igual à planilha: "1/2027", sem zero à esquerda
      somaDias,
      media: somaDias / diasNoMes,
    };
  });
}

/** Janela de dias que os dois gráficos precisam (17 semanas + 8 meses a partir de hoje). */
export function janelaGraficos(hoje: string): { inicio: string; fim: string } {
  const inicioSemanas = domingoDaSemana(addDiasIso(hoje, -7));
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const fimSemanas = addDiasIso(inicioSemanas, 17 * 7 - 1);
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7)) - 1 + 8;
  const fimMeses = toIso(Date.UTC(ano + Math.floor(mes / 12), mes % 12, 1) - DIA_MS);
  return {
    inicio: inicioSemanas < inicioMes ? inicioSemanas : inicioMes,
    fim: fimSemanas > fimMeses ? fimSemanas : fimMeses,
  };
}

/** Normalização dos campos de texto da grade: MAIÚSCULAS e sem espaços sobrando. */
export const normalizarTexto = (v: string | null | undefined) =>
  (v ?? "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .toUpperCase();
