import type { UiLang } from "@/hooks/use-locale";
import { legalEs } from "./es";
import { legalEn } from "./en";
import { legalRu } from "./ru";
import { legalUk } from "./uk";
import type { LegalBundle, LegalDoc, LegalDocKey } from "./types";

export { LEGAL_INFO } from "./company";
export type { LegalDoc, LegalDocKey } from "./types";

const BUNDLES: Record<UiLang, LegalBundle> = {
  es: legalEs,
  en: legalEn,
  ru: legalRu,
  uk: legalUk,
};

export function getLegalDoc(lang: UiLang, key: LegalDocKey): LegalDoc {
  const bundle = BUNDLES[lang] ?? legalEn;
  return bundle[key];
}
