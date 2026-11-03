import { describe, expect, it } from "vitest";
import { requireReturnReason, validateReturnReason } from "./nomination-return";

describe("devolução para atualização", () => {
  it("não permite devolver sem descrever o motivo, incluindo espaços em branco", () => {
    for (const reason of [undefined, "", "  \n  "]) {
      expect(() => requireReturnReason("validacao_rh", "simulacao", reason)).toThrow();
      expect(validateReturnReason(reason)).not.toBeNull();
    }
  });
  it("permite orientação descritiva sobre o que deve ser corrigido", () => {
    const reason = "Atualizar o documento e corrigir a data de embarque";
    expect(() => requireReturnReason("validacao_qualidade", "simulacao", reason)).not.toThrow();
    expect(validateReturnReason(reason)).toBeNull();
  });
  it("não exige motivo de devolução em avanços normais", () => {
    expect(() => requireReturnReason("simulacao", "aprovacao_tecnica")).not.toThrow();
  });
});