"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Radio,
  Settings,
  Sun,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; label: string; className: string }
> = {
  owner: {
    icon: Crown,
    label: "Proprietário",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    label: "Admin",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    label: "Agente",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    label: "Visualizador",
    className: "border-border bg-card text-muted-foreground",
  },
};

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
  /** When true, only admin and owner see this item. Agents and viewers don't. */
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard, adminOnly: true },
  { href: "/inbox", label: "Caixa de Entrada", icon: MessageSquare },
  { href: "/meus-clientes", label: "Meus Clientes", icon: UserCog },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/equipe", label: "Equipe", icon: UsersRound, adminOnly: true },
  { href: "/agents", label: "Agentes IA", icon: Bot, adminOnly: true },
  { href: "/broadcasts", label: "Disparos", icon: Radio },
  { href: "/automations", label: "Automações", icon: Zap },
  { href: "/flows", label: "Fluxos", icon: Workflow, beta: true },
];

const bottomNavItems: NavItem[] = [
  { href: "/settings", label: "Configurações", icon: Settings },
];

function isAdmin(role: AccountRole | null) {
  return role === "admin" || role === "owner";
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ open = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const { mode, toggleMode } = useTheme();
  const totalUnread = useTotalUnread();

  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Filter nav items based on role.
  // While profile is loading, hide admin-only items to avoid a flash
  // where the full menu appears then shrinks once the role is known.
  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin(accountRole)
  );
  const visibleBottomItems = bottomNavItems.filter(
    (item) => !item.adminOnly || isAdmin(accountRole)
  );

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-white/10 bg-[#082637]",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-all lg:duration-200",
          collapsed ? "lg:w-16" : "lg:w-72",
        )}
        aria-label="Navegação principal"
      >
        {/* Logo row */}
        <div className="relative flex h-24 shrink-0 items-center justify-start border-b border-white/10 px-5">
          <Link href={isAdmin(accountRole) ? "/dashboard" : "/inbox"} className={cn("flex items-center py-3", collapsed && "lg:hidden")}>
            <Image
              src="/logomja.png"
              alt="Mario Jorge Advocacia"
              width={155}
              height={55}
              className="object-contain"
              priority
            />
          </Link>
          {/* Mobile close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "absolute right-2 hidden h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:flex",
              collapsed && "right-1/2 translate-x-1/2",
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isActive;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn("flex-1", collapsed && "lg:hidden")}>{item.label}</span>
                    {item.beta && !collapsed && (
                      <span
                        aria-label="Funcionalidade beta"
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 lg:inline"
                      >
                        Beta
                      </span>
                    )}
                    {showUnreadDot && (
                      <span
                        aria-label={`${totalUnread} conversa${totalUnread === 1 ? "" : "s"} não lida${totalUnread === 1 ? "" : "s"}`}
                        className={cn("relative flex h-2 w-2", collapsed && "lg:absolute lg:right-1 lg:top-1")}
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-white/10" />

          <ul className="flex flex-col gap-1">
            {visibleBottomItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors lg:py-2",
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={toggleMode}
                title={collapsed ? "Tema" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:py-2",
                  collapsed && "lg:justify-center lg:px-0",
                )}
              >
                {mode === "dark" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
                <span className={cn(collapsed && "lg:hidden")}>Tema</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-white/10 p-3">
          {showAccountStrip && account?.name && !collapsed ? (
            <div className="mb-2 flex items-center gap-2 px-3 text-xs text-white/50">
              <UsersRound className="size-3.5 shrink-0" />
              <span className="truncate" title={account.name}>
                {account.name}
              </span>
              {accountRole ? (
                (() => {
                  const meta = ROLE_CHIP[accountRole];
                  const Icon = meta.icon;
                  return (
                    <span
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
                    >
                      <Icon className="size-3" />
                      {meta.label}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none data-popup-open:bg-white/10",
              collapsed && "lg:justify-center lg:px-0",
            )}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-medium text-white">
                {(profile?.full_name || profile?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                <p className="truncate text-sm font-medium text-white">
                  {profile?.full_name ?? "Usuário"}
                </p>
                <p className="truncate text-xs text-white/50">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <User className="size-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href={isAdmin(accountRole) ? "/settings?tab=whatsapp" : "/settings?tab=profile"}
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
