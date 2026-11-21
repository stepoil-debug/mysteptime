import process from "node:process";

// Envio pelo mesmo fluxo do Power Automate usado pela Intranet STEP One (caixa noreply do Microsoft 365):
// gatilho de webhook + "Enviar um email (V2)" do Outlook, com o login oficial do conector — sem senha
// nem DNS no app. A URL do fluxo é secreta e fica só no servidor (M365_FLOW_URL, nunca VITE_).
// Contrato do fluxo: { to, cc, bcc, subject, html, text }, endereços separados por ";".

export type FlowMail = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text: string;
};

const list = (v?: string | string[]) =>
  (Array.isArray(v) ? v : (v ?? "").split(/[;,]/)).map((s) => s.trim()).filter(Boolean);

export function mailFlowConfigured(): boolean {
  return Boolean(process.env.M365_FLOW_URL?.trim());
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));

/** Envia pelo fluxo. Lança erro se o fluxo recusar; retorna um id local (o fluxo não devolve message-id). */
export async function sendMailFlow(mail: FlowMail): Promise<{ id: string }> {
  const url = process.env.M365_FLOW_URL?.trim();
  if (!url) throw new Error("M365_FLOW_URL não configurada.");
  const to = list(mail.to);
  if (to.length === 0) throw new Error("Destinatário não informado.");
  const html = mail.html ?? `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">${escapeHtml(mail.text)}</pre>`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: to.join(";"),
      cc: list(mail.cc).join(";"),
      bcc: list(mail.bcc).join(";"),
      subject: mail.subject,
      html,
      text: mail.text,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fluxo de e-mail recusou o envio (${response.status}): ${body.slice(0, 200) || "sem detalhes"}`);
  }
  const id = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  console.info("[mysteptime-mail] aceito pelo fluxo noreply", { id, recipients: to.length + list(mail.cc).length + list(mail.bcc).length });
  return { id };
}
