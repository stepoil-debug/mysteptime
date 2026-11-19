import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const appRole = z.enum(["pending", "collaborator", "logistics_operator", "pm", "visitante"]);

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(72),
      full_name: z.string().trim().min(1).max(120),
      role: appRole,
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: isOperator, error: roleError } = await context.supabase.rpc("is_operator", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isOperator) throw new Error("Apenas operadores logísticos podem criar usuários.");

    const { createManagedUser } = await import("./managed-user.server");
    const id = await createManagedUser({
      email: data.email,
      password: data.password,
      fullName: data.full_name,
      role: data.role,
      mustChangePassword: false,
    });
    return { id };
  });
