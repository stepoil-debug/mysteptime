import { createFileRoute } from "@tanstack/react-router";

// Sincronização do Drake em horário fixo (pedido dela, 2026-11-12). Chamada só pelo pg_cron
// (migration 20261112010000_schedule_drake_sync.sql), com o header x-cron-secret igual ao
// secret CRON_SECRET do app (mesmo valor de 'drake_cron_secret' no Vault do banco). Sem o secret
// configurado, a rota recusa tudo — ninguém de fora consegue disparar a sincronização.
// Não muda a sincronização em si: roda a mesma janela automática de drake-scheduler.server.ts.

function mesmoSegredo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/integrations/drake/cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = (process.env.CRON_SECRET ?? "").trim();
        if (!segredo) {
          return Response.json({ message: "CRON_SECRET não configurado." }, { status: 503 });
        }
        const recebido = (request.headers.get("x-cron-secret") ?? "").trim();
        if (!mesmoSegredo(recebido, segredo)) {
          return Response.json({ message: "Não autorizado." }, { status: 401 });
        }
        const { runDrakeScheduleFromCron } = await import("@/lib/drake/drake-scheduler.server");
        const outcome = await runDrakeScheduleFromCron();
        return Response.json(outcome, {
          status: outcome.status === "error" ? 500 : 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
