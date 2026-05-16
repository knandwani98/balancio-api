/**
 * Curated Indian banks for picker UI; extend as needed.
 * Card PANs must never be stored at rest—persist last4 + brand only; see getCardType() and payment routes.
 */
export type BankCatalogEntry = {
  id: string;
  name: string;
  /** Public HTTPS logo URL (or replace with your CDN asset keys). */
  logo_url: string;
};

export const BANK_CATALOG: readonly BankCatalogEntry[] = [
  {
    id: "sbi",
    name: "State Bank of India",
    logo_url: "https://upload.wikimedia.org/wikipedia/en/5/58/State_Bank_of_India_logo.svg",
  },
  {
    id: "hdfc",
    name: "HDFC Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg",
  },
  {
    id: "icici",
    name: "ICICI Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/ICICI_Bank_Logo.svg",
  },
  {
    id: "axis",
    name: "Axis Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/en/1/1a/Axis_Bank_logo.svg",
  },
  {
    id: "kotak",
    name: "Kotak Mahindra Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Kotak_Mahindra_Bank_logo.svg",
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/1/17/Punjab_National_Bank_logo.svg",
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    logo_url: "https://upload.wikimedia.org/wikipedia/en/9/9d/Bank_of_Baroda_logo.svg",
  },
  {
    id: "canara",
    name: "Canara Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/98/Canara_Bank_logo.svg",
  },
  {
    id: "union",
    name: "Union Bank of India",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Union_Bank_of_India_Logo.svg",
  },
  {
    id: "idfc",
    name: "IDFC FIRST Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/8/8a/IDFC_First_Bank_Logo.svg",
  },
  {
    id: "yes",
    name: "Yes Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/YES_BANK_logo.svg",
  },
  {
    id: "indusind",
    name: "IndusInd Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/3/3a/IndusInd_Bank_SVG_Logo.svg",
  },
  {
    id: "federal",
    name: "Federal Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Federal_Bank_Logo.svg",
  },
  {
    id: "rbl",
    name: "RBL Bank",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/5/5a/RBL_Bank_Logo.svg",
  },
];

export function bankById(id: string): BankCatalogEntry | undefined {
  return BANK_CATALOG.find((b) => b.id === id);
}
