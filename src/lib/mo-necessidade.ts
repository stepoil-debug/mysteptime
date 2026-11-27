// Necessidade de M.O x Back (pedido dela, 2026-11-27). Puro — ver mo-necessidade.test.ts.
//
// Por função e dia:
// - Necessidade (N) = planejado da M.O (mesma base do Detalhamento – Planejado).
// - Apontadas (A)   = pessoas da função a bordo no dia pelo Planejamento de Embarque
//                     (Embarque→Desembarque ou Programado 1 + Duração; hoje, Status Embarcado).
// - Falta fixos     = max(0, N − A).
// - Back necessário = N (1 back por posição: regime 1x1).
// - Cobertura (C)   = quem pode cobrir o back: Status Disponível (stand-by), Na Base (aguardando)
//                     ou Programado, que não esteja a bordo/de folga/férias naquele dia.
// - Back pendente   = max(0, N − C).
// Quando os fixos estão completos, só o back aparece como pendência.
import { classificarStatusPlanejamento } from "./dashboard-status-planejamento";
import { addDiasIso, type LinhaDisponibilidade } from "./mo-disponivel";

const chave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const dentro = (dia: string, ini: string | null, fim: string | null) =>
  !!ini && !!fim && ini <= dia && dia <= fim;

/** A pessoa está a bordo (apontada) nesse dia? */
export function aBordoNoDia(r: LinhaDisponibilidade, dia: string, hoje: string): boolean {
  if (dentro(dia, r.embarque, r.desembarque)) return true;
  if (r.programado_1 && r.duracao_embarque_dias && r.duracao_embarque_dias > 0) {
    if (dentro(dia, r.programado_1, addDiasIso(r.programado_1, r.duracao_embarque_dias - 1)))
      return true;
  }
  if (dia === hoje && classificarStatusPlanejamento(r.status, r.rh_bloqueado) === "embarcado")
    return true;
  return false;
}

const BALDES_COBERTURA = new Set(["standBy", "naBase", "programado"]);

/** Pode cobrir back nesse dia? (Disponível, Na Base ou Programado, livre nas datas.) */
export function podeCobrirNoDia(r: LinhaDisponibilidade, dia: string, hoje: string): boolean {
  if (!BALDES_COBERTURA.has(classificarStatusPlanejamento(r.status, r.rh_bloqueado))) return false;
  if (aBordoNoDia(r, dia, hoje)) return false;
  if (dentro(dia, r.folga_inicio, r.folga_fim)) return false;
  if (dentro(dia, r.ferias_inicio, r.ferias_fim)) return false;
  return true;
}

export interface PessoasDia {
  apontadas: string[];
  cobertura: string[];
}

/** Por função (chave normalizada) e dia: nomes apontados e nomes que podem cobrir back. */
export function pessoasPorFuncaoNosDias(
  linhas: LinhaDisponibilidade[],
  dias: string[],
  hoje: string,
): Map<string, Map<string, PessoasDia>> {
  const out = new Map<string, Map<string, PessoasDia>>();
  for (const r of linhas) {
    const f = r.funcao?.trim();
    if (!f) continue;
    const k = chave(f);
    if (!out.has(k)) out.set(k, new Map(dias.map((d) => [d, { apontadas: [], cobertura: [] }])));
    const m = out.get(k)!;
    for (const d of dias) {
      if (aBordoNoDia(r, d, hoje)) m.get(d)!.apontadas.push(r.nome);
      else if (podeCobrirNoDia(r, d, hoje)) m.get(d)!.cobertura.push(r.nome);
    }
  }
  return out;
}

export interface NecessidadeFuncao {
  funcao: string;
  necessidade: number;
  apontadas: number;
  faltaFixos: number;
  backNecessario: number;
  cobertura: number;
  backPendente: number;
  /** Nomes que podem cobrir back em algum dia da semana. */
  nomesCobertura: string[];
}

const media = (v: number[]) =>
  v.length ? Math.floor(v.reduce((s, x) => s + x, 0) / v.length + 0.5 + 1e-9) : 0;

/** Médias da semana (arredondadas) por função. Só funções com necessidade > 0. */
export function necessidadeDaSemana(
  funcoes: { chave: string; funcao: string; porDia: Map<string, number> | undefined }[],
  pessoas: Map<string, Map<string, PessoasDia>>,
  dias: string[],
): NecessidadeFuncao[] {
  const out: NecessidadeFuncao[] = [];
  for (const f of funcoes) {
    const necessidade = media(dias.map((d) => f.porDia?.get(d) ?? 0));
    if (necessidade <= 0) continue;
    const p = pessoas.get(f.chave);
    const apontadas = media(dias.map((d) => p?.get(d)?.apontadas.length ?? 0));
    const cobertura = media(dias.map((d) => p?.get(d)?.cobertura.length ?? 0));
    const nomes = new Set<string>();
    dias.forEach((d) => p?.get(d)?.cobertura.forEach((n) => nomes.add(n)));
    out.push({
      funcao: f.funcao,
      necessidade,
      apontadas,
      faltaFixos: Math.max(0, necessidade - apontadas),
      backNecessario: necessidade,
      cobertura,
      backPendente: Math.max(0, necessidade - cobertura),
      nomesCobertura: Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
  }
  return out.sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
}
