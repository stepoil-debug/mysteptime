import { describe, expect, it } from "vitest";
import {
  formatarEnderecoDrake,
  normMatricula,
  sugerirMatriculas,
  type CadastroDrake,
} from "./planejamento-drake-cadastro";

const cad = (nome: string, matricula: string, ativo = true): CadastroDrake => ({
  nome,
  matricula,
  empresa: "STEP",
  ativo,
});

describe("sugerirMatriculas", () => {
  const cadastros = [
    cad("Alan de Souza Santos", "001501"),
    cad("JOÃO DA SILVA", "001600"),
    cad("JOAO DA SILVA", "001601"), // homônimo: ambíguo
    cad("Marcos Pereira Lima", "001700"),
    cad("Carla Nunes", "001800"),
  ];

  it("nome igual sem acento/caixa vira sugestão exata; homônimo não sugere", () => {
    const r = sugerirMatriculas(
      [
        { id: "1", nome: "ALAN DE SOUZA SANTOS", matricula: null },
        { id: "2", nome: "João da Silva", matricula: "" },
        { id: "3", nome: "Quem Não Existe", matricula: null },
        { id: "4", nome: "Já Tem", matricula: "000999" },
      ],
      cadastros,
      [],
    );
    expect(r).toEqual([
      {
        id: "1",
        nome: "ALAN DE SOUZA SANTOS",
        matricula: "001501",
        empresa: "STEP",
        nomeDrake: "Alan de Souza Santos",
        tipo: "exato",
      },
    ]);
  });

  it("nome parecido (uma palavra diferente) só com candidato único, marcado para conferir", () => {
    const r = sugerirMatriculas([{ id: "1", nome: "MARCOS PEREIRA LIMAS", matricula: null }], cadastros, []);
    expect(r[0]).toMatchObject({ matricula: "001700", tipo: "parecido" });
  });

  it("não sugere matrícula já usada no Planejamento (nem duas vezes a mesma)", () => {
    expect(
      sugerirMatriculas([{ id: "1", nome: "Carla Nunes", matricula: null }], cadastros, ["1800"]),
    ).toEqual([]);
    expect(
      sugerirMatriculas(
        [
          { id: "1", nome: "Carla Nunes", matricula: null },
          { id: "2", nome: "CARLA NUNES", matricula: null },
        ],
        cadastros,
        [],
      ),
    ).toHaveLength(1);
  });

  it("normMatricula ignora zeros à esquerda", () => {
    expect(normMatricula(" 000122 ")).toBe("122");
    expect(normMatricula("")).toBe("");
  });
});

describe("formatarEnderecoDrake", () => {
  it("prefere o ativo e monta uma linha só", () => {
    expect(
      formatarEnderecoDrake([
        { StreetAddress: "Rua Antiga", City: "Niterói", State: "RJ", Enabled: false },
        {
          StreetAddress: "Rua das Flores",
          Number: "10",
          AddressComplement: "Apto 2",
          District: "Centro",
          City: "Macaé",
          State: "RJ",
          ZipCode: "27910-000",
          Enabled: true,
        },
      ]),
    ).toBe("Rua das Flores, 10 - Apto 2 - Centro - Macaé/RJ - CEP 27910-000");
  });
  it("sem endereço útil = null", () => {
    expect(formatarEnderecoDrake([])).toBeNull();
    expect(formatarEnderecoDrake([{ ZipCode: "1", Enabled: true }])).toBeNull();
  });
});
