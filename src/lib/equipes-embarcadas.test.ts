import { describe, expect, it } from "vitest";
import { equipeNaData, equipesPorUnidade, type LinhaEquipe } from "./equipes-embarcadas";

const hoje = "2026-11-11";
const l = (x: Partial<LinhaEquipe>): LinhaEquipe => ({
  id: x.nome ?? "x",
  nome: "A",
  status: "EMBARCADO",
  unidade: "ILHA BELA",
  bsp: "25-481",
  embarque: null,
  ...x,
});

describe("equipeNaData", () => {
  it("Embarcado com unidade + Programado com embarque hoje; FOLGA e sem unidade fora", () => {
    const itens = equipeNaData(
      [
        l({ nome: "E1" }),
        l({ nome: "P-hoje", status: "PROGRAMADO", embarque: hoje }),
        l({ nome: "P-amanha", status: "PROGRAMADO", embarque: "2026-11-12" }),
        l({ nome: "Folga", unidade: "FOLGA" }),
        l({ nome: "SemUnidade", unidade: null }),
        l({ nome: "Disp", status: "DISPONIVEL" }),
      ],
      hoje,
    );
    expect(itens.map((i) => `${i.row.nome}:${i.tipo}`)).toEqual([
      "E1:embarcado",
      "P-hoje:programado",
    ]);
  });
});

describe("equipesPorUnidade", () => {
  it("soma por unidade e por BSP, maior primeiro", () => {
    const r = equipesPorUnidade(
      equipeNaData(
        [
          l({ nome: "a" }),
          l({ nome: "b", bsp: "26-1061" }),
          l({ nome: "c", status: "PROGRAMADO", embarque: hoje }),
          l({ nome: "d", unidade: "P-79", bsp: null }),
        ],
        hoje,
      ),
    );
    expect(r.map((u) => [u.unidade, u.embarcados, u.programados, u.total])).toEqual([
      ["ILHA BELA", 2, 1, 3],
      ["P-79", 1, 0, 1],
    ]);
    expect(r[0].porBsp).toEqual([
      { bsp: "25-481", total: 2 },
      { bsp: "26-1061", total: 1 },
    ]);
    expect(r[1].porBsp).toEqual([{ bsp: "BSP não informado", total: 1 }]);
  });
});
