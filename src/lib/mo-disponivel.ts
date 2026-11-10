// "M.O disponível x Dia" (pedido dela, 2026-11-10): quantas pessoas de cada função estão
// disponíveis em cada um dos próximos dias, só com os dados do Planejamento de Embarque
// (Função, Status e datas). Puro — ver mo-disponivel.test.ts.
//
// Regra por pessoa e dia:
// - Terceirizado não entra (fica fora de toda contagem — ver dashboard-status-planejamento.ts).
// - Status sem data de fim (Bloqueados - Henrique, Na Base, Bloqueio RH, Indisponível, Atestado,
//   Afastamento) → indisponível em todos os dias.
// - Demais: indisponível nos dias cobertos por Embarque→Desembarque, Folga, Férias ou pelo
//   embarque programado (Programado 1 + Duração). Hoje, quem está Embarcado/Programado/Folga/
//   Trabalho Externo/Férias pelo Status também não está disponível; e se esse Status não tem as
//   datas que dizem quando acaba, continua indisponível nos dias seguintes.
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
  /** Um item por dia (mesma ordem de `dias`). */
  porDia: { dia: string; qtd: number; nomes: string[] }[];
}

const SEMPRE_INDISPONIVEL = new Set([
  "naBase",
  "baseHenrique",
  "bloqueioBaseHenrique",
  "bloqueioTemporario",
  "bloqueioRH",
  "indisponivel",
  "atestado",
  "afastamento",
]);

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

/** A pessoa está disponível nesse dia? */
export function disponivelNoDia(r: LinhaDisponibilidade, dia: string, hoje: string): boolean {
  const balde = classificarStatusPlanejamento(r.status, r.rh_bloqueado);
  if (balde === "terceirizado" || SEMPRE_INDISPONIVEL.has(balde)) return false;

  if (dentro(dia, r.embarque, r.desembarque)) return false;
  if (dentro(dia, r.folga_inicio, r.folga_fim)) return false;
  if (dentro(dia, r.ferias_inicio, r.ferias_fim)) return false;
  if (r.programado_1 && dia >= r.programado_1) {
    const dur =
      r.duracao_embarque_dias && r.duracao_embarque_dias > 0 ? r.duracao_embarque_dias : null;
    // Sem duração, não dá para saber quando volta: fica indisponível dali em diante.
    if (!dur || dia <= addDiasIso(r.programado_1, dur)) return false;
  }

  // Status de hoje que já diz que a pessoa está ocupada.
  const ocupadoPeloStatus =
    balde === "embarcado" ||
    balde === "programado" ||
    balde === "folga" ||
    balde === "trabalhoExterno" ||
    balde === "ferias";
  if (ocupadoPeloStatus) {
    if (dia === hoje) return false;
    // Até quando? Pela última data conhecida do ciclo; sem nenhuma, segue indisponível.
    const fimConhecido = [r.desembarque, r.folga_fim, r.ferias_fim]
      .filter((d): d is string => !!d && d >= hoje)
      .sort()
      .pop();
    if (!fimConhecido || dia <= fimConhecido) return false;
  }
  return true;
}

/** Tabela função × dia (funções em ordem alfabética; "Sem função" no fim). */
export function moDisponivelPorDia(
  linhas: LinhaDisponibilidade[],
  hoje: string,
  nDias = 14,
): { dias: string[]; funcoes: MoDisponivelFuncao[] } {
  const dias = proximosDias(hoje, nDias);
  const porFuncao = new Map<string, LinhaDisponibilidade[]>();
  for (const r of linhas) {
    if (classificarStatusPlanejamento(r.status, r.rh_bloqueado) === "terceirizado") continue;
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
