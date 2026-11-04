// Entrada direta pelo Intranet STEP One (card Mysteptime), sem tela de login e sem senha.
// Chamada só pelo servidor do Intranet (/api/auth/mysteptime-launch) com um ticket de uso único
// (64 hex, 60 s, audience "mysteptime"), consumido de forma atômica pela RPC
// public.mysteptime_bridge_consume no banco do Intranet — sem segredo compartilhado.
// Devolve o link de login (magic link) da conta que JÁ existe aqui; o navegador segue o link e o
// cliente do app (detectSessionInUrl) assume a sessão. Não cria usuário, não muda papel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTRANET_SUPABASE_URL = "https://qxmxtbjxkhecqilpnhgq.supabase.co";
const INTRANET_PUBLISHABLE_KEY = "sb_publishable_TiGdrzZ6H7TCjQ8wPaAkzA_cQxVxdvr";
const APP_URL = "https://mysteptime.lovable.app/";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

type BridgeIdentity = { step_one_user_id?: string; name?: string; email?: string };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => null) as { ticket?: unknown } | null;
  const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";
  if (!/^[0-9a-f]{64}$/.test(ticket)) return reply({ ok: false, error: "invalid_ticket" }, 401);

  let identity: BridgeIdentity | null = null;
  try {
    const consumed = await fetch(`${INTRANET_SUPABASE_URL}/rest/v1/rpc/mysteptime_bridge_consume`, {
      method: "POST",
      headers: {
        apikey: INTRANET_PUBLISHABLE_KEY,
        Authorization: `Bearer ${INTRANET_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ticket: ticket }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!consumed.ok) return reply({ ok: false, error: "intranet_unavailable" }, 503);
    identity = await consumed.json() as BridgeIdentity | null;
  } catch {
    return reply({ ok: false, error: "intranet_unavailable" }, 503);
  }
  const email = (identity?.email || "").trim().toLowerCase();
  if (!identity?.step_one_user_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply({ ok: false, error: "invalid_ticket" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let matched: { id: string; banned_until?: string | null } | null = null;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return reply({ ok: false, error: "directory_unavailable" }, 503);
      const users = data.users ?? [];
      matched = users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;
      if (matched || users.length < 1000) break;
    }
    if (!matched) return reply({ ok: false, status: "not_linked", error: "Seu usuário ainda não tem conta no Mysteptime. Procure a administração." }, 403);
    if (matched.banned_until && new Date(matched.banned_until).getTime() > Date.now()) {
      return reply({ ok: false, status: "blocked", error: "Sua conta do Mysteptime está bloqueada." }, 403);
    }
    const { data: role, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", matched.id).maybeSingle();
    if (roleError || !role?.role || role.role === "pending") {
      return reply({ ok: false, status: "pending", error: "Seu acesso ao Mysteptime ainda não foi aprovado." }, 403);
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: APP_URL },
    });
    // generateLink pode criar conta: só aceita se for exatamente a conta encontrada acima.
    if (linkError || !link?.properties?.action_link || link.user?.id !== matched.id) {
      return reply({ ok: false, error: "link_failed" }, 502);
    }
    return reply({ ok: true, redirect: link.properties.action_link });
  } catch (error) {
    console.error("[intranet-bridge]", error instanceof Error ? error.name : "unknown");
    return reply({ ok: false, error: "unexpected" }, 500);
  }
});
