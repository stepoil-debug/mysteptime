// "Desfazer" do Planejamento de Embarque (pedido dela, 2026-11-10): volta a última ação feita
// nesta aba, do jeito que estava. Puro — a aba guarda a pilha e executa no banco.
//
// Cada ação guarda o necessário para voltar:
// - editar: os valores de ANTES só dos campos que mudaram (e os de DEPOIS, para conferir que
//   ninguém mexeu de novo nesses campos antes de desfazer);
// - criar: o id criado (desfazer = excluir);
// - excluir: a linha inteira (desfazer = recriar com o mesmo id);
// - importar: todas as linhas de antes (desfazer = voltar a lista anterior).

export type LinhaPlanejamento = Record<string, unknown> & { id: string; nome: string };

export type AcaoPlanejamento =
  | {
      tipo: "editar";
      id: string;
      nome: string;
      antes: Record<string, unknown>;
      depois: Record<string, unknown>;
      descricao: string;
    }
  | { tipo: "criar"; id: string; nome: string; descricao: string }
  | { tipo: "excluir"; linha: LinhaPlanejamento; descricao: string }
  | { tipo: "importar"; linhas: LinhaPlanejamento[]; descricao: string };

/** Quantas ações ficam guardadas (as mais antigas saem). */
export const LIMITE_DESFAZER = 20;

// Colunas que o banco preenche sozinho (gatilho de auditoria) — nunca regravadas na mão.
const COLUNAS_DO_BANCO = new Set(["updated_at", "updated_by"]);

const igual = (a: unknown, b: unknown) =>
  (a ?? null) === (b ?? null) || String(a ?? "") === String(b ?? "");

/**
 * Ação de edição a partir da linha atual e do patch gravado. Só entram os campos que de fato
 * mudam; null quando nada muda (não vale a pena guardar).
 */
export function acaoEdicao(
  linha: LinhaPlanejamento,
  patch: Record<string, unknown>,
  descricao: string,
): AcaoPlanejamento | null {
  const antes: Record<string, unknown> = {};
  const depois: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(patch)) {
    if (COLUNAS_DO_BANCO.has(campo) || igual(linha[campo], valor)) continue;
    antes[campo] = linha[campo] ?? null;
    depois[campo] = valor ?? null;
  }
  if (Object.keys(antes).length === 0) return null;
  return { tipo: "editar", id: linha.id, nome: linha.nome, antes, depois, descricao };
}

/**
 * Campos que alguém alterou depois da ação (valor atual diferente do que a ação gravou).
 * Se houver algum, desfazer sobrescreveria a mudança dessa pessoa — a aba avisa e não desfaz.
 */
export function camposAlteradosDepois(
  atual: Record<string, unknown>,
  depois: Record<string, unknown>,
): string[] {
  return Object.keys(depois).filter((campo) => !igual(atual[campo], depois[campo]));
}

/** Linha pronta para regravar (recriar após exclusão ou voltar uma importação). */
export function linhaParaRestaurar(linha: LinhaPlanejamento): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(linha)) {
    if (!COLUNAS_DO_BANCO.has(campo)) out[campo] = valor;
  }
  return out;
}

/** Empilha mantendo só as últimas LIMITE_DESFAZER. */
export function empilhar(
  pilha: AcaoPlanejamento[],
  acao: AcaoPlanejamento | null,
): AcaoPlanejamento[] {
  if (!acao) return pilha;
  return [...pilha, acao].slice(-LIMITE_DESFAZER);
}

/** Texto curto do botão/tooltip. */
export function rotuloAcao(acao: AcaoPlanejamento): string {
  switch (acao.tipo) {
    case "editar":
      return acao.descricao;
    case "criar":
      return `Cadastro de ${acao.nome}`;
    case "excluir":
      return `Exclusão de ${acao.linha.nome}`;
    case "importar":
      return `Importação de planilha (volta ${acao.linhas.length} registro(s) anteriores)`;
  }
}
