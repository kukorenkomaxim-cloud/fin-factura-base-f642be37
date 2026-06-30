import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";

export const Route = createFileRoute("/legal/notice")({
  head: () => ({
    meta: [
      { title: "Legal Notice — Fin-Factura" },
      { name: "description", content: "Legal notice and company information (LSSI-CE)." },
    ],
  }),
  component: () => <LegalLayout docKey="notice" />,
});
