import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function scheduleDrakeUpdateForRequest(ctx: unknown): void {
  const task = import("./lib/drake/drake-scheduler.server")
    .then((module) => module.runDueDrakeSchedule())
    .then(() => undefined)
    .catch(() => undefined);
  const execution = ctx as { waitUntil?: (promise: Promise<unknown>) => void } | null;
  if (typeof execution?.waitUntil === "function") execution.waitUntil(task);
  else void task;
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Disparo da sincronização do Drake "por visita" DESLIGADO (2026-11-18): no Lovable ele
    // reservava a janela da hora (drake_scheduler_slots) e era interrompido no meio — as janelas
    // ficavam "running" para sempre, sem sincronizar, e ainda bloqueavam o cron (que usa a mesma
    // janela). Agora quem sincroniza é só o cron (/api/integrations/drake/cron, a cada 2 h) e o
    // botão "Atualizar dados do Drake". Para religar: DRAKE_SCHEDULER_POR_VISITA=true.
    if (
      (process.env.DRAKE_SCHEDULER_POR_VISITA ?? "").trim().toLowerCase() === "true" &&
      !new URL(request.url).pathname.startsWith("/api/integrations/drake/cron")
    ) {
      scheduleDrakeUpdateForRequest(ctx);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
