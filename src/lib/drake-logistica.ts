// Embarques pela PROGRAMAÇÃO LOGÍSTICA do Drake (BI/LogisticScheduling — pedido dela,
// 2026-11-12). Puro e sem dependência de servidor: usado pela sincronização (para montar os
// períodos gravados em drake_logistica_embarques) e pelo Dashboard (para corrigir o status do
// dia). Ver drake-logistica.test.ts.
//
// Validação feita antes (12/11/2026): pela programação, 80 dos 82 embarcados do Planejamento
// apareciam embarcados; pela Ficha Anual, só 40.
import type { DayStatusResult, HistNovoPeriodo } from "./histogramaNovo";

export interface PernaLogistica {
  /** ISO; pode vir com horário. */
  date: string;
  originDescription: string;
  destinationDescription: string;
  closed: boolean;
}

export interface PeriodoLogistica {
  dataInicio: string;
  dataFim: string;
  unidade: string | null;
}

const ehBase = (s: string | null | undefined) => (s ?? "").trim().toUpperCase() === "BASE";

function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Períodos embarcados a partir das pernas (BASE → unidade = embarque; unidade → BASE =
 * desembarque). Mesma regra de "já aconteceu" de statusAtualViaLogisticScheduling: perna de dia
 * anterior a hoje conta mesmo sem "Closed"; a de hoje só se "Closed"; futuras nunca.
 *
 * - O dia do desembarque NÃO conta como embarcado (igual à Ficha Anual, onde vira D/Folga).
 * - Perna de unidade para unidade (transferência) continua o mesmo embarque, com a nova unidade.
 * - Embarque sem desembarque ainda = embarcado até hoje.
 * - Se a primeira perna da janela é um desembarque, a pessoa já estava embarcada antes: o
 *   período começa em `inicioJanela`.
 * Tudo recortado em [inicioJanela, hoje].
 */
export function periodosEmbarcadosLogistica(
  pernas: PernaLogistica[],
  hoje: string,
  inicioJanela: string,
): PeriodoLogistica[] {
  const aconteceram = pernas
    .map((p) => ({ ...p, dia: p.date.slice(0, 10) }))
    .filter((p) => p.dia < hoje || (p.dia === hoje && p.closed))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const out: PeriodoLogistica[] = [];
  let aberto: { inicio: string; unidade: string | null } | null = null;
  aconteceram.forEach((p, i) => {
    const destino = p.destinationDescription.trim();
    if (!ehBase(destino)) {
      if (aberto) aberto.unidade = destino || aberto.unidade;
      else aberto = { inicio: p.dia, unidade: destino || null };
      return;
    }
    // Desembarque (destino BASE).
    if (aberto) {
      out.push({ dataInicio: aberto.inicio, dataFim: addDias(p.dia, -1), unidade: aberto.unidade });
      aberto = null;
    } else if (i === 0 && !ehBase(p.originDescription)) {
      out.push({
        dataInicio: inicioJanela,
        dataFim: addDias(p.dia, -1),
        unidade: p.originDescription.trim() || null,
      });
    }
  });
  if (aberto) {
    const a: { inicio: string; unidade: string | null } = aberto;
    out.push({ dataInicio: a.inicio, dataFim: hoje, unidade: a.unidade });
  }

  return out
    .map((p) => ({
      ...p,
      dataInicio: p.dataInicio < inicioJanela ? inicioJanela : p.dataInicio,
      dataFim: p.dataFim > hoje ? hoje : p.dataFim,
    }))
    .filter((p) => p.dataFim >= p.dataInicio);
}

export interface LinhaLogisticaDb {
  colaborador_id: string;
  data_inicio: string;
  data_fim: string;
  unidade: string | null;
}

export type LogisticaPorColaborador = Map<string, LinhaLogisticaDb[]>;

export function indexarLogistica(linhas: LinhaLogisticaDb[]): LogisticaPorColaborador {
  const m: LogisticaPorColaborador = new Map();
  for (const l of linhas) {
    if (!m.has(l.colaborador_id)) m.set(l.colaborador_id, []);
    m.get(l.colaborador_id)!.push(l);
  }
  return m;
}

const BALDES_EMBARCADO = new Set(["E", "DB", "FI", "FIF"]);

/**
 * Status do dia no Dashboard com a correção da programação logística: se o Drake confirmou o
 * embarque (dia de hoje ou anterior) e a Ficha Anual ainda não mostra Embarcado, vale Embarcado,
 * na unidade da programação. Em qualquer outro caso devolve o resultado da Ficha sem mudar nada.
 */
export function corrigirStatusPelaLogistica(
  resultado: DayStatusResult,
  colaboradorId: string,
  dia: string,
  hoje: string,
  logistica: LogisticaPorColaborador | null | undefined,
): DayStatusResult {
  if (!logistica || dia > hoje || BALDES_EMBARCADO.has(resultado.status)) return resultado;
  const p = logistica
    .get(colaboradorId)
    ?.find((l) => l.data_inicio <= dia && l.data_fim >= dia);
  if (!p) return resultado;
  const periodo: HistNovoPeriodo = {
    id: `logistica:${colaboradorId}:${p.data_inicio}`,
    colaborador_id: colaboradorId,
    unidade_operacional: p.unidade,
    centro_de_custo: null,
    bsp: null,
    tipo: "E",
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    dias: null,
    origem: "drake_logistica",
    created_at: "",
  };
  return { status: "E", periodo };
}
