// "Planejado x Disponível" de mão de obra (pedido dela, 2026-11-12). Puro — ver
// mo-planejado-x-disponivel.test.ts. ADITIVO: não muda mo-planejado.ts (gráficos de planejado)
// nem mo-disponivel.ts (card "M.O disponível x Dia"); só junta os dois.
//
// - Planejado(função, D): vem da RPC mo_planejado_drake_diario (soma de QTD da aba M.O ativas em
//   D, BSP ≠ ON HOLD, já agrupada pela função do De/Para).
// - Planejado semanal: MÉDIA dos 7 dias (domingo a sábado), arredondada (ROUND do Excel).
// - Disponível semanal: média arredondada do disponível diário da mesma semana (só os dias de
//   hoje em diante — o disponível não existe para dias que já passaram).
import { addDiasIso, domingoDaSemana, roundExcel, rotuloSemana } from "./mo-planejado";

export type CorPxD = "vazio" | "atende" | "limite" | "falta";

/** Regra de cores: sem demanda (cinza), atende (verde), no limite (amarelo), falta (vermelho). */
export function corPlanejadoDisponivel(
  planejado: number | null | undefined,
  disponivel: number | null | undefined,
): CorPxD {
  const p = planejado ?? 0;
  if (p <= 0) return "vazio";
  const d = disponivel ?? 0;
  if (p < d) return "atende";
  if (p === d) return "limite";
  return "falta";
}

/**
 * Cores da planilha da liderança (aba "Detalhamento 1 - Planejado", formatação condicional —
 * pedido dela, 2026-11-12): verde #00B050 (planejado < disponível), amarelo #FFFF00 (=),
 * vermelho #FF0000 (>), e o cinza #BFBFBF das células sem demanda; texto preto.
 */
export const ESTILO_PXD: Record<
  CorPxD,
  { bg: string; border: string; text: string; rotulo: string }
> = {
  vazio: { bg: "#BFBFBF", border: "#A6A6A6", text: "#000000", rotulo: "Sem demanda" },
  atende: { bg: "#00B050", border: "#00964A", text: "#000000", rotulo: "Atende" },
  limite: { bg: "#FFFF00", border: "#E6D800", text: "#000000", rotulo: "No limite" },
  falta: { bg: "#FF0000", border: "#D90000", text: "#000000", rotulo: "Falta M.O" },
};

/** Cabeçalhos da planilha: semana (laranja claro), dias (cinza), hoje (vermelho). */
export const CABECALHO_PLANILHA = {
  semana: "#F4B183",
  dia: "#BFBFBF",
  hoje: "#FF0000",
  disponivelTexto: "#FF0000",
};

export interface MesPxD {
  mes: string;
  rotulo: string;
  dias: string[];
}

const MES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Mês atual + `seguintes` meses, com todos os dias de cada um. */
export function mesesAPartirDe(hoje: string, seguintes = 5): MesPxD[] {
  const ano0 = Number(hoje.slice(0, 4));
  const mes0 = Number(hoje.slice(5, 7)) - 1;
  return Array.from({ length: seguintes + 1 }, (_, i) => {
    const ano = ano0 + Math.floor((mes0 + i) / 12);
    const mes = (mes0 + i) % 12;
    const n = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}`;
    return {
      mes: prefixo,
      rotulo: `${MES_CURTO[mes]}/${String(ano).slice(2)}`,
      dias: Array.from({ length: n }, (_, d) => `${prefixo}-${String(d + 1).padStart(2, "0")}`),
    };
  });
}

export interface LinhaPlanejadoRpc {
  dia: string;
  funcao: string;
  sem_correspondencia: boolean;
  planejado: number | string;
}

export const normFuncao = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

export interface PlanejadoPorFuncao {
  /** Nome exibido (o do De/Para, ou a Função Padrão quando não tem correspondência). */
  funcao: string;
  semCorrespondencia: boolean;
  porDia: Map<string, number>;
}

/** Agrupa as linhas da RPC por função (chave normalizada). */
export function agruparPlanejado(linhas: LinhaPlanejadoRpc[]): Map<string, PlanejadoPorFuncao> {
  const m = new Map<string, PlanejadoPorFuncao>();
  for (const l of linhas) {
    const chave = normFuncao(l.funcao) + (l.sem_correspondencia ? "|sem" : "");
    if (!m.has(chave))
      m.set(chave, {
        funcao: l.funcao,
        semCorrespondencia: l.sem_correspondencia,
        porDia: new Map(),
      });
    const g = m.get(chave)!;
    g.porDia.set(l.dia, (g.porDia.get(l.dia) ?? 0) + Number(l.planejado));
  }
  return m;
}

export interface SemanaPxD {
  inicio: string;
  fim: string;
  rotulo: string;
  dias: string[];
}

/** Semanas de domingo a sábado: a que contém `hoje` + `seguintes` semanas. */
export function semanasAPartirDe(hoje: string, seguintes = 18): SemanaPxD[] {
  const primeira = domingoDaSemana(hoje);
  return Array.from({ length: seguintes + 1 }, (_, i) => {
    const inicio = addDiasIso(primeira, i * 7);
    return {
      inicio,
      fim: addDiasIso(inicio, 6),
      rotulo: rotuloSemana(inicio),
      dias: Array.from({ length: 7 }, (_, k) => addDiasIso(inicio, k)),
    };
  });
}

/** Média arredondada dos 7 dias da semana (dia sem valor = 0). */
export function mediaSemana(porDia: Map<string, number> | undefined, dias: string[]): number {
  if (!dias.length) return 0;
  const soma = dias.reduce((s, d) => s + (porDia?.get(d) ?? 0), 0);
  return roundExcel(soma / dias.length);
}

/**
 * Média arredondada do disponível nos dias da semana que têm disponível (de hoje em diante);
 * null quando a semana inteira já passou.
 */
export function mediaDisponivelSemana(
  porDia: Map<string, number | null> | undefined,
  dias: string[],
): number | null {
  const valores = dias.map((d) => porDia?.get(d)).filter((v): v is number => typeof v === "number");
  if (!valores.length) return null;
  return roundExcel(valores.reduce((s, v) => s + v, 0) / valores.length);
}

export const DIA_SEMANA_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const diaDaSemana = (iso: string) =>
  DIA_SEMANA_CURTO[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const fmtDdMmAaaa = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
