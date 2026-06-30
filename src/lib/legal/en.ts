import { LEGAL_INFO as I } from "./company";
import type { LegalBundle } from "./types";

export const legalEn: LegalBundle = {
  privacy: {
    title: "Privacy Policy",
    intro: `At ${I.company} ("we", the "Controller") we take the protection of your personal data seriously. This Policy explains what data we process through the ${I.appName} application, for which purposes, and what rights you have, in accordance with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).`,
    sections: [
      {
        heading: "1. Data controller",
        body: [
          `Entity: ${I.company}`,
          `Tax ID (NIF/CIF): ${I.nif}`,
          `Address: ${I.address}`,
          `Contact email: ${I.email}`,
          `Website: ${I.website}`,
        ],
      },
      {
        heading: "2. Data we process",
        body: [
          "Account data: email address and user identifier, plus identity-provider data if you sign in with Google.",
          "Company data you enter: legal name, tax number, address, bank accounts.",
          "Your clients' and billing data that you enter to issue documents (invoices and proformas).",
          "Technical data: sign-in logs, access date and time, and data strictly necessary for security.",
          "If you connect an email account (e.g. Gmail) to send invoices, we store the required authorization tokens in encrypted form.",
          "Anonymous analytics identifier: if you accept analytics cookies, we store a random anonymous identifier in your browser to count visits and tell new visits apart from returning ones. It is not linked to your name, email or IP address, and is deleted when you withdraw consent or clear your browser.",
        ],
      },
      {
        heading: "3. Purposes and legal bases",
        body: [
          "Provide the invoice management and issuance service (performance of a contract, Art. 6(1)(b) GDPR).",
          "Manage your account, subscription and access (performance of a contract).",
          "Comply with legal obligations, including invoicing rules and, where applicable, submission of records to the Spanish Tax Agency (Verifactu) (legal obligation, Art. 6(1)(c) GDPR).",
          "Ensure the security of the service and prevent fraud (legitimate interest, Art. 6(1)(f) GDPR).",
          "Analytics or marketing cookies, only with your consent (Art. 6(1)(a) GDPR).",
        ],
      },
      {
        heading: "4. Data retention",
        body: [
          "We keep your data while your account is active.",
          "Billing data is retained for the periods required by Spanish tax and commercial law (generally several years).",
          "After account deletion, we delete or anonymize data we are not legally required to keep.",
        ],
      },
      {
        heading: "5. Recipients and processors",
        body: [
          "Cloud infrastructure and hosting provider running the application backend.",
          "Email providers you choose to connect for sending invoices.",
          "The Spanish Tax Agency (AEAT) where submission of invoicing records applies.",
          "We do not sell your personal data to third parties.",
        ],
      },
      {
        heading: "6. International transfers",
        body: [
          "If any provider processes data outside the European Economic Area, appropriate safeguards under the GDPR will apply (e.g. Standard Contractual Clauses).",
        ],
      },
      {
        heading: "7. Your rights",
        body: [
          "You may exercise your rights of access, rectification, erasure, objection, restriction of processing and data portability.",
          `To exercise them, write to ${I.email}. From within the app you can export your data and delete your account.`,
          `If you believe your rights have not been respected, you may lodge a complaint with the ${I.authority} (${I.authorityUrl}).`,
        ],
      },
      {
        heading: "8. Security",
        body: [
          "We apply reasonable technical and organizational measures, including encryption of sensitive credentials and access control, to protect your data.",
        ],
      },
      {
        heading: "9. Changes to this Policy",
        body: [
          "We may update this Policy. The current version will be published on this page with its update date.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    intro: `These Terms govern the use of the ${I.appName} application provided by ${I.company}. By registering or using the service, you accept these Terms.`,
    sections: [
      {
        heading: "1. The service",
        body: [
          `${I.appName} is a tool for managing and issuing invoices and commercial documents, including integration with the AEAT Verifactu system where applicable.`,
        ],
      },
      {
        heading: "2. Account and access",
        body: [
          "You must provide accurate information when registering and keep your credentials confidential.",
          "Access may be subject to a subscription or a valid access code.",
          "You are responsible for all activity carried out from your account.",
        ],
      },
      {
        heading: "3. Acceptable use",
        body: [
          "You will not use the service for unlawful purposes or to issue fraudulent documents.",
          "You will not attempt to breach the security of the service or access other users' data.",
        ],
      },
      {
        heading: "4. Responsibility for tax data",
        body: [
          "You are solely responsible for the accuracy of the tax and billing data you enter and issue.",
          "The service is a support tool; it does not replace professional tax or legal advice.",
        ],
      },
      {
        heading: "5. Availability and limitation of liability",
        body: [
          "The service is provided \u201cas is\u201d. We aim for continuous availability but do not guarantee uninterrupted operation.",
          "To the extent permitted by law, we are not liable for indirect damages or data loss arising from use of the service.",
        ],
      },
      {
        heading: "6. Subscription and payments",
        body: [
          "Subscription terms, duration and renewal will be shown before purchase, where applicable.",
        ],
      },
      {
        heading: "7. Termination",
        body: [
          "You may stop using the service and delete your account at any time from the app settings.",
          "We may suspend or cancel accounts that breach these Terms.",
        ],
      },
      {
        heading: "8. Governing law",
        body: [
          "These Terms are governed by Spanish law, without prejudice to mandatory consumer-protection rules.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies Policy",
    intro: `This Policy explains how ${I.appName} uses cookies and similar technologies, in accordance with Spanish LSSI-CE and the GDPR.`,
    sections: [
      {
        heading: "1. What are cookies?",
        body: [
          "Cookies are small files stored on your device to enable the application to work or to remember your preferences.",
        ],
      },
      {
        heading: "2. Cookies we use",
        body: [
          "Technical (necessary) cookies: essential for sign-in, security and basic functionality. No consent required.",
          "Analytics cookies: help us understand how the app is used, including an anonymous identifier stored in your browser to count unique and returning visits. Activated only with your consent.",
          "Marketing cookies: would be used for personalized advertising. Activated only with your consent.",
        ],
      },
      {
        heading: "3. Managing consent",
        body: [
          "On first access you are shown a banner to accept, reject or configure non-necessary cookies.",
          "You can change your choice at any time by clearing this app's browser data.",
        ],
      },
      {
        heading: "4. Changes",
        body: [
          "We will update this Policy when we add new cookies or services.",
        ],
      },
    ],
  },
  notice: {
    title: "Legal Notice",
    intro: `In compliance with Article 10 of Spanish Law 34/2002 on Information Society Services and Electronic Commerce (LSSI-CE), the following information is provided.`,
    sections: [
      {
        heading: "1. Identifying details",
        body: [
          `Entity: ${I.company}`,
          `Tax ID (NIF/CIF): ${I.nif}`,
          `Address: ${I.address}`,
          `Email: ${I.email}`,
          `Website: ${I.website}`,
        ],
      },
      {
        heading: "2. Purpose",
        body: [
          `This Legal Notice governs the use of the website and the ${I.appName} application, owned by the Controller.`,
        ],
      },
      {
        heading: "3. Intellectual and industrial property",
        body: [
          "The software, trademarks, logos and content of the service are owned by the Controller or its licensors and are protected by intellectual and industrial property law.",
        ],
      },
      {
        heading: "4. Liability",
        body: [
          "The Controller is not responsible for misuse of the application or for content entered by users.",
        ],
      },
      {
        heading: "5. Governing law",
        body: [
          "This Legal Notice is governed by Spanish law.",
        ],
      },
    ],
  },
};
