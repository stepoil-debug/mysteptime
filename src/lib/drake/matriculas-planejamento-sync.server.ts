import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sugerirMatriculas, type CadastroDrake } from "@/lib/planejamento-drake-cadastro";
import { selectAllPages } from "@/lib/supabasePaginate";
import { logger } from "./logger";

// Etapa EXTRA da sincronização do Drake (pedido dela, 2026-11-18: "as matrículas não podem vir
// automaticamente?"): preenche a matrícula de quem está SEM ela no Planejamento de Embarque,
// SÓ quando o nome é igual (sem acento/caixa) a um único cadastro do Drake e a matrícula não
// está em uso por outra linha. Nome só parecido NUNCA é preenchido sozinho — fica para o botão
// "Preencher matrículas" da tela, para conferir. Nunca sobrescreve matrícula já preenchida.
// Registra no Histórico do Planejamento. Quem chama trata falha como aviso.

export async function preencherMatriculasPlanejamento(
  db: SupabaseClient,
): Promise<{ preenchidas: number }> {
  const [planejamento, cadastros] = await Promise.all([
    selectAllPages<{ id: string; nome: string; matricula: string | null }>((from, to) =>
      db.from("planejamento_embarque").select("id, nome, matricula").order("id").range(from, to),
    ),
    selectAllPages<CadastroDrake>((from, to) =>
      db
        .from("hist_novo_colaboradores")
        .select("nome, matricula, empresa, ativo")
        .order("id")
        .range(from, to),
    ),
  ]);
  const exatas = sugerirMatriculas(
    planejamento,
    cadastros,
    planejamento.map((p) => p.matricula ?? ""),
  ).filter((s) => s.tipo === "exato");

  const feitas: string[] = [];
  for (const s of exatas) {
    const { data, error } = await db
      .from("planejamento_embarque")
      .update({ matricula: s.matricula })
      .eq("id", s.id)
      .or("matricula.is.null,matricula.eq.")
      .select("id");
    if (error) throw new Error(`Não foi possível preencher a matrícula: ${error.message}`);
    if (data?.length) feitas.push(`${s.nome} (${s.matricula})`);
  }

  if (feitas.length) {
    await db.from("planejamento_embarque_log").insert({
      user_id: null,
      descricao:
        `Sincronização do Drake preencheu ${feitas.length} matrícula(s) pelo cadastro do Drake ` +
        `(mesmo nome): ${feitas.join(", ")}`,
    });
  }
  logger.info("drake-update", "Matriculas do Planejamento preenchidas", {
    preenchidas: feitas.length,
  });
  return { preenchidas: feitas.length };
}
