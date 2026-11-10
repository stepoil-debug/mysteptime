import { describe, expect, it } from "vitest";
import {
  classificarStatusPlanejamento as c,
  statusPlanejamentoOcupado,
} from "./dashboard-status-planejamento";

describe("classificarStatusPlanejamento", () => {
  it("Ocupação: Embarcado, Programado, Folga e Trabalho Externo", () => {
    expect(c("EMBARCADO")).toBe("embarcado");
    expect(c(" programado ")).toBe("programado");
    expect(c("Folga")).toBe("folga");
    expect(c("TRABALHO EXTERNO")).toBe("trabalhoExterno");
    expect(
      ["EMBARCADO", "PROGRAMADO", "FOLGA", "Trabalho externo"].every(statusPlanejamentoOcupado),
    ).toBe(true);
  });

  it("Fora da Ocupação: Disponível = Stand By, Indisponível próprio, Terceirizado = Outros", () => {
    expect(c("DISPONÍVEL")).toBe("standBy");
    expect(c("Disponivel")).toBe("standBy");
    expect(c("INDISPONÍVEL")).toBe("indisponivel");
    expect(c("TERCEIRIZADO")).toBe("outros");
    expect(c("")).toBe("outros");
    expect(c("Férias")).toBe("ferias");
    expect(statusPlanejamentoOcupado("DISPONÍVEL")).toBe(false);
    expect(statusPlanejamentoOcupado("INDISPONÍVEL")).toBe(false);
  });

  it("Bloqueados Henrique: Base Henrique e Bloqueio - Base - Henrique", () => {
    expect(c("BASE HENRIQUE")).toBe("baseHenrique");
    expect(c("BASE - HENRIQUE")).toBe("baseHenrique");
    expect(c("BLOQUEIO - BASE - HENRIQUE")).toBe("bloqueioBaseHenrique");
    expect(c("Bloqueio Base Henrique")).toBe("bloqueioBaseHenrique");
    expect(statusPlanejamentoOcupado("BASE HENRIQUE")).toBe(false);
  });

  it("mantém Na Base, outros Base - Fulano e Bloqueio RH", () => {
    expect(c("NA BASE")).toBe("naBase");
    expect(c("BASE - MARCOS")).toBe("bloqueioTemporario");
    expect(c("BLOQUEIO RH")).toBe("bloqueioRH");
    expect(c("EMBARCADO", true)).toBe("embarcado");
    expect(c("TERCEIRIZADO", true)).toBe("bloqueioRH");
  });
});
