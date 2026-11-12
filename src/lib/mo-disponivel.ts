// "M.O disponível x Dia" (pedido dela, 2026-11-10): quantas pessoas de cada função estão
// disponíveis em cada um dos próximos dias, só com os dados do Planejamento de Embarque
// (Função, Status e datas). Puro — ver mo-disponivel.test.ts.
//
// Regra por pessoa e dia (pedido dela, 2026-11-11: "puxar tudo da aba Planejamento de Embarque"):
// - Hoje: disponível = Status "Disponível" no Planejamento (bate com o cartão Stand By).
// - Próximos dias:
//   · quem está "Disponível" continua disponível, menos nos dias cobertos pelas datas dele
//     (Embarque→Desembarque, Folga, Férias, Programado 1 + Duração);
//   · quem está Embarcado/Programado/Folga/Trabalho Externo/Férias volta a ficar disponível no
//     dia seguinte ao fim do ciclo que as datas dele mostram (sem data de fim, segue fora);
//   · qualquer outro Status (Bloqueados - Henrique, Indisponível, Terceirizado, Em treinamento,
//     Em qualificação, texto livre...) não conta como disponível em nenhum dia.
import { classificarStatusPlanejamento } from "./dashboard-status-planejamento";

export interface LinhaDisponibilidade {
  nome: string;
  funcao: string | null;
  status: string | null;
  rh_bloqueado?: boolean;
  embarque: string | null;
  desembarque: string | null;
  duracao_embarque_dias: number | null;
  folga_inicio: string | null;
  folga_fim: string | null;
  ferias_inicio: string | null;
  ferias_fim: string | null;
  programado_1: string | null;
}

export interface MoDisponivelFuncao {
  funcao: string;
  /** Total de M.O da função no Planejamento (sem Terceirizado, Indisponível e Bloqueados). */
  total: number;
  /** Um item por dia (mesma ordem de `dias`). */
  porDia: { dia: string; qtd: number; nomes: string[] }[];
}

export function addDiasIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function proximosDias(hoje: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDiasIso(hoje, i));
}

const dentro = (dia: string, ini: string | null, fim: string | null) =>
  !!ini && !!fim && ini <= dia && dia <= fim;

/** Datas do Planejamento cobrem esse dia (embarque, folga, férias ou embarque programado)? */
function ocupadoPelasDatas(r: LinhaDisponibilidade, dia: string): boolean {
  if (dentro(dia, r.embarque, r.desembarque)) return true;
  if (dentro(dia, r.folga_inicio, r.folga_fim)) return true;
  if (dentro(dia, r.ferias_inicio, r.ferias_fim)) return true;
  if (r.programado_1 && dia >= r.programado_1) {
    const dur =
      r.duracao_embarque_dias && r.duracao_embarque_dias > 0 ? r.duracao_embarque_dias : null;
    // Sem duração, não dá para saber quando volta: fica ocupado dali em diante.
    if (!dur || dia <= addDiasIso(r.programado_1, dur)) return true;
  }
  return false;
}

/** A pessoa está disponível nesse dia? */
export function disponivelNoDia(r: LinhaDisponibilidade, dia: string, hoje: string): boolean {
  const balde = classificarStatusPlanejamento(r.status, r.rh_bloqueado);

  if (balde === "standBy") {
    // Hoje vale o Status, igual à aba; nos próximos dias, as datas marcadas tiram a pessoa.
    return dia === hoje || !ocupadoPelasDatas(r, dia);
  }

  const emCiclo =
    balde === "embarcado" ||
    balde === "programado" ||
    balde === "folga" ||
    balde === "trabalhoExterno" ||
    balde === "ferias";
  if (!emCiclo || dia === hoje) return false;
  // Volta depois do fim do ciclo que as datas mostram; sem nenhuma data de fim, segue fora.
  const fins = [r.desembarque, r.folga_fim, r.ferias_fim];
  if (r.programado_1 && r.duracao_embarque_dias && r.duracao_embarque_dias > 0) {
    fins.push(addDiasIso(r.programado_1, r.duracao_embarque_dias));
  }
  const fimConhecido = fins
    .filter((d): d is string => !!d && d >= hoje)
    .sort()
    .pop();
  if (!fimConhecido || dia <= fimConhecido) return false;
  return !ocupadoPelasDatas(r, dia);
}

/** Tabela função × dia (funções em ordem alfabética; "Sem função" no fim). */
// Fora do quantitativo inteiro (pedido dela, 2026-11-12): Terceirizado, Indisponível e todos os
// Bloqueados (Base Henrique, Bloqueio - Base - Henrique, Na Base, Bloqueio Temporário, Bloqueio RH).
const FORA_DO_QUANTITATIVO = new Set([
  "terceirizado",
  "indisponivel",
  "naBase",
  "baseHenrique",
  "bloqueioBaseHenrique",
  "bloqueioTemporario",
  "bloqueioRH",
]);

const ROTULO_BALDE: Record<string, string> = {
  embarcado: "Embarcado",
  programado: "Programado",
  folga: "Folga",
  standBy: "Disponível",
  trabalhoExterno: "Trabalho Externo",
  ferias: "Férias",
  atestado: "Atestado",
  afastamento: "Afastamento",
  outros: "Outros",
  indisponivel: "Indisponível",
  terceirizado: "Terceirizado",
  naBase: "Na Base",
  baseHenrique: "Base Henrique",
  bloqueioBaseHenrique: "Bloqueio - Base - Henrique",
  bloqueioTemporario: "Bloqueio Temporário",
  bloqueioRH: "Bloqueio RH",
};
const ORDEM_BALDE = Object.keys(ROTULO_BALDE);

/**
 * Quais Status compõem o Total M.O (efetivo offshore do card) e quais ficam fora, com a
 * quantidade de cada um (pedido dela, 2026-11-12) — mesma regra de FORA_DO_QUANTITATIVO.
 */
export function composicaoEfetivo(linhas: LinhaDisponibilidade[]) {
  const dentro = new Map<string, number>();
  const fora = new Map<string, number>();
  for (const r of linhas) {
    const b = classificarStatusPlanejamento(r.status, r.rh_bloqueado);
    const alvo = FORA_DO_QUANTITATIVO.has(b) ? fora : dentro;
    alvo.set(b, (alvo.get(b) ?? 0) + 1);
  }
  const lista = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => ORDEM_BALDE.indexOf(a[0]) - ORDEM_BALDE.indexOf(b[0]))
      .map(([b, qtd]) => ({ status: ROTULO_BALDE[b] ?? b, qtd }));
  const total = Array.from(dentro.values()).reduce((s, n) => s + n, 0);
  return { total, dentro: lista(dentro), fora: lista(fora) };
}

export function moDisponivelPorDia(
  linhas: LinhaDisponibilidade[],
  hoje: string,
  nDias = 14,
): { dias: string[]; funcoes: MoDisponivelFuncao[] } {
  const dias = proximosDias(hoje, nDias);
  const porFuncao = new Map<string, LinhaDisponibilidade[]>();
  for (const r of linhas) {
    if (FORA_DO_QUANTITATIVO.has(classificarStatusPlanejamento(r.status, r.rh_bloqueado))) continue;
    const funcao = r.funcao?.trim() || "Sem função";
    if (!porFuncao.has(funcao)) porFuncao.set(funcao, []);
    porFuncao.get(funcao)!.push(r);
  }
  const funcoes = Array.from(porFuncao.entries())
    .sort(([a], [b]) =>
      a === "Sem função" ? 1 : b === "Sem função" ? -1 : a.localeCompare(b, "pt-BR"),
    )
    .map(([funcao, pessoas]) => ({
      funcao,
      total: pessoas.length,
      porDia: dias.map((dia) => {
        const nomes = pessoas
          .filter((p) => disponivelNoDia(p, dia, hoje))
          .map((p) => p.nome)
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        return { dia, qtd: nomes.length, nomes };
      }),
    }));
  return { dias, funcoes };
}

/**
 * Disponível por função em dias quaisquer (Detalhamento "Planejado x Disponível" da aba M.O,
 * pedido dela, 2026-11-12). Mesma regra e mesma população de moDisponivelPorDia — só aceita
 * qualquer lista de dias. Dias antes de hoje ficam null (o disponível só existe de hoje em
 * diante). Chave = função em maiúsculas, sem acento e sem espaço sobrando.
 */
export function disponivelPorFuncaoNosDias(
  linhas: LinhaDisponibilidade[],
  dias: string[],
  hoje: string,
): Map<string, { funcao: string; total: number; porDia: Map<string, number | null> }> {
  const chave = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  const porFuncao = new Map<string, { funcao: string; pessoas: LinhaDisponibilidade[] }>();
  for (const r of linhas) {
    if (FORA_DO_QUANTITATIVO.has(classificarStatusPlanejamento(r.status, r.rh_bloqueado))) continue;
    const funcao = r.funcao?.trim() || "Sem função";
    const k = chave(funcao);
    if (!porFuncao.has(k)) porFuncao.set(k, { funcao, pessoas: [] });
    porFuncao.get(k)!.pessoas.push(r);
  }
  const out = new Map<string, { funcao: string; total: number; porDia: Map<string, number | null> }>();
  porFuncao.forEach(({ funcao, pessoas }, k) => {
    const porDia = new Map<string, number | null>();
    for (const dia of dias) {
      porDia.set(dia, dia < hoje ? null : pessoas.filter((p) => disponivelNoDia(p, dia, hoje)).length);
    }
    out.set(k, { funcao, total: pessoas.length, porDia });
  });
  return out;
}
