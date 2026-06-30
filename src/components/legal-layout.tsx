import { Link } from "@tanstack/react-router";
import { ArrowLeft, Globe } from "lucide-react";
import { useLocale, type UiLang } from "@/hooks/use-locale";
import { getLegalDoc, LEGAL_INFO, type LegalDocKey } from "@/lib/legal";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";

const DOC_LINKS: { key: LegalDocKey; to: string; labelKey: "legalPrivacy" | "legalTerms" | "legalCookies" | "legalNotice" }[] = [
  { key: "privacy", to: "/legal/privacy", labelKey: "legalPrivacy" },
  { key: "terms", to: "/legal/terms", labelKey: "legalTerms" },
  { key: "cookies", to: "/legal/cookies", labelKey: "legalCookies" },
  { key: "notice", to: "/legal/notice", labelKey: "legalNotice" },
];

export function LegalLayout({ docKey }: { docKey: LegalDocKey }) {
  const { t, lang, setLang } = useLocale();
  const doc = getLegalDoc(lang, docKey);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-foreground hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {t.legalBackToApp}
          </Link>
          <Select value={lang} onValueChange={(v) => setLang(v as UiLang)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <Globe className="mr-1 h-3 w-3" />
              {lang.toUpperCase()}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">ES</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="uk">UK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6 flex flex-wrap gap-2">
          {DOC_LINKS.map((l) => (
            <Link
              key={l.key}
              to={l.to}
              className="rounded-md border px-3 py-1.5 text-xs transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted"
              activeProps={{ "data-active": "true" } as Record<string, string>}
            >
              {t[l.labelKey]}
            </Link>
          ))}
        </nav>

        <Card className="p-6 md:p-8">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.legalLastUpdated}: {LEGAL_INFO.lastUpdated}
          </p>
          {doc.intro && <p className="mt-4 text-sm leading-relaxed text-foreground">{doc.intro}</p>}

          <div className="mt-6 space-y-6">
            {doc.sections.map((s, i) => (
              <section key={i}>
                <h2 className="font-semibold text-foreground">{s.heading}</h2>
                <div className="mt-2 space-y-2">
                  {s.body.map((p, j) => (
                    <p key={j} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            {t.legalContact}:{" "}
            <a href={`mailto:${LEGAL_INFO.email}`} className="text-primary hover:underline">
              {LEGAL_INFO.email}
            </a>
          </p>
        </Card>
      </main>
    </div>
  );
}
