// Extrai o número da nota fiscal de um texto OCR. IA própria (API da Anthropic) no lugar do gateway
// do Lovable. Secret da função: ANTHROPIC_API_KEY. Publicada na Intranet como mysteptime-extract-invoice-number-ai.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const SYSTEM =
  "Extraia somente o número da nota fiscal / NF-e / NFS-e do texto OCR. NUNCA confunda com chave de acesso, CNPJ, número de boleto, linha digitável, número da fatura, número da DPS, versão do DANFSe, reserva, datas ou valores monetários. Se não houver certeza absoluta, retorne number = null. Nunca invente um número.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return reply({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
    const { ocrText } = await req.json();
    if (typeof ocrText !== "string" || !ocrText.trim()) return reply({ error: "Texto OCR não informado" }, 400);

    const client = new Anthropic();
    let response;
    try {
      response = await client.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { number: { type: ["string", "null"] } },
              required: ["number"],
              additionalProperties: false,
            },
          },
        },
        system: SYSTEM,
        messages: [{ role: "user", content: ocrText.slice(0, 30000) }],
      });
    } catch (e) {
      const status = e instanceof Anthropic.APIError ? (e.status ?? 502) : 502;
      return reply({ error: "Falha ao consultar IA", status }, status);
    }
    if (response.stop_reason === "refusal") return reply({ number: null });

    let number: string | null = null;
    for (const block of response.content) {
      if (block.type !== "text") continue;
      try {
        const raw = JSON.parse(block.text)?.number;
        if (typeof raw === "string" && /\d/.test(raw)) number = raw.trim();
      } catch {
        number = null;
      }
    }
    return reply({ number });
  } catch {
    return reply({ error: "Erro inesperado" }, 500);
  }
});
