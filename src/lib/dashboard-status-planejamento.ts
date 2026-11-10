// Em qual balde do Dashboard (rosquinhas Ocupação / Fora da Ocupação / Bloqueados Henrique) cai
// cada Status digitado no Planejamento de Embarque. Puro e sem dependência de navegador — ver
// dashboard-status-planejamento.test.ts.
//
// Pedido dela (2026-11-10):
// - Ocupação: Embarcado, Programado, Folga e Trabalho Externo.
// - Fora da Ocupação: Disponível ("Stand By"), Indisponível (fatia própria), Férias/Atestado/
//   Afastamento (fatias próprias, como já era) e "Outros" (Terceirizado e qualquer texto livre).
// - Bloqueados Henrique: "Base Henrique" e "Bloqueio - Base - Henrique" (e, se aparecerem,
//   Na Base, outros "Base - Fulano"/Bloqueio Temporário e Bloqueio RH, que já ficavam aqui).

export type BaldeStatusPlanejamento =
  | "embarcado"
  | "programado"
  | "folga"
  | "trabalhoExterno"
  | "standBy"
  | "naBase"
  | "baseHenrique"
  | "bloqueioBaseHenrique"
  | "bloqueioTemporario"
  | "bloqueioRH"
  | "ferias"
  | "atestado"
  | "afastamento"
  | "indisponivel"
  | "outros";

/** Palavras do status em maiúsculas, sem acento e sem pontuação ("Bloqueio - Base" → [BLOQUEIO, BASE]). */
export function palavrasStatus(status: string | null | undefined): string[] {
  return (status ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

export function classificarStatusPlanejamento(
  status: string | null | undefined,
  rhBloqueado = false,
): BaldeStatusPlanejamento {
  const p = palavrasStatus(status);
  const texto = p.join(" ");
  const tem = (...w: string[]) => w.every((x) => p.includes(x));

  if (texto === "EMBARCADO") return "embarcado";
  if (texto === "PROGRAMADO") return "programado";
  if (texto === "FOLGA") return "folga";
  if (texto === "TRABALHO EXTERNO") return "trabalhoExterno";
  if (texto === "DISPONIVEL") return "standBy";
  if (texto === "BASE" || texto === "NA BASE") return "naBase";
  if (tem("BLOQUEIO", "BASE", "HENRIQUE")) return "bloqueioBaseHenrique";
  if (tem("BASE", "HENRIQUE")) return "baseHenrique";
  // Outros "Base - Fulano" e "Bloqueio Temporário" (mesmo critério de antes).
  if ((p[0] === "BASE" && /^\s*BASE\s*-/i.test(status ?? "")) || texto === "BLOQUEIO TEMPORARIO")
    return "bloqueioTemporario";
  if (rhBloqueado || tem("BLOQUEIO", "RH")) return "bloqueioRH";
  if (texto.includes("FERIAS")) return "ferias";
  if (texto.includes("ATESTADO")) return "atestado";
  if (texto.includes("AFASTAMENTO")) return "afastamento";
  if (p.includes("INDISPONIVEL")) return "indisponivel";
  return "outros";
}

/** Status que contam como Ocupação (rosquinha azul e "Taxa de Ocupação por mês"). */
export function statusPlanejamentoOcupado(status: string | null | undefined): boolean {
  const b = classificarStatusPlanejamento(status);
  return b === "embarcado" || b === "programado" || b === "folga" || b === "trabalhoExterno";
}
