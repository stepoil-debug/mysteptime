import "@tanstack/react-start/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrakeHttpClient } from "./http/drake-http-client.types.server";
import { fetchDrakeWorkers } from "./worker-annual-position-api.server";
import {
  formatarEnderecoDrake,
  normMatricula,
  type EnderecoDrake,
} from "@/lib/planejamento-drake-cadastro";
import { selectAllPages } from "@/lib/supabasePaginate";
import { logger } from "./logger";

// Etapa EXTRA da sincronização do Drake (pedido dela, 2026-11-18): endereço de quem está no
// Planejamento de Embarque (com matrícula), para a coluna "Endereço" (logística de
// deslocamento). Grava só em drake_enderecos; quem chama trata falha como aviso.

const TABELA = "drake_enderecos";
const CONCORRENCIA = 8;

export interface EnderecosSyncResult {
  consultados: number;
  comEndereco: number;
  falhas: number;
}

async function fetchEnderecos(http: DrakeHttpClient, workerId: string): Promise<EnderecoDrake[]> {
  const response = await http.get(`/api/v1/Worker/${encodeURIComponent(workerId)}/Address`, {
    failOnStatusCode: false,
  });
  if (response.status() < 200 || response.status() >= 300) {
    throw new Error(`O Drake não devolveu o endereço (HTTP ${response.status()}).`);
  }
  const value: unknown = JSON.parse(await response.text());
  return Array.isArray(value) ? (value as EnderecoDrake[]) : [];
}

export async function synchronizeDrakeEnderecos(
  db: SupabaseClient<any, "mysteptime", "mysteptime">,
  http: DrakeHttpClient,
): Promise<EnderecosSyncResult> {
  const planejamento = await selectAllPages<{ matricula: string | null }>((from, to) =>
    db.from("planejamento_embarque").select("matricula").order("id").range(from, to),
  );
  const alvo = new Map<string, string>(); // norm → matrícula como está no Planejamento
  for (const p of planejamento) {
    const n = normMatricula(p.matricula);
    if (n && !alvo.has(n)) alvo.set(n, p.matricula!.trim());
  }
  if (alvo.size === 0) return { consultados: 0, comEndereco: 0, falhas: 0 };

  // Mesma matrícula pode ter mais de um cadastro ativo no Drake (ex.: direto + terceirizado):
  // tenta cada um até achar endereço.
  const workersPorMatricula = new Map<string, string[]>();
  for (const w of await fetchDrakeWorkers(http)) {
    const n = normMatricula(w.registration);
    if (!n || !alvo.has(n)) continue;
    if (!workersPorMatricula.has(n)) workersPorMatricula.set(n, []);
    workersPorMatricula.get(n)!.push(w.id);
  }

  const fila = Array.from(workersPorMatricula.entries());
  const linhas: { matricula_norm: string; matricula: string; endereco: string; atualizado_em: string }[] = [];
  const agora = new Date().toISOString();
  let falhas = 0;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, async () => {
      while (cursor < fila.length) {
        const [n, ids] = fila[cursor++];
        try {
          for (const id of ids) {
            const endereco = formatarEnderecoDrake(await fetchEnderecos(http, id));
            if (endereco) {
              linhas.push({ matricula_norm: n, matricula: alvo.get(n)!, endereco, atualizado_em: agora });
              break;
            }
          }
        } catch {
          falhas++;
        }
      }
    }),
  );

  if (fila.length > 0 && falhas > fila.length / 2) {
    throw new Error(`Endereços: ${falhas} de ${fila.length} consultas falharam — nada foi alterado.`);
  }
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db
      .from(TABELA)
      .upsert(linhas.slice(i, i + 500), { onConflict: "matricula_norm" });
    if (error) throw new Error(`Não foi possível gravar os endereços: ${error.message}`);
  }
  logger.info("drake-update", "Enderecos sincronizados", {
    consultados: fila.length,
    comEndereco: linhas.length,
    falhas,
  });
  return { consultados: fila.length, comEndereco: linhas.length, falhas };
}
