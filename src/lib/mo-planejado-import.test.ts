import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { matrizDesdeA1, parseColagemMo, parseDataMo, parsePlanilhaMo } from "./mo-planejado-import";

describe("parseDataMo", () => {
  it("aceita dd/mm/aaaa, ISO e serial do Excel", () => {
    expect(parseDataMo("05/11/2026")).toBe("2026-11-05");
    expect(parseDataMo("2026-11-05")).toBe("2026-11-05");
    expect(parseDataMo(46331)).toBe("2026-11-05");
    expect(parseDataMo("31/02/2026")).toBeNull();
    expect(parseDataMo("")).toBeNull();
  });
});

describe("parseColagemMo", () => {
  it("lê o bloco B:H, normaliza e pula cabeçalho e linhas vazias", () => {
    const r = parseColagemMo(
      [
        "QTD\tFUNÇÃO PADRÃO\tUNID\tPM\tBSP\tDATA EMB.\tDATA DES",
        "2\t fitter \tanna nery\tsandro\t25-1032\t01/11/2026\t15/11/2026",
        "\t\t\t\t\t\t",
        '1\tWELDER\tSD SEPETIBA\t\t"EM PLANEJAMENTO\n2ª FASE"\t02/11/2026\t01/11/2026',
      ].join("\n"),
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      qtd: 2,
      funcao: "FITTER",
      unidade: "ANNA NERY",
      pm: "SANDRO",
      bsp: "25-1032",
      data_embarque: "2026-11-01",
      data_desembarque: "2026-11-15",
      erros: [],
    });
    expect(r[1].bsp).toBe("EM PLANEJAMENTO\n2ª FASE");
    expect(r[1].erros).toEqual(["Desembarque antes do embarque"]);
  });
});

describe("parsePlanilhaMo", () => {
  it("lê a partir da linha 3, colunas B:H, e ignora linha sem QTD e sem função", () => {
    const r = parsePlanilhaMo([
      ["", "M.O"],
      ["", "QTD", "FUNÇÃO PADRÃO", "UNID", "PM", "BSP", "DATA EMB.", "DATA DES"],
      ["x", 3, "SUPERVISOR", "FORTE - UMS", "MARCOS/BRANDÃO", "ON HOLD", 46327, 46341],
      ["x", "", "", "ANNA NERY"],
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ linha: 3, qtd: 3, bsp: "ON HOLD", data_embarque: "2026-11-01" });
  });
});

describe("matrizDesdeA1", () => {
  it("lê a aba M.O que começa em B2 sem deslocar as colunas", () => {
    // Igual à planilha real: !ref começa em B2 (nada na coluna A nem na linha 1).
    const ws = XLSX.utils.sheet_add_aoa(
      {} as XLSX.WorkSheet,
      [
        ["QTD", "FUNÇÃO PADRÃO", "UNID", "PM", "BSP", "DATA EMB.", "DATA DES"],
        [2, "FITTER", "ANNA NERY", "SANDRO", "25-1032", 46327, 46341],
        ["", "SUPERVISOR", "ANNA NERY", "SANDRO", "", 46327, 46341],
      ],
      { origin: "B2" },
    );
    ws["!ref"] = "B2:H4";
    const r = parsePlanilhaMo(matrizDesdeA1(ws));
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ linha: 3, qtd: 2, funcao: "FITTER", erros: [] });
    // QTD em branco com função entra como 0 (não soma, igual à planilha).
    expect(r[1]).toMatchObject({ linha: 4, qtd: 0, funcao: "SUPERVISOR", erros: [] });
  });
});
