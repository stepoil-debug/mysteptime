import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageTitle } from "@/lib/pageTitle";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => pageTitle("Redefinir senha"),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
    // Tira o token do histórico do navegador.
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirma) return setErro("As senhas não conferem.");
    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
      if (otpError) throw new Error("Link inválido ou expirado. Peça um novo em \"Esqueci minha senha\".");
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw new Error(error.message);
      setFeito(true);
      setTimeout(() => window.location.replace(`${import.meta.env.BASE_URL}auth`), 1500);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e1c38] px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        {!token ? (
          <p className="mt-4 text-sm text-slate-300">
            Link incompleto. Abra o link do e-mail novamente ou peça outro em{" "}
            <a className="text-sky-400 underline" href={`${import.meta.env.BASE_URL}auth`}>Esqueci minha senha</a>.
          </p>
        ) : feito ? (
          <p className="mt-4 text-sm text-emerald-300">Senha alterada. Entrando…</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={salvar}>
            <div>
              <Label htmlFor="nova" className="text-xs text-slate-400">Nova senha</Label>
              <Input id="nova" type="password" autoComplete="new-password" required value={senha}
                onChange={(e) => setSenha(e.target.value)} className="mt-1.5 h-11 border-white/10 bg-white/5 text-white" />
            </div>
            <div>
              <Label htmlFor="conf" className="text-xs text-slate-400">Confirmar senha</Label>
              <Input id="conf" type="password" autoComplete="new-password" required value={confirma}
                onChange={(e) => setConfirma(e.target.value)} className="mt-1.5 h-11 border-white/10 bg-white/5 text-white" />
            </div>
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <button type="submit" disabled={busy}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-sky-600 text-sm font-semibold hover:bg-sky-500 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
