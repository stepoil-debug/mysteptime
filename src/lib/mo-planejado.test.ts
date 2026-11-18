import { describe, expect, it } from "vitest";
import {
  calcularMeses,
  calcularSemanas,
  headcountDiario,
  janelaGraficos,
  rotuloSemana,
  type MoLinha,
} from "./mo-planejado";

const linha = (p: Partial<MoLinha>): MoLinha => ({
  qtd: 1,
  funcao: "FITTER",
  bsp: "25-1032",
  data_embarque: "2026-11-02",
  data_desembarque: "2026-11-02",
  ...p,
});

describe("headcountDiario", () => {
  it("(a) ON HOLD não soma e qtd 0 é ignorada; ENCERRADA conta", () => {
    const r = headcountDiario(
      [linha({ bsp: " on hold " }), linha({ qtd: 0 }), linha({ bsp: "ENCERRADA", qtd: 2 })],
      "2026-11-01",
      "2026-11-30",
    );
    expect(r).toEqual([{ dia: "2026-11-02", funcao: "FITTER", qtd_total: 2 }]);
  });

  it("(b) embarque e desembarque no mesmo dia conta 1 dia", () => {
    const r = headcountDiario([linha({ qtd: 3 })], "2026-11-01", "2026-11-30");
    expect(r).toHaveLength(1);
    expect(r[0].qtd_total).toBe(3);
  });

  it("recorta a janela e soma linhas da mesma função", () => {
    const r = headcountDiario(
      [
        linha({ data_embarque: "2026-10-30", data_desembarque: "2026-11-02" }),
        linha({ qtd: 2, data_embarque: "2026-11-02", data_desembarque: "2026-11-03" }),
      ],
      "2026-11-01",
      "2026-11-02",
    );
    expect(r).toEqual([
      { dia: "2026-11-01", funcao: "FITTER", qtd_total: 1 },
      { dia: "2026-11-02", funcao: "FITTER", qtd_total: 3 },
    ]);
  });
});

describe("calcularSemanas", () => {
  // Hoje 2026-11-09 (segunda): hoje − 7 = 2026-11-02, semana de domingo 2026-11-01.
  const hoje = "2026-11-09";

  it("começa na semana que contém hoje − 7 dias e gera 17 semanas", () => {
    const s = calcularSemanas([], hoje);
    expect(s).toHaveLength(17);
    expect(s[0].inicio).toBe("2026-11-01");
    expect(s[0].fim).toBe("2026-11-07");
    expect(s[16].inicio).toBe("2027-02-21");
  });

  it("(c) arredonda por função antes de somar (0,5 + 0,5 = 1 + 1)", () => {
    // 3,5 dias de cada função na semana → média 0,5 cada.
    const diario = ["2026-11-01", "2026-11-02", "2026-11-03"]
      .flatMap((dia) => [
        { dia, funcao: "A", qtd_total: 1 },
        { dia, funcao: "B", qtd_total: 1 },
      ])
      .concat([
        { dia: "2026-11-04", funcao: "A", qtd_total: 0.5 },
        { dia: "2026-11-04", funcao: "B", qtd_total: 0.5 },
      ]);
    const s = calcularSemanas(diario, hoje);
    expect(s[0].porFuncao).toEqual([
      { funcao: "A", qtd: 1 },
      { funcao: "B", qtd: 1 },
    ]);
    expect(s[0].total).toBe(2);
  });

  it("média abaixo de meio não aparece na semana", () => {
    const s = calcularSemanas([{ dia: "2026-11-01", funcao: "A", qtd_total: 3 }], hoje);
    expect(s[0].total).toBe(0);
  });
});

describe("rotuloSemana", () => {
  it("(d) semana que contém 1º de janeiro vira 1 do ano novo", () => {
    expect(rotuloSemana("2026-12-20")).toBe("52/2026");
    expect(rotuloSemana("2026-12-27")).toBe("1/2027");
    expect(rotuloSemana("2027-01-03")).toBe("2/2027");
  });

  it("bate com o WEEKNUM do Excel no meio do ano", () => {
    // WEEKNUM(01/11/2026;1) = 45 (domingo).
    expect(rotuloSemana("2026-11-01")).toBe("45/2026");
  });
});

describe("calcularMeses", () => {
  it("(e) média mensal divide pelos dias corridos, incluindo dias com zero", () => {
    const diario = [
      { dia: "2026-11-01", funcao: "A", qtd_total: 30 },
      { dia: "2026-11-02", funcao: "B", qtd_total: 30 },
    ];
    const m = calcularMeses(diario, "2026-11-09");
    expect(m).toHaveLength(8);
    expect(m[0]).toEqual({ mes: "2026-11", rotulo: "11/2026", somaDias: 60, media: 2 });
    expect(m[2].rotulo).toBe("1/2027");
    expect(m[7].rotulo).toBe("6/2027");
  });
});

describe("janelaGraficos", () => {
  it("cobre as 17 semanas e os 8 meses", () => {
    expect(janelaGraficos("2026-11-09")).toEqual({ inicio: "2026-11-01", fim: "2027-06-30" });
  });
});
