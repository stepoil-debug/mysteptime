import { createFileRoute } from "@tanstack/react-router";

// Sincronização do Drake em horário fixo (pedido dela, 2026-11-12). Chamada só pelo pg_cron
// (migration 20261112010000_schedule_drake_sync.sql), com o header x-cron-secret igual ao
// segredo 'drake_cron_secret' do Vault do banco. A conferência é feita no próprio banco pela
// RPC drake_cron_secret_ok (migration 20261112030000) — assim não depende de configurar secret
// no Lovable. Se CRON_SECRET existir no ambiente do app, ele também vale (conferido aqui mesmo).
// Senha errada ou ausente = 401 e nada acontece. Não muda a sincronização em si: roda a mesma
// janela automática de drake-scheduler.server.ts.

function mesmoSegredo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function segredoValido(recebido: string): Promise<boolean> {
  if (recebido.length < 32) return false;
  const local = (process.env.CRON_SECRET ?? "").trim();
  if (local) return mesmoSegredo(recebido, local);

  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ""
  ).trim();
  if (!url || !key) return false;
  const resp = await fetch(`${url}/rest/v1/rpc/drake_cron_secret_ok`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: recebido }),
  });
  if (!resp.ok) return false;
  return (await resp.json()) === true;
}

export const Route = createFileRoute("/api/integrations/drake/cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const recebido = (request.headers.get("x-cron-secret") ?? "").trim();
        if (!(await segredoValido(recebido).catch(() => false))) {
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
