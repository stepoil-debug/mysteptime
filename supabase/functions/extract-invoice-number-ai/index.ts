// Extrai o número da nota fiscal de um texto OCR por regras (sem IA externa).
// Mesmas regras de src/lib/invoiceNumberExtraction.ts (findInvoiceNumber); manter as duas iguais.
// Nome da função mantido por compatibilidade. Não precisa de secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function cleanCandidate(value: string): string | null {
  const candidate = value.trim().replace(/^[#:\-.\s]+|[#:\-.\s]+$/g, "");
  if (!candidate) return null;
  const compact = candidate.replace(/[^a-z0-9]/gi, "");
  if (!/\d/.test(compact)) return null;
  // Chave de acesso (44), CNPJ (14) e linhas longas não são número de nota.
  if (compact.length === 44 || compact.length > 20) return null;
  if (/^\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}$/.test(candidate)) return null;
  return candidate;
}

function findInvoiceNumber(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeText(lines[i]);
    if (/numero\s+da\s+nfs-?e/.test(line) || /numero\s+da\s+nf-?e/.test(line)) {
      for (let offset = 1; offset <= 2; offset++) {
        const match = lines[i + offset]?.trim().match(/^(\d{1,20})\b/);
        const candidate = match?.[1] ? cleanCandidate(match[1]) : null;
        if (candidate) return candidate;
      }
    }
  }
  const normalized = normalizeText(text);
  const patterns: RegExp[] = [
    /(?:numero|n[ºo.]*)\s*(?:da\s*)?nfs-?e\s*[:#-]?\s*(\d[\d./-]{0,19})/i,
    /nfs-?e\s*(?:numero|n[ºo.]*)\s*[:#-]?\s*(\d[\d./-]{0,19})/i,
    /(?:numero|n[ºo.]*)\s*(?:da\s+)?nota(?:\s+fiscal)?\s*[:#-]?\s*(\d[\d./-]{0,19})/i,
    /nota\s+fiscal(?:\s+eletronica)?\s*(?:numero|n[ºo.]*)\s*[:#-]?\s*(\d[\d./-]{0,19})/i,
    /nf-?e\s*(?:numero|n[ºo.]*)\s*[:#-]?\s*(\d[\d./-]{0,19})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1] ? cleanCandidate(match[1]) : null;
    if (candidate) return candidate;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { ocrText } = await req.json();
    if (typeof ocrText !== "string" || !ocrText.trim()) return reply({ error: "Texto OCR não informado" }, 400);
    return reply({ number: findInvoiceNumber(ocrText.slice(0, 30000)) });
  } catch {
    return reply({ error: "Erro inesperado" }, 500);
  }
});
