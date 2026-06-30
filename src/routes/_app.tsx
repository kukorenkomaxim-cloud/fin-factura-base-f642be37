import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { getMyAccess } from "@/lib/access.functions";
import { SubscriptionGate } from "@/components/subscription-gate";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Users, Settings as SettingsIcon, BarChart3, LogOut, Briefcase, Globe, Download, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import type { UiLang } from "@/hooks/use-locale";
import fincraftLogo from "@/assets/fincraft-logo-mask.png";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, lang, setLang } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchAccess = useServerFn(getMyAccess);
  const {
    data: access,
    isLoading: accessLoading,
    refetch: refetchAccess,
  } = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const NAV = [
    { to: "/documents", label: t.navDocuments, icon: FileText },
    { to: "/clients", label: t.navClients, icon: Users },
    { to: "/services", label: t.navServices, icon: Briefcase },
    { to: "/summary", label: t.navSummary, icon: BarChart3 },
    { to: "/settings", label: t.navSettings, icon: SettingsIcon },
    { to: "/download", label: lang === "ru" || lang === "uk" ? "Десктоп" : "Desktop", icon: Download },
    ...(access?.isAdmin
      ? [{ to: "/admin", label: t.navAdmin, icon: ShieldCheck } as const]
      : []),
  ] as const;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  if (authLoading || !user || accessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  // Block the whole app for users without active access (admins always pass).
  if (access && !access.hasAccess) {
    return (
      <SubscriptionGate
        email={user.email}
        onRedeemed={() => refetchAccess()}
        onSignOut={handleSignOut}
      />
    );
  }


  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="px-2 py-3">
          <div className="flex items-center gap-2">
            <span
              aria-label="FIN-CRAFT"
              role="img"
              className="block h-6 w-[62px] bg-foreground"
              style={{
                WebkitMaskImage: `url(${fincraftLogo})`,
                maskImage: `url(${fincraftLogo})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                filter: "contrast(1.4)",
              }}
            />
            <span className="text-2xl font-bold tracking-wide leading-[1] -translate-y-0.5 ml-1">
              {lang === "ru" ? "ФАКТУРА" : "FACTURA"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{user.email}</p>
        </div>

        {/* Language switcher */}
        <div className="mt-2 px-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Globe className="h-3 w-3" />
            {t.uiLanguage}
          </div>
          <Select value={lang} onValueChange={(v) => setLang(v as UiLang)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">{t.langRu}</SelectItem>
              <SelectItem value="en">{t.langEn}</SelectItem>
              <SelectItem value="es">{t.langEs}</SelectItem>
              <SelectItem value="uk">{t.langUk}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <nav className="mt-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t.signOut}
          </Button>
        </div>
        <LegalFooterLinks className="mt-auto pt-6" />
      </aside>


      <div className="flex-1">
        {/* Mobile top nav */}
        <div className="flex items-center gap-2 overflow-x-auto border-b bg-card px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Select value={lang} onValueChange={(v) => setLang(v as UiLang)}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <Globe className="h-3 w-3" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="es">ES</SelectItem>
              <SelectItem value="uk">UK</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <main className="mx-auto max-w-6xl p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
