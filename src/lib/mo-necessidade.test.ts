import { describe, expect, it } from "vitest";
import type { LinhaDisponibilidade } from "./mo-disponivel";
import { necessidadeDaSemana, pessoasPorFuncaoNosDias } from "./mo-necessidade";

const p = (nome: string, status: string, extra: Partial<LinhaDisponibilidade> = {}): LinhaDisponibilidade => ({
  nome,
  funcao: "Soldador",
  status,
  embarque: null,
  desembarque: null,
  duracao_embarque_dias: null,
  folga_inicio: null,
  folga_fim: null,
  ferias_inicio: null,
  ferias_fim: null,
  programado_1: null,
  ...extra,
});

describe("necessidade x back", () => {
  const hoje = "2026-11-29";
  const dias = ["2026-11-29"];

  it("exemplo: preciso 10, tenho 5 a bordo, 3 para back → falta 5 fixos e 7 back", () => {
    const linhas = [
      ...Array.from({ length: 5 }, (_, i) =>
        p(`A${i}`, "Embarcado", { embarque: "2026-11-20", desembarque: "2026-12-03" }),
      ),
      p("D1", "Disponível"),
      p("B1", "Na Base"),
      p("P1", "Programado", { programado_1: "2026-12-10", duracao_embarque_dias: 14 }),
      p("F1", "Folga", { folga_inicio: "2026-11-25", folga_fim: "2026-12-05" }),
      p("I1", "Indisponível"),
    ];
    const pessoas = pessoasPorFuncaoNosDias(linhas, dias, hoje);
    const [r] = necessidadeDaSemana(
      [{ chave: "SOLDADOR", funcao: "SOLDADOR", porDia: new Map([["2026-11-29", 10]]) }],
      pessoas,
      dias,
    );
    expect(r).toMatchObject({
      necessidade: 10,
      apontadas: 5,
      faltaFixos: 5,
      backNecessario: 10,
      cobertura: 3,
      backPendente: 7,
    });
    expect(r.nomesCobertura).toEqual(["B1", "D1", "P1"]);
  });

  it("programado a bordo no dia não cobre back", () => {
    const linhas = [p("P1", "Programado", { programado_1: "2026-11-28", duracao_embarque_dias: 14 })];
    const pessoas = pessoasPorFuncaoNosDias(linhas, dias, hoje);
    expect(pessoas.get("SOLDADOR")!.get("2026-11-29")).toEqual({ apontadas: ["P1"], cobertura: [] });
  });
});
