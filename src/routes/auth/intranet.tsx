import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/intranet")({
  component: IntranetAuthPage,
});

function IntranetAuthPage() {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const ticket = fragment.get("ticket") || "";

    // Remove the credential from browser history immediately.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
      setError("O acesso temporário da Intranet é inválido ou já expirou.");
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/auth/intranet", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket }),
        });
        const data = await response.json().catch(() => ({})) as {
          ok?: boolean; tokenHash?: string; error?: string
        };
        if (!response.ok || !data.ok || !data.tokenHash) {
          throw new Error(data.error || "Não foi possível validar o acesso corporativo.");
        }

        // A sessão é emitida pelo Supabase Auth para o usuário real.
        // Não se tenta usar o token da Intranet como sessão do Supabase.
        const { error: authError } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: "magiclink",
        });
        if (authError) throw new Error("A autenticação do Mysteptime não pôde ser concluída.");
        window.location.replace("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível concluir o acesso integrado.");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e1c38] px-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl" aria-live="polite">
        <ShieldCheck className="mx-auto mb-4 h-9 w-9 text-sky-400" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Mysteptime — Acesso STEP One</h1>
        {error ? (
          <>
            <p className="mt-4 text-sm text-rose-200">{error}</p>
            <a href="https://intranet.step-og.com/intranet/offshore" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 font-semibold hover:bg-sky-500">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à Intranet
            </a>
          </>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-3 text-sm text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Validando seu acesso corporativo...
          </div>
        )}
      </section>
    </main>
  );
}
