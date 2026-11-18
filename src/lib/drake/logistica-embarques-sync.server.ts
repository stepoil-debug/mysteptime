import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrakeHttpClient } from "./http/drake-http-client.types.server";
import { fetchDrakeWorkers } from "./worker-annual-position-api.server";
import { fetchLogisticScheduling } from "./logistic-scheduling-api.server";
import { buildWorkerKey } from "@/lib/histograma/drake-snapshot";
import { periodosEmbarcadosLogistica } from "@/lib/drake-logistica";
import { selectAllPages } from "@/lib/supabasePaginate";
import { logger } from "./logger";

// Etapa EXTRA da sincronização do Drake (pedido dela, 2026-11-12): grava em
// drake_logistica_embarques os períodos embarcados pela programação logística do Drake, que
// fica em dia quando a Ficha Anual atrasa. Não toca em hist_novo_periodos, na importação da
// Ficha Anual, no Timesheet nem no BM. Quem chama trata a falha desta etapa como aviso — a
// sincronização principal nunca é derrubada por ela.

const TABELA = "drake_logistica_embarques";
export const LOGISTICA_DIAS_ANTES = 60;
const LIMITE_PERNAS = 30;
const CONCORRENCIA = 8;

export interface LogisticaEmbarquesResult {
  colaboradores: number;
  periodos: number;
  falhas: number;
}

function hojeEm(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function synchronizeDrakeLogisticaEmbarques(
  db: SupabaseClient,
  http: DrakeHttpClient,
  timezone = "America/Sao_Paulo",
): Promise<LogisticaEmbarquesResult> {
  const hoje = hojeEm(timezone);
  const inicioJanela = addDias(hoje, -LOGISTICA_DIAS_ANTES);

  // Só quem já está no Histograma (mesma chave empresa + matrícula da Ficha Anual).
  const colaboradores = await selectAllPages<{ id: string; empresa: string | null; matricula: string }>(
    (from, to) =>
      db
        .from("hist_novo_colaboradores")
        .select("id, empresa, matricula")
        .eq("ativo", true)
        .order("id")
        .range(from, to),
  );
  const idPorChave = new Map<string, string>();
  for (const c of colaboradores) {
    if (!c.empresa?.trim() || !c.matricula?.trim()) continue;
    idPorChave.set(buildWorkerKey(c.empresa, c.matricula), c.id);
  }

  const workers = await fetchDrakeWorkers(http);
  const alvos: { workerId: string; colaboradorId: string }[] = [];
  const vistos = new Set<string>();
  for (const w of workers) {
    if (!w.companyName?.trim() || !w.registration?.trim()) continue;
    const colaboradorId = idPorChave.get(buildWorkerKey(w.companyName, w.registration));
    if (!colaboradorId || vistos.has(colaboradorId)) continue;
    vistos.add(colaboradorId);
    alvos.push({ workerId: w.id, colaboradorId });
  }
  if (alvos.length === 0) {
    throw new Error("Nenhum colaborador do Histograma encontrado no Drake — nada foi alterado.");
  }

  const execucaoId = crypto.randomUUID();
  const consultados: string[] = [];
  const linhas: {
    colaborador_id: string;
    data_inicio: string;
    data_fim: string;
    unidade: string | null;
    execucao_id: string;
  }[] = [];
  let falhas = 0;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, alvos.length) }, async () => {
      while (cursor < alvos.length) {
        const alvo = alvos[cursor++];
        try {
          const pernas = await fetchLogisticScheduling(http, alvo.workerId, {
            daysBefore: LOGISTICA_DIAS_ANTES,
            daysAfter: 1,
            limit: LIMITE_PERNAS,
          });
          consultados.push(alvo.colaboradorId);
          for (const p of periodosEmbarcadosLogistica(pernas, hoje, inicioJanela)) {
            linhas.push({
              colaborador_id: alvo.colaboradorId,
              data_inicio: p.dataInicio,
              data_fim: p.dataFim,
              unidade: p.unidade,
              execucao_id: execucaoId,
            });
          }
        } catch {
          // Falha pontual numa pessoa: mantém as linhas antigas dela.
          falhas++;
        }
      }
    }),
  );

  // Segurança: se mais da metade falhou, é problema do Drake/sessão — não troca nada.
  if (consultados.length === 0 || falhas > alvos.length / 2) {
    throw new Error(
      `Programação logística: ${falhas} de ${alvos.length} consultas falharam — nada foi alterado.`,
    );
  }

  // Grava as novas primeiro; só depois apaga as antigas de quem foi consultado.
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from(TABELA).insert(linhas.slice(i, i + 500));
    if (error) throw new Error(`Não foi possível gravar a programação logística: ${error.message}`);
  }
  for (let i = 0; i < consultados.length; i += 200) {
    const { error } = await db
      .from(TABELA)
      .delete()
      .in("colaborador_id", consultados.slice(i, i + 200))
      .neq("execucao_id", execucaoId);
    if (error) throw new Error(`Não foi possível limpar a programação logística antiga: ${error.message}`);
  }

  logger.info("drake-update", "Programacao logistica sincronizada", {
    colaboradores: consultados.length,
    periodos: linhas.length,
    falhas,
  });
  return { colaboradores: consultados.length, periodos: linhas.length, falhas };
}
