import { describe, expect, it } from "vitest";
import { dpReturnRequest } from "./nomination-dp-return";

describe("devolução parcial do DP", () => {
  it("devolve apenas a função e o colaborador escolhidos", () => {
    expect(dpReturnRequest("pintor", "thiago", "Não possui irata")).toEqual({
      p_id: "pintor", p_nominee_id: "thiago", p_reason: "Não possui irata", p_restore: false,
    });
  });
  it("não devolve sem motivo", () => {
    expect(() => dpReturnRequest("pintor", "thiago", "  ")).toThrow();
  });
  it("não devolve sem colaborador", () => {
    expect(() => dpReturnRequest("pintor", "", "Corrigir documentação")).toThrow();
  });
});