import { ArrowLeft, Home } from "lucide-react";

/**
 * Volta ao portal corporativo sem transportar tokens ou senhas entre domínios.
 * Funciona tanto no login quanto nas demais áreas da aplicação.
 */
export function BackToIntranet() {
  return (
    <a
      href="https://intranet.step-og.com/intranet/offshore"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-300/30 bg-[#173f73] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#24548f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      aria-label="Voltar à Intranet STEP One"
      title="Voltar à Intranet STEP One"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <Home className="h-4 w-4" aria-hidden="true" />
      <span>Voltar à Intranet</span>
    </a>
  );
}
