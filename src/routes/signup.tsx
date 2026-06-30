import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { signUp } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t.passwordTooShort);
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(t.signupError, { description: error });
    } else {
      toast.success(t.accountCreated);
      navigate({ to: "/documents" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">{t.signupTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.signupSubtitle}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.password}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t.creatingAccount : t.signupBtn}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted-foreground">{t.orDivider}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleSignInButton />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t.hasAccount}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t.loginLink}
          </Link>
        </p>
        <LegalFooterLinks className="mt-6 border-t pt-4" />
      </Card>
    </div>
  );
}
