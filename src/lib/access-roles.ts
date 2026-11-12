/** Capability checks only: preserve the stored role for identity and email recipients. */
export const SYSTEM_ADMIN_ROLES = ["administrador", "diretoria"] as const;
export const OPERATOR_ROLES = ["logistics_operator", ...SYSTEM_ADMIN_ROLES] as const;
export const FULL_NOMINATIONS_ACCESS_ROLES = [...OPERATOR_ROLES, "adm_master"] as const;

export function hasSystemAdminAccess(role: string | null | undefined): boolean {
  return SYSTEM_ADMIN_ROLES.some((allowed) => allowed === role);
}

export function hasOperatorAccess(role: string | null | undefined): boolean {
  return OPERATOR_ROLES.some((allowed) => allowed === role);
}

/**
 * M.O — Mão de Obra Planejada. Desde 2026-11-12 quem vê e edita é a lista mo_editores do banco
 * (is_mo_editor / RPC mo_pode_editar — ver useMoPodeEditar); esta regra por papel (qualquer ADM)
 * só vale enquanto o SQL 20261112000000_mo_depara_editores.sql não foi aplicado.
 */
export function canEditMoPlanejamento(role: string | null | undefined): boolean {
  return hasSystemAdminAccess(role);
}
