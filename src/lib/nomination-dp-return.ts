import { validateReturnReason } from "./nomination-return";

export function dpReturnRequest(nominationId: string, nomineeId: string, reason: string, restore = false) {
  const error = validateReturnReason(reason);
  if (error) throw new Error(error);
  if (!nominationId || !nomineeId) throw new Error("Selecione a função e o colaborador.");
  return { p_id: nominationId, p_nominee_id: nomineeId, p_reason: reason.trim(), p_restore: restore };
}