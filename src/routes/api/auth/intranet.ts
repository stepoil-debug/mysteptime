import { createFileRoute } from "@tanstack/react-router";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const failure = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: NO_STORE });

// Supabase do Intranet STEP One: só a URL e a chave pública (publishable), as mesmas do front do Intranet.
const INTRANET_SUPABASE_URL = "https://qxmxtbjxkhecqilpnhgq.supabase.co";
const INTRANET_PUBLISHABLE_KEY = "sb_publishable_TiGdrzZ6H7TCjQ8wPaAkzA_cQxVxdvr";

/**
 * This route is server-only. It never accepts an email or a user id from the
 * browser; the identity must come from a 60-second, one-use Intranet ticket.
 * A real Supabase Auth session is created for the EXACT existing user.
 */
export const Route = createFileRoute("/api/auth/intranet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const currentOrigin = new URL(request.url).origin;
        const sentOrigin = request.headers.get("origin");
        if (!sentOrigin || sentOrigin !== currentOrigin) return failure(403, "Origem não autorizada.");
        const json = await request.json().catch(() => null) as { ticket?: unknown } | null;
        const ticket = typeof json?.ticket === "string" ? json.ticket.trim() : "";
        if (!/^[0-9a-f]{64}$/.test(ticket)) return failure(400, "Acesso temporário inválido.");

        // O Intranet valida sessão e acesso ao card antes de emitir o ticket (audience "mysteptime",
        // 60 s, uso único). O consumo é atômico na RPC do próprio Intranet: sem segredo compartilhado,
        // e quem só conhece o ticket recebe apenas a identidade de quem o pediu.
        type BridgeIdentity = { step_one_user_id?: string; name?: string; email?: string };
        let identity = null as BridgeIdentity | null;
        try {
          const reply = await fetch(`${INTRANET_SUPABASE_URL}/rest/v1/rpc/mysteptime_bridge_consume`, {
            method: "POST",
            headers: {
              apikey: INTRANET_PUBLISHABLE_KEY,
              Authorization: `Bearer ${INTRANET_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
            body: JSON.stringify({ p_ticket: ticket }),
            signal: AbortSignal.timeout(12_000),
            cache: "no-store",
          });
          if (!reply.ok) return failure(503, "A Intranet não respondeu à validação corporativa.");
          identity = await reply.json() as BridgeIdentity | null;
        } catch {
          return failure(503, "A Intranet não respondeu à validação corporativa.");
        }
        if (!identity) return failure(403, "O acesso temporário da Intranet é inválido ou já expirou.");

        const email = (identity?.email || "").trim().toLowerCase();
        if (!identity?.step_one_user_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return failure(403, "Identidade corporativa inválida.");
        }

        try {
          // Imported lazily to prevent the service-role client from leaking
          // into browser bundles. The admin credential stays server-side.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let matched: { id: string; email?: string; banned_until?: string | null } | null = null;
          for (let page = 1; page <= 20; page++) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) return failure(503, "Diretório do Mysteptime indisponível.");
            matched = (data.users ?? []).find((user) => user.email?.trim().toLowerCase() === email) ?? null;
            if (matched || (data.users ?? []).length < 1000) break;
          }
          if (!matched) return failure(403, "Usuário do Mysteptime ainda não vinculado. Procure a administração.");
          if (matched.banned_until && new Date(matched.banned_until).getTime() > Date.now()) {
            return failure(403, "Conta do Mysteptime bloqueada.");
          }

          const { data: role, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", matched.id)
            .maybeSingle();
          if (roleError || !role?.role || role.role === "pending") {
            return failure(403, "Acesso do Mysteptime ainda não aprovado.");
          }

          // No automatic signup or privilege assignment. Admin.generateLink
          // can create users; matching IDs before and after prevents granting
          // a session to an unexpected newly created account.
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
          });
          if (error || !data.properties?.hashed_token || data.user?.id !== matched.id) {
            return failure(503, "Não foi possível estabelecer uma sessão segura.");
          }
          return Response.json({
            ok: true,
            tokenHash: data.properties.hashed_token,
            email,
          }, { headers: NO_STORE });
        } catch (error) {
          console.error("[MYSTEPTIME INTRANET SSO]", error instanceof Error ? error.name : "unknown");
          return failure(500, "Falha na autenticação integrada.");
        }
      },
    },
  },
});
