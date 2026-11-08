import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasOperatorAccess } from "@/lib/access-roles";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Você é um especialista em entrega de e-mails transacionais do app "My Step Time" (logística de pessoal, STEP).
Contexto: os avisos saem pelo Resend (remetente notificacoes@step-og.com). Tipos: boas-vindas de novos usuários (com senha provisória) e alertas de mudança de etapa em Nomeações (destinatário = responsável da etapa, cópia para Logística).
Causas comuns: chave do Resend inválida/sem permissão, domínio não verificado, remetente fora do domínio, destinatário digitado errado, e-mail no lixo eletrônico/quarentena, app publicado sem a versão atual, limite de envio (429), bloqueio do servidor do destinatário.
Responda em português simples, para uma pessoa não técnica, neste formato:
**Causa provável:** ...
**Como corrigir:** passos numerados curtos.
**Como confirmar:** uma frase.
Se faltar informação, diga o que a pessoa deve verificar ou copiar.`;

export const diagnoseEmailAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ details: z.string().trim().min(5).max(8000) }))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    // Cast pra string: "administrador" ainda não está no types.ts gerado (não é regerado
    // automaticamente neste projeto — mesmo caso já visto com "medicao"/"diretoria").
    const roleAtual = roleRow?.role as string | undefined;
    if (!hasOperatorAccess(roleAtual)) throw new Error("Sem permissão.");

    // IA própria (API da Anthropic) no lugar do gateway do Lovable. Chave: ANTHROPIC_API_KEY na Vercel.
    if (!process.env["ANTHROPIC_API_KEY"]) throw new Error("Serviço de IA não configurado.");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    let text = "";
    try {
      const response = await client.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: data.details }],
      });
      if (response.stop_reason === "refusal") throw new Error("A análise foi recusada. Revise o texto enviado.");
      for (const block of response.content) if (block.type === "text") text += block.text;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new Error("Muitas análises em pouco tempo. Tente de novo em instantes.");
      if (e instanceof Anthropic.APIError) throw new Error(`Falha na análise (${e.status ?? "rede"}).`);
      throw e;
    }
    return { answer: text.trim() || "Não foi possível gerar um diagnóstico. Inclua mais detalhes do erro." };
  });
