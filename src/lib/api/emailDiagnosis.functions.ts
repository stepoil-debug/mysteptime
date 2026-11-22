import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasOperatorAccess } from "@/lib/access-roles";
import { diagnoseEmailByRules } from "@/lib/emailDiagnosisRules";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Diagnóstico por regras (src/lib/emailDiagnosisRules.ts), sem IA externa.
    return { answer: diagnoseEmailByRules(data.details).answer };
  });
