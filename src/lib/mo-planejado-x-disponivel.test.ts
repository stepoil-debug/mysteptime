import { describe, expect, it } from "vitest";
import { headcountDiario } from "./mo-planejado";
import {
  composicaoEfetivo,
  disponivelPorFuncaoNosDias,
  type LinhaDisponibilidade,
} from "./mo-disponivel";
import {
  agruparPlanejado,
  corPlanejadoDisponivel,
  diaDaSemana,
  mediaDisponivelSemana,
  mediaSemana,
  semanasAPartirDe,
} from "./mo-planejado-x-disponivel";

describe("corPlanejadoDisponivel", () => {
  it("cinza sem demanda; verde < ; amarelo = ; vermelho >", () => {
    expect(corPlanejadoDisponivel(0, 5)).toBe("vazio");
    expect(corPlanejadoDisponivel(null, 5)).toBe("vazio");
    expect(corPlanejadoDisponivel(2, 5)).toBe("atende");
    expect(corPlanejadoDisponivel(5, 5)).toBe("limite");
    expect(corPlanejadoDisponivel(6, 5)).toBe("falta");
    expect(corPlanejadoDisponivel(1, null)).toBe("falta");
  });
});

describe("teste de aceite (pedido dela)", () => {
  const linhas = [
    {
      qtd: 2,
      funcao: "FITTER",
      bsp: "25-687",
      data_embarque: "2026-12-01",
      data_desembarque: "2026-12-05",
    },
    {
      qtd: 1,
      funcao: "FITTER",
      bsp: " on hold ",
      data_embarque: "2026-12-03",
      data_desembarque: "2026-12-03",
    },
    {
      qtd: 1,
      funcao: "FITTER",
      bsp: "ENCERRADA",
      data_embarque: "2026-12-05",
      data_desembarque: "2026-12-10",
    },
  ];
  // Mesma regra da RPC mo_planejado_drake_diario (headcountDiario = espelho em TS).
  const rpc = headcountDiario(linhas, "2026-11-29", "2026-12-12").map((r) => ({
    dia: r.dia,
    funcao: r.funcao,
    sem_correspondencia: false,
    planejado: r.qtd_total,
  }));
  const fitter = agruparPlanejado(rpc).get("FITTER")!;

  it("planejado diário", () => {
    const v = (d: string) => fitter.porDia.get(d) ?? 0;
    expect(["01", "02", "03", "04", "05"].map((d) => v(`2026-12-${d}`))).toEqual([2, 2, 2, 2, 3]);
    expect(["06", "07", "08", "09", "10", "11"].map((d) => v(`2026-12-${d}`))).toEqual([
      1, 1, 1, 1, 1, 0,
    ]);
  });

  it("semana 49/2026 (29/11 a 05/12): média de [0,0,2,2,2,2,3] = 1,57 → 2", () => {
    const [s] = semanasAPartirDe("2026-12-02", 0);
    expect(s.inicio).toBe("2026-11-29");
    expect(s.rotulo).toBe("49/2026");
    expect(mediaSemana(fitter.porDia, s.dias)).toBe(2);
  });
});

describe("semanas e médias", () => {
  it("semana atual (domingo a sábado) + 18 seguintes", () => {
    const s = semanasAPartirDe("2026-11-12");
    expect(s).toHaveLength(19);
    expect(s[0].inicio).toBe("2026-11-08");
    expect(s[0].fim).toBe("2026-11-14");
    expect(diaDaSemana(s[0].inicio)).toBe("DOM");
  });

  it("disponível semanal só com os dias que têm valor", () => {
    const m = new Map<string, number | null>([
      ["a", null],
      ["b", 3],
      ["c", 4],
    ]);
    expect(mediaDisponivelSemana(m, ["a", "b", "c"])).toBe(4); // 3,5 → 4
    expect(mediaDisponivelSemana(new Map([["a", null]]), ["a"])).toBeNull();
  });
});

describe("disponivelPorFuncaoNosDias", () => {
  const base: LinhaDisponibilidade = {
    nome: "A",
    funcao: "Caldeireiro",
    status: "DISPONÍVEL",
    embarque: null,
    desembarque: null,
    duracao_embarque_dias: null,
    folga_inicio: null,
    folga_fim: null,
    ferias_inicio: null,
    ferias_fim: null,
    programado_1: null,
  };
  it("composicaoEfetivo: status que somam no Total M.O e os que ficam fora", () => {
    const c = composicaoEfetivo([
      base,
      { ...base, nome: "B", status: "EMBARCADO" },
      { ...base, nome: "C", status: "Embarcado" },
      { ...base, nome: "D", status: "INDISPONIVEL" },
      { ...base, nome: "E", status: "BASE HENRIQUE" },
    ]);
    expect(c.total).toBe(3);
    expect(c.dentro).toEqual([
      { status: "Embarcado", qtd: 2 },
      { status: "Disponível", qtd: 1 },
    ]);
    expect(c.fora.map((f) => f.status)).toEqual(["Indisponível", "Base Henrique"]);
  });

  it("mesma regra do card; dias passados = null; Bloqueados fora", () => {
    const r = disponivelPorFuncaoNosDias(
      [base, { ...base, nome: "B", status: "Base Henrique" }],
      ["2026-11-11", "2026-11-12"],
      "2026-11-12",
    );
    const c = r.get("CALDEIREIRO")!;
    expect(c.total).toBe(1);
    expect(c.porDia.get("2026-11-11")).toBeNull();
    expect(c.porDia.get("2026-11-12")).toBe(1);
  });
});
