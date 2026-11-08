// Registro de erros do cliente (substitui o reporter do Lovable). Só registra no console do navegador.
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[mysteptime]", error, { route: window.location.pathname, ...context });
}
