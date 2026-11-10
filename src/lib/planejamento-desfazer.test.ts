import { describe, expect, it } from "vitest";
import {
  LIMITE_DESFAZER,
  acaoEdicao,
  camposAlteradosDepois,
  empilhar,
  linhaParaRestaurar,
  type AcaoPlanejamento,
} from "./planejamento-desfazer";

const linha = {
  id: "1",
  nome: "JOÃO",
  status: "BASE",
  embarque: "2026-11-01",
  duracao_embarque_dias: 14,
  updated_at: "2026-11-10T10:00:00Z",
  updated_by: "u1",
};

describe("acaoEdicao", () => {
  it("guarda antes/depois só dos campos que mudam", () => {
    const a = acaoEdicao(
      linha,
      { status: "EMBARCADO", embarque: "2026-11-01", duracao_embarque_dias: 14 },
      "Editou Status",
    );
    expect(a).toEqual({
      tipo: "editar",
      id: "1",
      nome: "JOÃO",
      antes: { status: "BASE" },
      depois: { status: "EMBARCADO" },
      descricao: "Editou Status",
    });
  });

  it("nada mudou → não guarda", () => {
    expect(acaoEdicao(linha, { status: "BASE", duracao_embarque_dias: "14" }, "x")).toBeNull();
  });

  it("campo vazio antes volta como null", () => {
    const a = acaoEdicao({ id: "1", nome: "A" }, { bsp: "25-1" }, "x");
    expect(a && a.tipo === "editar" && a.antes).toEqual({ bsp: null });
  });
});

describe("camposAlteradosDepois", () => {
  it("aponta o campo que outra pessoa mudou depois", () => {
    expect(camposAlteradosDepois({ status: "FOLGA" }, { status: "EMBARCADO" })).toEqual(["status"]);
    expect(
      camposAlteradosDepois({ status: "EMBARCADO", bsp: "x" }, { status: "EMBARCADO" }),
    ).toEqual([]);
  });
});

describe("linhaParaRestaurar", () => {
  it("mantém o id e tira as colunas de auditoria", () => {
    expect(linhaParaRestaurar(linha)).toEqual({
      id: "1",
      nome: "JOÃO",
      status: "BASE",
      embarque: "2026-11-01",
      duracao_embarque_dias: 14,
    });
  });
});

describe("empilhar", () => {
  it("guarda no máximo as últimas ações", () => {
    let pilha: AcaoPlanejamento[] = [];
    for (let i = 0; i < LIMITE_DESFAZER + 5; i++) {
      pilha = empilhar(pilha, { tipo: "criar", id: String(i), nome: "A", descricao: "" });
    }
    expect(pilha).toHaveLength(LIMITE_DESFAZER);
    expect(pilha[pilha.length - 1]).toMatchObject({ id: String(LIMITE_DESFAZER + 4) });
    expect(empilhar(pilha, null)).toBe(pilha);
  });
});
