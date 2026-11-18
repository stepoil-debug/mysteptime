import "@tanstack/react-start/server-only";
import { DrakeIntegrationError } from "./integration-error.server";
import { logger } from "./logger";
import { runScheduledDrakeUpdate } from "./run-drake-update.server";
import { getDrakeSchedulerConfig } from "./scheduler-config.server";
import {
  DRAKE_SCHEDULE_ALREADY_CLAIMED,
  DRAKE_UPDATE_ALREADY_RUNNING,
  type DrakeUpdateTrigger,
} from "./update-types";

type ScheduledTrigger = Extract<DrakeUpdateTrigger, "scheduled-interval">;

type DueSchedule = {
  key: string;
  scheduledFor: string;
  trigger: ScheduledTrigger;
};

const GLOBAL_KEY = "__drakeLovableSchedulerState" as const;

type GlobalSchedulerState = {
  attemptedSlots: Set<string>;
};

function getGlobalState(): GlobalSchedulerState {
  const global = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: GlobalSchedulerState;
  };
  if (!global[GLOBAL_KEY]) global[GLOBAL_KEY] = { attemptedSlots: new Set() };
  return global[GLOBAL_KEY];
}

/** Retorna a janela periódica que contém o instante informado. */
export function getDueDrakeSchedule(
  now = new Date(),
  intervalMinutes = getDrakeSchedulerConfig().intervalMinutes,
): DueSchedule {
  const intervalMs = intervalMinutes * 60_000;
  const slot = Math.floor(now.getTime() / intervalMs);
  const scheduledFor = new Date(slot * intervalMs).toISOString();
  return {
    key: `drake:${intervalMinutes}:${slot}`,
    scheduledFor,
    trigger: "scheduled-interval",
  };
}

async function safeRunScheduled(schedule: DueSchedule): Promise<void> {
  try {
    await runScheduledDrakeUpdate(schedule.trigger, {
      scheduleSlot: {
        key: schedule.key,
        scheduledFor: schedule.scheduledFor,
      },
    });
  } catch (error: unknown) {
    const code =
      error instanceof DrakeIntegrationError
        ? error.code
        : error instanceof Error && "code" in error
          ? String((error as Error & { code?: string }).code ?? "")
          : "";
    if (code === DRAKE_UPDATE_ALREADY_RUNNING) {
      logger.info("drake-scheduler", "Execucao automatica ignorada", {
        trigger: schedule.trigger,
        reason: "update-already-running",
      });
      return;
    }
    if (code === DRAKE_SCHEDULE_ALREADY_CLAIMED) {
      logger.info("drake-scheduler", "Janela automatica ja processada por outra instancia", {
        trigger: schedule.trigger,
        scheduleKey: schedule.key,
      });
      return;
    }
    logger.error("drake-scheduler", "Falha isolada na execucao automatica", {
      trigger: schedule.trigger,
      errorCode: code || "UNKNOWN",
      sanitizedMessage:
        error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
  }
}

/**
 * Scheduler oportunista do runtime Lovable. A primeira requisicao depois de cada
 * janela dispara a atualizacao em background, sem processo residente ou servico extra.
 */
export async function runDueDrakeSchedule(now = new Date()): Promise<boolean> {
  const config = getDrakeSchedulerConfig();
  if (!config.enabled) return false;

  const due = getDueDrakeSchedule(now, config.intervalMinutes);
  const state = getGlobalState();
  if (state.attemptedSlots.has(due.key)) return false;
  state.attemptedSlots.add(due.key);

  while (state.attemptedSlots.size > 4) {
    const oldest = state.attemptedSlots.values().next().value as string | undefined;
    if (!oldest) break;
    state.attemptedSlots.delete(oldest);
  }

  logger.info("drake-scheduler", "Janela automatica iniciada pelo Lovable", {
    trigger: due.trigger,
    intervalMinutes: config.intervalMinutes,
    scheduledFor: due.scheduledFor,
    timezone: config.timezone,
  });
  await safeRunScheduled(due);
  return true;
}

export type DrakeCronOutcome =
  | { status: "disabled" }
  | { status: "success"; scheduleKey: string; created?: number; updated?: number }
  | { status: "skipped"; scheduleKey: string; reason: "update-already-running" | "slot-already-claimed" }
  | { status: "error"; scheduleKey: string; message: string };

/**
 * Chamado pelo pg_cron (rota /api/integrations/drake/cron — pedido dela, 2026-11-12), para a
 * sincronização não depender de alguém abrir o site. ADITIVO: usa a MESMA janela, a mesma trava
 * e a mesma reserva no banco (drake_scheduler_slots) de runDueDrakeSchedule — se a visita ao
 * site já processou a janela, o cron só pula, e vice-versa. Diferente de runDueDrakeSchedule,
 * espera terminar e devolve o resultado (a requisição do cron fica aberta durante a execução).
 */
export async function runDrakeScheduleFromCron(now = new Date()): Promise<DrakeCronOutcome> {
  const config = getDrakeSchedulerConfig();
  if (!config.enabled) return { status: "disabled" };

  const due = getDueDrakeSchedule(now, config.intervalMinutes);
  // Marca a janela nesta instância para a visita ao site não tentar de novo em paralelo.
  getGlobalState().attemptedSlots.add(due.key);

  logger.info("drake-scheduler", "Janela automatica iniciada pelo cron", {
    trigger: due.trigger,
    scheduledFor: due.scheduledFor,
  });
  try {
    const { result } = await runScheduledDrakeUpdate(due.trigger, {
      scheduleSlot: { key: due.key, scheduledFor: due.scheduledFor },
    });
    return {
      status: "success",
      scheduleKey: due.key,
      created: result.created,
      updated: result.updated,
    };
  } catch (error: unknown) {
    const code =
      error instanceof DrakeIntegrationError
        ? error.code
        : error instanceof Error && "code" in error
          ? String((error as Error & { code?: string }).code ?? "")
          : "";
    if (code === DRAKE_UPDATE_ALREADY_RUNNING)
      return { status: "skipped", scheduleKey: due.key, reason: "update-already-running" };
    if (code === DRAKE_SCHEDULE_ALREADY_CLAIMED)
      return { status: "skipped", scheduleKey: due.key, reason: "slot-already-claimed" };
    const message =
      error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
    logger.error("drake-scheduler", "Falha na execucao automatica pelo cron", {
      errorCode: code || "UNKNOWN",
      sanitizedMessage: message,
    });
    return { status: "error", scheduleKey: due.key, message };
  }
}

/** Apenas para testes. */
export function __resetDrakeSchedulerForTests(): void {
  getGlobalState().attemptedSlots.clear();
}
