import { describe, expect, it } from "vitest";
import { disponivelNoDia, moDisponivelPorDia, type LinhaDisponibilidade } from "./mo-disponivel";

const hoje = "2026-11-10";
const p = (x: Partial<LinhaDisponibilidade>): LinhaDisponibilidade => ({
  nome: "A",
  funcao: "CALDEIREIRO",
  status: "DISPONÍVEL",
  embarque: null,
  desembarque: null,
  duracao_embarque_dias: null,
  folga_inicio: null,
  folga_fim: null,
  ferias_inicio: null,
  ferias_fim: null,
  programado_1: null,
  ...x,
});

describe("disponivelNoDia", () => {
  it("Disponível sem datas fica disponível em todos os dias", () => {
    expect(disponivelNoDia(p({}), hoje, hoje)).toBe(true);
    expect(disponivelNoDia(p({}), "2026-11-20", hoje)).toBe(true);
  });

  it("embarque marcado tira dos dias do embarque", () => {
    const r = p({ embarque: "2026-11-12", desembarque: "2026-11-15" });
    expect(disponivelNoDia(r, "2026-11-11", hoje)).toBe(true);
    expect(disponivelNoDia(r, "2026-11-12", hoje)).toBe(false);
    expect(disponivelNoDia(r, "2026-11-15", hoje)).toBe(false);
    expect(disponivelNoDia(r, "2026-11-16", hoje)).toBe(true);
  });

  it("Embarcado volta a ficar disponível depois do fim da folga", () => {
    const r = p({
      status: "EMBARCADO",
      embarque: "2026-11-01",
      desembarque: "2026-11-14",
      folga_inicio: "2026-11-14",
      folga_fim: "2026-11-20",
    });
    expect(disponivelNoDia(r, hoje, hoje)).toBe(false);
    expect(disponivelNoDia(r, "2026-11-20", hoje)).toBe(false);
    expect(disponivelNoDia(r, "2026-11-21", hoje)).toBe(true);
  });

  it("Embarcado sem datas fica indisponível nos 14 dias", () => {
    expect(disponivelNoDia(p({ status: "EMBARCADO" }), "2026-11-23", hoje)).toBe(false);
  });

  it("Programado 1 com duração", () => {
    const r = p({ programado_1: "2026-11-13", duracao_embarque_dias: 3 });
    expect(disponivelNoDia(r, "2026-11-12", hoje)).toBe(true);
    expect(disponivelNoDia(r, "2026-11-14", hoje)).toBe(false);
    expect(disponivelNoDia(r, "2026-11-17", hoje)).toBe(true);
  });

  it("Bloqueados, Indisponível e Terceirizado nunca ficam disponíveis", () => {
    for (const status of [
      "BASE HENRIQUE",
      "BLOQUEIO - BASE - HENRIQUE",
      "INDISPONÍVEL",
      "TERCEIRIZADO",
    ]) {
      expect(disponivelNoDia(p({ status }), "2026-11-20", hoje)).toBe(false);
    }
  });
});

describe("moDisponivelPorDia", () => {
  it("agrupa por função, tira Terceirizado e zera quem não está disponível", () => {
    const r = moDisponivelPorDia(
      [
        p({ nome: "B" }),
        p({ nome: "C", embarque: "2026-11-10", desembarque: "2026-11-11" }),
        p({ nome: "D", funcao: "SOLDADOR", status: "INDISPONÍVEL" }),
        p({ nome: "E", funcao: "RIGGER", status: "TERCEIRIZADO" }),
      ],
      hoje,
      3,
    );
    expect(r.dias).toEqual(["2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(r.funcoes.map((f) => f.funcao)).toEqual(["CALDEIREIRO", "SOLDADOR"]);
    expect(r.funcoes[0].porDia.map((d) => d.qtd)).toEqual([1, 1, 2]);
    expect(r.funcoes[0].porDia[2].nomes).toEqual(["B", "C"]);
    expect(r.funcoes[1].porDia.map((d) => d.qtd)).toEqual([0, 0, 0]);
  });
});
