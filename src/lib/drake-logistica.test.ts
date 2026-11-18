import { describe, expect, it } from "vitest";
import {
  corrigirStatusPelaLogistica,
  indexarLogistica,
  periodosEmbarcadosLogistica,
  type PernaLogistica,
} from "./drake-logistica";

const perna = (date: string, de: string, para: string, closed = true): PernaLogistica => ({
  date: `${date}T00:00:00`,
  originDescription: de,
  destinationDescription: para,
  closed,
});

describe("periodosEmbarcadosLogistica", () => {
  const hoje = "2026-11-12";
  const janela = "2026-09-13";

  it("caso real (Jean Antonio Gomes): embarques fechados, desembarque não conta", () => {
    const r = periodosEmbarcadosLogistica(
      [
        perna("2026-11-10", "FPSO ESPIRITO SANTO", "BASE"),
        perna("2026-11-01", "BASE", "FPSO ESPIRITO SANTO"),
        perna("2026-10-28", "ALEXANDRE GUSMÃO", "BASE"),
        perna("2026-10-19", "BASE", "ALEXANDRE GUSMÃO"),
        perna("2026-10-18", "BASE", "ALEXANDRE GUSMÃO"), // perna repetida
        perna("2026-10-01", "CDAN - CIDADE ANCHIETA", "BASE"),
        perna("2026-09-17", "BASE", "CDAN - CIDADE ANCHIETA"),
      ],
      hoje,
      janela,
    );
    expect(r).toEqual([
      { dataInicio: "2026-09-17", dataFim: "2026-09-30", unidade: "CDAN - CIDADE ANCHIETA" },
      { dataInicio: "2026-10-18", dataFim: "2026-10-27", unidade: "ALEXANDRE GUSMÃO" },
      { dataInicio: "2026-11-01", dataFim: "2026-11-09", unidade: "FPSO ESPIRITO SANTO" },
    ]);
  });

  it("embarque ainda aberto vai até hoje; futuras e a de hoje sem Closed não contam", () => {
    expect(
      periodosEmbarcadosLogistica(
        [
          perna("2026-11-05", "BASE", "P-79", false), // passado, sem Closed: conta
          perna("2026-11-12", "P-79", "BASE", false), // hoje, sem Closed: ainda não
          perna("2026-11-20", "BASE", "P-80"), // futuro: nunca
        ],
        hoje,
        janela,
      ),
    ).toEqual([{ dataInicio: "2026-11-05", dataFim: "2026-11-12", unidade: "P-79" }]);
  });

  it("transferência entre unidades continua o embarque; 1ª perna desembarque = já estava a bordo", () => {
    expect(
      periodosEmbarcadosLogistica(
        [
          perna("2026-09-20", "P-79", "BASE"),
          perna("2026-10-01", "BASE", "P-79"),
          perna("2026-10-05", "P-79", "P-80"),
          perna("2026-10-10", "P-80", "BASE"),
        ],
        hoje,
        janela,
      ),
    ).toEqual([
      { dataInicio: janela, dataFim: "2026-09-19", unidade: "P-79" },
      { dataInicio: "2026-10-01", dataFim: "2026-10-09", unidade: "P-80" },
    ]);
  });
});

describe("corrigirStatusPelaLogistica", () => {
  const log = indexarLogistica([
    { colaborador_id: "c1", data_inicio: "2026-11-01", data_fim: "2026-11-09", unidade: "P-79" },
  ]);
  it("Ficha em Folga + logística embarcado → Embarcado, na unidade da logística", () => {
    const r = corrigirStatusPelaLogistica({ status: "F" }, "c1", "2026-11-05", "2026-11-12", log);
    expect(r.status).toBe("E");
    expect(r.periodo?.unidade_operacional).toBe("P-79");
  });
  it("não mexe quando a Ficha já é embarque, fora do período, futuro ou sem dados", () => {
    const fi = { status: "FI" as const };
    expect(corrigirStatusPelaLogistica(fi, "c1", "2026-11-05", "2026-11-12", log)).toBe(fi);
    const f = { status: "F" as const };
    expect(corrigirStatusPelaLogistica(f, "c1", "2026-11-10", "2026-11-12", log)).toBe(f);
    expect(corrigirStatusPelaLogistica(f, "c1", "2026-11-05", "2026-11-04", log)).toBe(f);
    expect(corrigirStatusPelaLogistica(f, "c2", "2026-11-05", "2026-11-12", log)).toBe(f);
    expect(corrigirStatusPelaLogistica(f, "c1", "2026-11-05", "2026-11-12", null)).toBe(f);
  });
});
