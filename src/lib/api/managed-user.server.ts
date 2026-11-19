import "@tanstack/react-start/server-only";
import type { Database } from "@/integrations/supabase/types";

/** Only call after verifying operator access or consuming an authorized Intranet ticket. */
export async function createManagedUser(data: {
  email: string;
  password?: string;
  fullName: string;
  role: Database["mysteptime"]["Enums"]["app_role"];
  perfil?: string;
  mustChangePassword?: boolean;
  stepOneUserId?: string;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    ...(data.password !== undefined ? { password: data.password } : {}),
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName,
      ...(data.stepOneUserId ? { step_one_user_id: data.stepOneUserId } : {}),
    },
  });
  if (error) throw new Error(error.message);
  const userId = created.user?.id;
  if (!userId) throw new Error("Falha ao criar usuário.");

  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      must_change_password: data.mustChangePassword ?? Boolean(data.password),
      perfil: data.perfil || null,
    }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: data.role,
    }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleError) throw new Error(roleError.message);
  } catch (error) {
    // Do not leave a partially provisioned account that blocks the next attempt.
    const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (cleanupError) {
      throw new Error("Cadastro incompleto; não repita a criação antes de verificar a conta em Configurações.");
    }
    throw error;
  }
  return userId;
}
