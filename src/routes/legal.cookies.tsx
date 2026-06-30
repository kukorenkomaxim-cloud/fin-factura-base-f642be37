import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookies Policy — Fin-Factura" },
      { name: "description", content: "How Fin-Factura uses cookies and similar technologies." },
    ],
  }),
  component: () => <LegalLayout docKey="cookies" />,
});
