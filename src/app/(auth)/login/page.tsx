"use client";

import { Suspense, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x, y });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("account_role")
      .eq("user_id", data.user!.id)
      .maybeSingle();

    const role = profileData?.account_role;
    if (role === "agent" || role === "viewer") {
      router.push("/inbox");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{ backgroundColor: "#082637" }}
    >
      {/* Background logo — parallax layer */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${parallax.x * -40}px, ${parallax.y * -40}px) scale(1.08)`,
          transition: "transform 0.2s ease-out",
          willChange: "transform",
        }}
      >
        <Image
          src="/logomja.png"
          alt=""
          aria-hidden
          width={900}
          height={320}
          className="select-none object-contain opacity-[0.055]"
          style={{ filter: "brightness(100) saturate(0)" }}
          priority
        />
      </div>

      {/* Vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 65% at 50% 50%, transparent 30%, #082637 100%)",
        }}
      />

      {/* Subtle noise texture for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        <div
          className="rounded-2xl border border-white/10 px-8 py-9 shadow-2xl"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          {/* Logo */}
          <div className="mb-7 flex justify-center">
            <Image
              src="/logomja.png"
              alt="Mário Jorge Advocacia"
              width={190}
              height={68}
              className="object-contain"
              priority
            />
          </div>

          {/* Divider */}
          <div className="mb-7 border-t border-white/10" />

          <h1 className="mb-1 text-center text-[17px] font-semibold text-white">
            {inviteToken ? "Entre para aceitar" : "Bem-vindo de volta"}
          </h1>
          <p className="mb-7 text-center text-sm text-white/40">
            {inviteToken
              ? "Entre e te levaremos para o convite."
              : "Acesse sua conta"}
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-xs font-medium text-white/50">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-white/50">
                  Senha
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-white/40 transition-colors hover:text-white/70"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            Não tem uma conta?{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="text-white/55 transition-colors hover:text-white"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
