import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Fin-Factura" },
      { name: "description", content: "How Fin-Factura collects, uses and protects your personal data (GDPR / LOPDGDD)." },
    ],
  }),
  component: () => <LegalLayout docKey="privacy" />,
});
