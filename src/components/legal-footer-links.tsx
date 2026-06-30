import { Link } from "@tanstack/react-router";
import { useLocale } from "@/hooks/use-locale";

/** Compact row of links to the legal documents. Used in auth pages and the app shell. */
export function LegalFooterLinks({ className }: { className?: string }) {
  const { t } = useLocale();
  const links = [
    { to: "/legal/privacy", label: t.legalPrivacy },
    { to: "/legal/terms", label: t.legalTerms },
    { to: "/legal/cookies", label: t.legalCookies },
    { to: "/legal/notice", label: t.legalNotice },
  ];
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {links.map((l, i) => (
          <span key={l.to} className="flex items-center gap-3">
            <Link to={l.to} className="hover:text-foreground hover:underline">
              {l.label}
            </Link>
            {i < links.length - 1 && <span className="text-border">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
