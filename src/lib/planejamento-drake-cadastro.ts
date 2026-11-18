// Cruzamento do Planejamento de Embarque com o cadastro do Drake (pedido dela, 2026-11-18):
// - sugerir a matrícula de quem está sem ela (pelo nome no cadastro do Histograma, que espelha
//   os colaboradores ATIVOS do Drake);
// - montar o endereço (logística de deslocamento) a partir do endereço do Drake.
// Puro — ver planejamento-drake-cadastro.test.ts.

export const normNomePessoa = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Matrícula sem zeros à esquerda ("000122" → "122"), para comparar fontes diferentes. */
export const normMatricula = (m: string | null | undefined) => {
  const t = (m ?? "").trim();
  return t ? t.replace(/^0+(?=\d)/, "") : "";
};

export interface LinhaSemMatricula {
  id: string;
  nome: string;
  matricula: string | null;
}

export interface CadastroDrake {
  nome: string;
  matricula: string;
  empresa: string | null;
  ativo: boolean;
}

export interface SugestaoMatricula {
  id: string;
  nome: string;
  matricula: string;
  empresa: string | null;
  nomeDrake: string;
  /** "exato" = mesmo nome (sem acento/caixa) e um só cadastro; "parecido" = conferir. */
  tipo: "exato" | "parecido";
}

const palavras = (s: string) => normNomePessoa(s).split(" ").filter((w) => w.length > 2);

/**
 * Para cada linha sem matrícula, procura o cadastro do Drake:
 * 1. nome igual (sem acento/caixa) com UM cadastro ativo (ou um só cadastro, se nenhum ativo);
 * 2. senão, nome parecido: mesmo primeiro nome e no máximo uma palavra diferente — e só se for
 *    um único candidato. Nunca sugere quando há ambiguidade.
 * Também nunca sugere uma matrícula que já está em uso em outra linha do Planejamento.
 */
export function sugerirMatriculas(
  linhas: LinhaSemMatricula[],
  cadastros: CadastroDrake[],
  matriculasEmUso: Iterable<string>,
): SugestaoMatricula[] {
  const emUso = new Set(Array.from(matriculasEmUso, normMatricula).filter(Boolean));
  const porNome = new Map<string, CadastroDrake[]>();
  for (const c of cadastros) {
    if (!c.matricula?.trim()) continue;
    const k = normNomePessoa(c.nome);
    if (!porNome.has(k)) porNome.set(k, []);
    porNome.get(k)!.push(c);
  }
  const usadasAqui = new Set<string>();
  const out: SugestaoMatricula[] = [];
  for (const l of linhas) {
    if (l.matricula?.trim()) continue;
    const iguais = porNome.get(normNomePessoa(l.nome)) ?? [];
    const ativos = iguais.filter((c) => c.ativo);
    let escolhido: CadastroDrake | null = null;
    let tipo: SugestaoMatricula["tipo"] = "exato";
    if (ativos.length === 1) escolhido = ativos[0];
    else if (ativos.length === 0 && iguais.length === 1) escolhido = iguais[0];
    else if (iguais.length === 0) {
      const p = palavras(l.nome);
      if (p.length >= 2) {
        const candidatos = cadastros.filter((c) => {
          if (!c.matricula?.trim() || !c.ativo) return false;
          const q = palavras(c.nome);
          if (q[0] !== p[0]) return false;
          const comuns = p.filter((w) => q.includes(w)).length;
          return comuns >= 2 && comuns >= Math.max(p.length, q.length) - 1;
        });
        if (candidatos.length === 1) {
          escolhido = candidatos[0];
          tipo = "parecido";
        }
      }
    }
    if (!escolhido) continue;
    const m = normMatricula(escolhido.matricula);
    if (emUso.has(m) || usadasAqui.has(m)) continue;
    usadasAqui.add(m);
    out.push({
      id: l.id,
      nome: l.nome,
      matricula: escolhido.matricula.trim(),
      empresa: escolhido.empresa,
      nomeDrake: escolhido.nome,
      tipo,
    });
  }
  return out;
}

export interface EnderecoDrake {
  StreetAddress?: unknown;
  Number?: unknown;
  AddressComplement?: unknown;
  District?: unknown;
  City?: unknown;
  State?: unknown;
  ZipCode?: unknown;
  Enabled?: unknown;
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Escolhe o endereço ativo (ou o primeiro com rua/cidade) e monta uma linha só. */
export function formatarEnderecoDrake(lista: EnderecoDrake[]): string | null {
  const validos = lista.filter((e) => txt(e.StreetAddress) || txt(e.City));
  const e = validos.find((x) => x.Enabled === true) ?? validos[0];
  if (!e) return null;
  const rua = [txt(e.StreetAddress), txt(e.Number)].filter(Boolean).join(", ");
  const cidadeUf = [txt(e.City), txt(e.State)].filter(Boolean).join("/");
  const cep = txt(e.ZipCode);
  const partes = [
    rua,
    txt(e.AddressComplement),
    txt(e.District),
    cidadeUf,
    cep ? `CEP ${cep}` : "",
  ].filter(Boolean);
  return partes.length ? partes.join(" - ") : null;
}
