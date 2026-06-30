export type LegalSection = {
  heading: string;
  // Each entry is a paragraph or list item. Plain text only (no HTML).
  body: string[];
};

export type LegalDoc = {
  title: string;
  intro?: string;
  sections: LegalSection[];
};

export type LegalDocKey = "privacy" | "terms" | "cookies" | "notice";

export type LegalBundle = Record<LegalDocKey, LegalDoc>;
