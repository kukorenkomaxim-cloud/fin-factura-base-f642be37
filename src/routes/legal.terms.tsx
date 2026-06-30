import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Fin-Factura" },
      { name: "description", content: "Terms and conditions for using the Fin-Factura application." },
    ],
  }),
  component: () => <LegalLayout docKey="terms" />,
});
