// Helpers for annulment workflow.
//
// Three classes of "remove" action:
//   - hardDelete: doc was never accepted by AEAT (status != 'correcto') → DELETE row
//   - aeatAnnul: doc was accepted (status = 'correcto') and not annulled → submit RegistroAnulacion
//   - blocked: another non-annulled doc references this one as rectified → must annul that one first
//
// Note: aeat_status comparison is case-insensitive ("Correcto" / "correcto").

import { supabase } from "@/integrations/supabase/client";

export interface AnnulmentDocLite {
  id: string;
  doc_type: string;
  aeat_status: string;
  is_annulled: boolean;
}

export type RemoveAction =
  | { kind: "hardDelete" }
  | { kind: "aeatAnnul" }
  | { kind: "alreadyAnnulled" }
  | { kind: "blockedByRectifier"; rectifierNumber: string; rectifierId: string };

function isCorrecto(status: string): boolean {
  return (status || "").toLowerCase() === "correcto";
}

/**
 * Find an active (non-annulled) document that rectifies the given one.
 * If multiple exist, returns the most recent.
 */
export async function findActiveRectifierFor(
  invoiceId: string,
): Promise<{ id: string; formatted_number: string } | null> {
  const { data } = await supabase
    .from("documents")
    .select("id, formatted_number, created_at")
    .eq("rectified_invoice_id", invoiceId)
    .eq("is_annulled", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, formatted_number: data.formatted_number } : null;
}

export async function classifyRemoveAction(
  doc: AnnulmentDocLite,
): Promise<RemoveAction> {
  if (doc.is_annulled) return { kind: "alreadyAnnulled" };
  if (!isCorrecto(doc.aeat_status)) return { kind: "hardDelete" };
  // Correcto factura — check chain
  const rectifier = await findActiveRectifierFor(doc.id);
  if (rectifier) {
    return {
      kind: "blockedByRectifier",
      rectifierNumber: rectifier.formatted_number,
      rectifierId: rectifier.id,
    };
  }
  return { kind: "aeatAnnul" };
}
