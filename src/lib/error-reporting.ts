// Registro de erros do cliente (registro local). Só registra no console do navegador.
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[mysteptime]", error, { route: window.location.pathname, ...context });
}
