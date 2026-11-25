import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, RefreshCw, LogOut } from "lucide-react";
import { useEffect } from "react";
import { pageTitle } from "@/lib/pageTitle";

export const Route = createFileRoute("/pending")({ head: () => pageTitle("Aguardando liberação"), component: Pending });

function Pending() {
  const { user, role, signOut, refreshRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (role && role !== "pending") navigate({ to: "/" });
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/20 text-warning-foreground">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Aguardando liberação dos módulos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu acesso ao Mysteptime foi criado, mas ainda não há módulos liberados para você.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Solicite ao <b>setor Offshore</b> a liberação dos módulos que você precisa usar.
          Depois da liberação, clique em <b>Verificar</b>.
        </p>
        {user?.email && <p className="mt-3 text-xs text-muted-foreground">E-mail: {user.email}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshRole}><RefreshCw className="mr-2 h-4 w-4" />Verificar</Button>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); window.location.href = "https://intranet.step-og.com/intranet/offshore"; }}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
        </div>
      </Card>
    </div>
  );
}
