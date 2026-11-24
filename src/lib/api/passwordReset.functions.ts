import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// "Esqueci minha senha" pela caixa noreply (Power Automate), sem o SMTP padrão do Supabase.
// Resposta sempre igual, exista ou não a conta (não revela quais e-mails têm acesso).
// O link leva o token_hash; o token só é consumido quando a pessoa grava a nova senha,
// então antivírus/visualizadores de e-mail que abrem o link não queimam o acesso.
const APP_URL = (process.env.APP_PUBLIC_URL || "https://intranet.step-og.com/mysteptime").replace(/\/+$/, "");
const recent = new Map<string, number>();
const COOLDOWN_MS = 60_000;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().trim().toLowerCase().email().max(255) }))
  .handler(async ({ data }) => {
    const ok = { ok: true as const };
    const now = Date.now();
    if ((recent.get(data.email) ?? 0) > now - COOLDOWN_MS) return ok;
    recent.set(data.email, now);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendMailFlow, mailFlowConfigured } = await import("../mail-flow.server");
      if (!mailFlowConfigured()) {
        console.warn("[MYSTEPTIME RESET] M365_FLOW_URL ausente");
        return ok;
      }
      let user: { id: string; email?: string; banned_until?: string | null; user_metadata?: Record<string, unknown> } | null = null;
      for (let page = 1; page <= 20; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        user = (list.users ?? []).find((u) => u.email?.trim().toLowerCase() === data.email) ?? null;
        if (user || (list.users ?? []).length < 1000) break;
      }
      if (!user) return ok;
      if (user.banned_until && new Date(user.banned_until).getTime() > now) return ok;

      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: data.email });
      if (error || !link.properties?.hashed_token || link.user?.id !== user.id) throw error ?? new Error("link");
      const url = `${APP_URL}/redefinir-senha?token=${encodeURIComponent(link.properties.hashed_token)}`;
      const nome = String(user.user_metadata?.full_name || "").trim();
      await sendMailFlow({
        to: data.email,
        subject: "Mysteptime - redefinição de senha",
        text: `Olá${nome ? `, ${nome}` : ""}.\n\nPara definir uma nova senha do Mysteptime, acesse:\n${url}\n\nO link vale por 1 hora e só pode ser usado uma vez.\nSe você não pediu, ignore este e-mail.`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">
<p>Olá${nome ? `, ${escapeHtml(nome)}` : ""}.</p>
<p>Para definir uma nova senha do Mysteptime, clique no botão abaixo:</p>
<p><a href="${url}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Definir nova senha</a></p>
<p style="color:#64748b">O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu, ignore este e-mail.</p>
</div>`,
      });
    } catch (e) {
      console.warn("[MYSTEPTIME RESET] falha ao enviar", e instanceof Error ? e.message : "unknown");
    }
    return ok;
  });
