// Diagnóstico de falhas de e-mail por regras (sem IA externa). Cada regra reconhece um padrão
// no texto colado pela pessoa (erro, status HTTP, mensagem do fluxo) e devolve causa e correção.
// Para cobrir um caso novo, basta acrescentar uma regra em RULES — a ordem define a prioridade.

export interface EmailDiagnosisRule {
  id: string;
  match: RegExp;
  cause: string;
  fix: string[];
  confirm: string;
}

const RULES: EmailDiagnosisRule[] = [
  {
    id: "paused",
    match: /paused|pausad[oa]|EMAILS_PAUSED/i,
    cause: "O envio de e-mails está pausado no sistema (pausa temporária ligada no código).",
    fix: ["Peça ao desenvolvedor para desligar a pausa (EMAILS_PAUSED) e publicar a nova versão."],
    confirm: "Depois da publicação, refaça a ação e veja se o e-mail chega.",
  },
  {
    id: "flow-not-configured",
    match: /M365_FLOW_URL|fluxo.*n[ãa]o configurad|n[ãa]o configurad.*(e-?mail|avisos)/i,
    cause: "A caixa noreply (fluxo do Power Automate) não está configurada neste ambiente.",
    fix: [
      "Na Vercel, confira se a variável M365_FLOW_URL existe em Production.",
      "Para alertas automáticos, confira também o secret M365_FLOW_URL nas Edge Functions do Supabase.",
      "Publique de novo depois de cadastrar.",
    ],
    confirm: "Refaça a ação: o e-mail deve sair pela caixa noreply.",
  },
  {
    id: "flow-auth",
    match: /\b(401|403)\b|unauthori[sz]ed|forbidden|sem permiss|invalid.*(key|signature|sig)/i,
    cause: "O fluxo de e-mail (ou o serviço de envio) recusou a chamada por falta de autorização — o link do fluxo mudou ou expirou.",
    fix: [
      "Abra o fluxo no Power Automate e copie de novo a URL do gatilho HTTP.",
      "Atualize M365_FLOW_URL na Vercel e nos secrets do Supabase.",
      "Publique de novo.",
    ],
    confirm: "Refaça a ação e verifique no histórico do fluxo se a execução aparece como bem-sucedida.",
  },
  {
    id: "bad-recipient",
    match: /invalid.*(recipient|address|email)|destinat[áa]rio inv[áa]lido|mailbox (unavailable|not found)|user unknown|550|5\.1\.1|does not exist/i,
    cause: "O endereço do destinatário está errado ou não existe.",
    fix: [
      "Confira o e-mail cadastrado no perfil do usuário (letra a letra).",
      "Corrija o cadastro e refaça a ação.",
    ],
    confirm: "O e-mail deve chegar ao endereço corrigido.",
  },
  {
    id: "rate-limit",
    match: /\b429\b|too many|rate.?limit|limite de envio|throttl/i,
    cause: "Limite de envios atingido em pouco tempo.",
    fix: ["Aguarde alguns minutos.", "Evite reenviar o mesmo aviso várias vezes seguidas."],
    confirm: "Tente de novo após alguns minutos; o envio deve passar.",
  },
  {
    id: "flow-error",
    match: /\b5\d\d\b|bad gateway|service unavailable|timeout|timed out|abort|ECONNRESET|ETIMEDOUT|fetch failed/i,
    cause: "O fluxo de e-mail não respondeu a tempo ou teve erro interno.",
    fix: [
      "Abra o histórico de execuções do fluxo no Power Automate e veja a execução com erro.",
      "Se o fluxo estiver desligado, ligue-o.",
      "Tente o envio de novo.",
    ],
    confirm: "No histórico do fluxo, a nova execução deve aparecer como bem-sucedida.",
  },
  {
    id: "no-recipient",
    match: /sem destinat|no recipients?|destinat[áa]rio.*vazio|missing.*\bto\b/i,
    cause: "Não havia destinatário para o aviso (responsável da etapa sem e-mail cadastrado).",
    fix: ["Cadastre o e-mail do responsável da etapa no perfil dele.", "Refaça a mudança de etapa."],
    confirm: "O aviso deve chegar ao responsável e à cópia da Logística.",
  },
  {
    id: "spam",
    match: /n[ãa]o chegou|n[ãa]o recebi|lixo|spam|quarentena|junk|not received/i,
    cause: "O e-mail provavelmente saiu, mas ficou retido no lixo eletrônico ou na quarentena do destinatário.",
    fix: [
      "Peça ao destinatário para procurar no Lixo Eletrônico e na Quarentena do Outlook.",
      "Marque o remetente noreply como confiável.",
      "Se não estiver em lugar nenhum, confira o histórico do fluxo no Power Automate.",
    ],
    confirm: "Com o remetente marcado como confiável, os próximos avisos chegam na caixa de entrada.",
  },
];

export function diagnoseEmailByRules(details: string): { answer: string; rule: string | null } {
  const rule = RULES.find((r) => r.match.test(details));
  if (!rule) {
    return {
      rule: null,
      answer: [
        "**Causa provável:** não foi possível identificar a causa pelo texto informado.",
        "**Como corrigir:**",
        "1. Copie a mensagem de erro completa que aparece na tela (ou o status do envio).",
        "2. Confira no Power Automate o histórico de execuções do fluxo de e-mail.",
        "3. Confira se o e-mail do destinatário está correto no perfil.",
        "**Como confirmar:** cole aqui a mensagem completa para uma nova análise.",
      ].join("\n"),
    };
  }
  return {
    rule: rule.id,
    answer: [
      `**Causa provável:** ${rule.cause}`,
      "**Como corrigir:**",
      ...rule.fix.map((step, i) => `${i + 1}. ${step}`),
      `**Como confirmar:** ${rule.confirm}`,
    ].join("\n"),
  };
}
