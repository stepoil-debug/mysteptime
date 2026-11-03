import { computeRevertClearing, type NominationStatus } from "./nominations";

export function validateReturnReason(reason: string | null | undefined): string | null {
  return reason?.trim() ? null : "Descreva o motivo da devolução e o que precisa ser corrigido.";
}

export function requireReturnReason(from: NominationStatus, to: NominationStatus, reason?: string): void {
  if (!computeRevertClearing(from, to)) return;
  const error = validateReturnReason(reason);
  if (error) throw new Error(error);
}