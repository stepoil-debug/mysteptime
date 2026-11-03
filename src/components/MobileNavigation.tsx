import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavigationItem = { to: string; label: string; exact?: boolean };

export function MobileNavigation({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden" aria-label="Abrir menu" title="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[min(85vw,360px)] flex-col" aria-describedby={undefined}>
        <SheetHeader><SheetTitle>My Step Time</SheetTitle></SheetHeader>
        <nav aria-label="Módulos" className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium", active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}