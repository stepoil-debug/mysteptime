import { describe, expect, it } from "vitest";
import { aplicarAjusteDisponivel } from "./mo-disponivel";

describe("aplicarAjusteDisponivel", () => {
  const dias = ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"];
  const hoje = "2026-11-26";
  const base = new Map([
    [
      "FITTER",
      {
        funcao: "FITTER",
        total: 10,
        porDia: new Map<string, number | null>([
          ["2026-11-25", null],
          ["2026-11-26", 7],
          ["2026-11-27", 6],
          ["2026-11-28", 5],
        ]),
      },
    ],
  ]);

  it("sem ajustes devolve o calculado", () => {
    expect(aplicarAjusteDisponivel(base, [], dias, hoje)).toBe(base);
  });

  it("ajuste vale do dia a_partir em diante e não mexe no passado", () => {
    const out = aplicarAjusteDisponivel(
      base,
      [
        { funcao: "Fitter", a_partir: "2026-11-26", qtd: 20 },
        { funcao: "FITTER", a_partir: "2026-11-28", qtd: 3 },
      ],
      dias,
      hoje,
    );
    const p = out.get("FITTER")!.porDia;
    expect(p.get("2026-11-25")).toBeNull();
    expect(p.get("2026-11-26")).toBe(20);
    expect(p.get("2026-11-27")).toBe(20);
    expect(p.get("2026-11-28")).toBe(3);
    expect(base.get("FITTER")!.porDia.get("2026-11-26")).toBe(7);
  });

  it("cria a função quando não existe no calculado", () => {
    const out = aplicarAjusteDisponivel(
      base,
      [{ funcao: "Rigger", a_partir: "2026-11-27", qtd: 4 }],
      dias,
      hoje,
    );
    const p = out.get("RIGGER")!.porDia;
    expect(p.get("2026-11-26")).toBe(0);
    expect(p.get("2026-11-27")).toBe(4);
  });
});
