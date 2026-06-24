"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ModeToggle } from "@/components/layout/mode-toggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "Painel",
  "/inbox": "Caixa de Entrada",
  "/contacts": "Contatos",
  "/pipelines": "Pipelines",
  "/broadcasts": "Disparos",
  "/automations": "Automações",
  "/flows": "Fluxos",
  "/settings": "Configurações",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "Painel";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Abrir menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="flex items-center">
        <ModeToggle />
      </div>
    </header>
  );
}
