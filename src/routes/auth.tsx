import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/FormField";
import { LanguageToggle } from "@/components/LanguageToggle";
import { pick, useTr, useUiLang, type UiLang } from "@/lib/ui-lang";
import { useMemo } from "react";
import "@/i18n";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in - IIAL" },
      { name: "description", content: "Sign in to IIAL grant intelligence platform." },
    
      { property: "og:title", content: "Sign in - IIAL" },
      { property: "og:description", content: "GrantDesk auth: manage grant research, application preparation and related records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
],
  }),
  component: AuthPage,
});

const makeAuthSchema = (lang: UiLang) =>
  z.object({
    email: z.string().email(pick(lang, "Invalid email address", "Correo electrónico no válido")),
    password: z
      .string()
      .min(
        8,
        pick(
          lang,
          "Password must be at least 8 characters",
          "La contraseña debe tener al menos 8 caracteres",
        ),
      ),
  });
const authSchema = makeAuthSchema("en");

type AuthFormValues = z.infer<typeof authSchema>;

function AuthPage() {
  const { t } = useTranslation();
  const tr = useTr();
  const lang = useUiLang();
  const schema = useMemo(() => makeAuthSchema(lang), [lang]);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function waitForSession(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  async function onSubmit(values: AuthFormValues) {
    setError(null);
    setLoading(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword(values)
          : supabase.auth.signUp({
              ...values,
              options: { emailRedirectTo: `${window.location.origin}/dashboard` },
            });
      const { error } = await fn;
      if (error) throw error;
      const session = await waitForSession();
      if (!session)
        throw new Error(
          tr(
            "Unable to establish a session after sign in.",
            "No se pudo establecer la sesión después de iniciar sesión.",
          ),
        );
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const DEMO_USERS = [
    { label: "Admin", email: "demo-admin@iial.test", password: "IIAL-Demo-2026!" },
    { label: "Member A", email: "demo-member-a@iial.test", password: "IIAL-Demo-2026!" },
    { label: "Member B", email: "demo-member-b@iial.test", password: "IIAL-Demo-2026!" },
  ] as const;
  const DEMO_PASSWORD = "IIAL-Demo-2026!";

  async function demoLogin(demoEmail: string, customPassword?: string) {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: customPassword ?? DEMO_PASSWORD,
      });
      if (error) throw error;
      const session = await waitForSession();
      if (!session)
        throw new Error(
          tr(
            "Unable to establish a session after demo sign in.",
            "No se pudo establecer la sesión después del inicio de sesión de demostración.",
          ),
        );
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,111,160,0.12),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent)] px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto mb-4 flex w-full max-w-md justify-end">
        <LanguageToggle />
      </div>
      <Card className="mx-auto w-full max-w-md border-border/70 bg-card/95 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.32)] backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">
              {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr(
                "Sign in to your workspace or try the seeded demo accounts below.",
                "Inicie sesión en su espacio de trabajo o pruebe las cuentas de demostración a continuación.",
              )}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField label={t("auth.email")} error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register("email")} />
            </FormField>
            <FormField label={t("auth.password")} error={form.formState.errors.password?.message}>
              <Input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                {...form.register("password")}
              />
            </FormField>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("app.loading") : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm underline underline-offset-4"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 border-t pt-6">
              <p className="mb-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                {tr("Demo autologin", "Acceso automático de demostración")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_USERS.map((u) => (
                  <Button
                    key={u.email}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={loading}
                    onClick={() => demoLogin(u.email, u.password)}
                  >
                    {u.label}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {tr("Seeded accounts - password", "Cuentas de prueba - contraseña")}{" "}
                <code className="font-mono">{DEMO_PASSWORD}</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
